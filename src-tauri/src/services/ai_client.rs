use anyhow::{bail, Result};
use futures::StreamExt;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::Duration;
use tauri::ipc::Channel;
use tokio_util::sync::CancellationToken;
use tracing::info;
use uuid::Uuid;
use zeroize::Zeroizing;

use crate::models::provider::{ProviderId, RequestFormat};

/// HTTPS 전용 reqwest 클라이언트 — 외부 AI API 전용
pub fn build_http_client() -> Result<Client> {
    let client = Client::builder()
        .timeout(Duration::from_secs(120))
        .connect_timeout(Duration::from_secs(10))
        .pool_max_idle_per_host(10)
        .pool_idle_timeout(Duration::from_secs(90))
        .use_rustls_tls()
        .https_only(true)
        .build()?;
    Ok(client)
}

/// HTTP 허용 클라이언트 — Ollama localhost 전용
/// 05_SECURITY_SPEC.md: 로컬 HTTP는 Ollama 용도만 허용
pub fn build_local_client() -> Result<Client> {
    Client::builder()
        .timeout(Duration::from_secs(120))
        .connect_timeout(Duration::from_secs(10))
        .pool_max_idle_per_host(4)
        .pool_idle_timeout(Duration::from_secs(60))
        .use_rustls_tls()
        // https_only 미설정 — Ollama localhost HTTP 허용
        .build()
        .map_err(Into::into)
}

/// IPC 스트림 청크 타입 — 06_TEST_SPEC.md MockIpcChannel 계약과 일치
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum StreamChunk {
    Token { content: String },
    Done { message_id: String, tokens_used: u32, cost_usd: f64 },
    Error { code: String, message: String },
}

/// AI 스트리밍 요청 파라미터
#[derive(Debug, Deserialize)]
pub struct StreamRequest {
    pub conversation_id: String,
    pub provider_id: String,
    pub model_id: String,
    pub messages: Vec<ChatMessage>,
    /// 활성 페르소나의 system_prompt — 각 provider 포맷에 맞게 주입
    pub system_prompt: Option<String>,
    /// Azure/Custom 공급자 전용 커스텀 엔드포인트 (키체인에서 읽어 전달)
    pub custom_base_url: Option<String>,
    pub max_tokens: Option<u32>,
    pub temperature: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

/// 스트리밍 완료 결과 — 토큰 카운트 + DB 저장용 텍스트 반환
pub struct StreamResult {
    pub message_id: String,
    pub input_tokens: u32,
    pub output_tokens: u32,
    /// 어시스턴트 응답 전체 텍스트 — DB에 저장
    pub content: String,
}

/// model_id가 URL에 직접 포함될 때 SSRF 방지 검증 (Google 전용)
/// 허용: 영문자, 숫자, 하이픈, 점, 언더스코어 (슬래시/콜론 불허)
pub fn validate_model_id_for_url(model_id: &str) -> bool {
    !model_id.is_empty()
        && model_id.len() <= 128
        && model_id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '.' | '_'))
}

/// model_id 기본 검증 — SSRF 방지, 경로 탐색 방지
/// Ollama 태그(llama3.2:8b) 허용을 위해 콜론/슬래시 허용
pub fn validate_model_id(model_id: &str) -> bool {
    !model_id.is_empty()
        && model_id.len() <= 128
        && !model_id.contains("../")
        && !model_id.contains("..\\")
        && model_id.chars().all(|c| {
            c.is_ascii_alphanumeric() || matches!(c, '-' | '.' | '_' | ':' | '/')
        })
}

/// AI 스트리밍 실행 — Tauri ipc::Channel로 토큰 전송
/// https_client: HTTPS 전용 (외부 API)
/// local_client: HTTP 허용 (Ollama localhost)
pub async fn stream_ai(
    https_client: &Client,
    local_client: &Client,
    request: StreamRequest,
    api_key: Zeroizing<String>,
    channel: Channel<StreamChunk>,
    cancel_token: CancellationToken,
) -> Result<StreamResult> {
    let provider = ProviderId::from_str(&request.provider_id)
        .ok_or_else(|| anyhow::anyhow!("Unknown provider: {}", request.provider_id))?;

    // Ollama만 HTTP 클라이언트 사용, 나머지는 HTTPS 전용
    let client = if provider.allows_http() {
        local_client
    } else {
        https_client
    };

    // Google: model_id가 URL에 포함되므로 SSRF 검증 (엄격)
    if matches!(provider, ProviderId::Google) && !validate_model_id_for_url(&request.model_id) {
        bail!(
            "Invalid model_id for Google URL (SSRF guard): {}",
            request.model_id
        );
    }

    // 엔드포인트 URL 결정
    let url = if let Some(base_url) = &request.custom_base_url {
        base_url.clone()
    } else {
        provider
            .default_endpoint(&request.model_id)
            .ok_or_else(|| {
                anyhow::anyhow!(
                    "No default endpoint for provider: {}",
                    request.provider_id
                )
            })?
    };

    let message_id = Uuid::new_v4().to_string();
    let max_tokens = request.max_tokens.unwrap_or(4096);
    let temperature = request.temperature.unwrap_or(0.7);

    // provider별 HTTP 요청 빌드 후 api_key 즉시 소거
    let request_builder = match provider.request_format() {
        RequestFormat::Anthropic => {
            build_anthropic_request(client, &url, &api_key, &request, max_tokens, temperature)
        }
        RequestFormat::GoogleGemini => {
            build_google_request(client, &url, &api_key, &request, max_tokens, temperature)
        }
        RequestFormat::OpenAiCompatible => {
            build_openai_request(client, &url, &api_key, &provider, &request, max_tokens, temperature)
        }
    };
    // API 키는 reqwest RequestBuilder 내부(header)에 복사됨 — 우리 쪽 사본 즉시 소거
    drop(api_key);

    let mut stream = request_builder.send().await?.bytes_stream();

    let mut buffer = String::new();
    let mut input_tokens: u32 = 0;
    let mut output_tokens: u32 = 0;
    let mut content = String::new();
    let provider_id = request.provider_id.clone();

    'outer: loop {
        tokio::select! {
            _ = cancel_token.cancelled() => {
                info!("stream cancelled for conversation {}", request.conversation_id);
                break;
            }
            chunk = stream.next() => {
                match chunk {
                    None => break,
                    Some(Err(e)) => {
                        let _ = channel.send(StreamChunk::Error {
                            code: "AI_007".to_string(),
                            message: e.to_string(),
                        });
                        break;
                    }
                    Some(Ok(bytes)) => {
                        buffer.push_str(&String::from_utf8_lossy(&bytes));
                        // SSE 이벤트 파싱 — 각 이벤트 블록은 \n\n으로 구분
                        while let Some(pos) = buffer.find("\n\n") {
                            let event_block = buffer[..pos].to_string();
                            buffer.drain(..pos + 2);

                            // 멀티라인 이벤트 블록에서 "data: " 라인 탐색
                            // Anthropic: "event: xxx\ndata: {...}" 형식
                            // OpenAI/Google: "data: {...}" 단일 라인
                            for line in event_block.lines() {
                                if let Some(data) = line.strip_prefix("data: ") {
                                    if data == "[DONE]" {
                                        break 'outer;
                                    }
                                    if let Ok(val) = serde_json::from_str::<Value>(data) {
                                        extract_usage(&val, &provider_id, &mut input_tokens, &mut output_tokens);
                                        if let Some(token) = extract_token(&val, &provider_id) {
                                            content.push_str(&token);
                                            let _ = channel.send(StreamChunk::Token { content: token });
                                        }
                                    }
                                    break; // 이벤트 블록당 data 라인은 하나
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(StreamResult {
        message_id,
        input_tokens,
        output_tokens,
        content,
    })
}

// ── 요청 빌더 ──────────────────────────────────────────────────────────────

fn build_openai_request(
    client: &Client,
    url: &str,
    api_key: &Zeroizing<String>,
    provider: &ProviderId,
    request: &StreamRequest,
    max_tokens: u32,
    temperature: f32,
) -> reqwest::RequestBuilder {
    let mut messages: Vec<Value> = Vec::new();

    // 시스템 프롬프트를 첫 번째 메시지로 주입
    if let Some(system) = &request.system_prompt {
        if !system.is_empty() {
            messages.push(json!({"role": "system", "content": system}));
        }
    }

    for msg in &request.messages {
        messages.push(json!({"role": msg.role, "content": msg.content}));
    }

    let body = json!({
        "model": request.model_id,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "stream": true,
        "stream_options": { "include_usage": true }  // 마지막 청크에 usage 포함
    });

    // Azure OpenAI는 api-key 헤더 사용, 나머지는 Bearer 인증
    let builder = client.post(url);
    if matches!(provider, ProviderId::AzureOpenai) {
        builder
            .header("api-key", api_key.as_str())
            .json(&body)
    } else {
        builder
            .bearer_auth(api_key.as_str())
            .json(&body)
    }
}

fn build_anthropic_request(
    client: &Client,
    url: &str,
    api_key: &Zeroizing<String>,
    request: &StreamRequest,
    max_tokens: u32,
    temperature: f32,
) -> reqwest::RequestBuilder {
    // Anthropic: system 최상위 필드, messages는 user/assistant만 허용
    let messages: Vec<Value> = request
        .messages
        .iter()
        .filter(|m| m.role == "user" || m.role == "assistant")
        .map(|m| json!({"role": m.role, "content": m.content}))
        .collect();

    let mut body = json!({
        "model": request.model_id,
        "messages": messages,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "stream": true
        // stream_options 없음 — Anthropic 미지원
    });

    if let Some(system) = &request.system_prompt {
        if !system.is_empty() {
            body["system"] = json!(system);
        }
    }

    client
        .post(url)
        .header("x-api-key", api_key.as_str())
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
}

fn build_google_request(
    client: &Client,
    url: &str,
    api_key: &Zeroizing<String>,
    request: &StreamRequest,
    max_tokens: u32,
    temperature: f32,
) -> reqwest::RequestBuilder {
    // Google Gemini: role "assistant" → "model", contents/generationConfig 구조
    let contents: Vec<Value> = request
        .messages
        .iter()
        .filter(|m| m.role == "user" || m.role == "assistant")
        .map(|m| {
            let role = if m.role == "assistant" { "model" } else { "user" };
            json!({
                "role": role,
                "parts": [{"text": m.content}]
            })
        })
        .collect();

    let mut body = json!({
        "contents": contents,
        "generationConfig": {
            "maxOutputTokens": max_tokens,
            "temperature": temperature
        }
    });

    if let Some(system) = &request.system_prompt {
        if !system.is_empty() {
            body["systemInstruction"] = json!({
                "parts": [{"text": system}]
            });
        }
    }

    // Google: API 키는 쿼리 파라미터 (provider 설계)
    // default_endpoint는 이미 ?alt=sse 포함, &key= 추가
    let url_with_key = format!("{}&key={}", url, api_key.as_str());

    client
        .post(&url_with_key)
        .header("content-type", "application/json")
        .json(&body)
}

// ── 토큰/사용량 추출 ────────────────────────────────────────────────────────

fn extract_usage(val: &Value, provider_id: &str, input: &mut u32, output: &mut u32) {
    match provider_id {
        "anthropic" => {
            // message_start 이벤트: message.usage.input_tokens
            if let Some(msg) = val.get("message") {
                if let Some(usage) = msg.get("usage") {
                    if let Some(v) = usage.get("input_tokens").and_then(Value::as_u64) {
                        *input = v as u32;
                    }
                }
            }
            // message_delta 이벤트: usage.output_tokens (누적값, 덮어쓰기)
            if let Some(usage) = val.get("usage") {
                if let Some(v) = usage.get("input_tokens").and_then(Value::as_u64) {
                    *input = v as u32;
                }
                if let Some(v) = usage.get("output_tokens").and_then(Value::as_u64) {
                    *output = v as u32; // Anthropic은 누적값 — += 아닌 =
                }
            }
        }
        "google" => {
            // usageMetadata — 마지막 청크에만 포함
            if let Some(meta) = val.get("usageMetadata") {
                if let Some(v) = meta.get("promptTokenCount").and_then(Value::as_u64) {
                    *input = v as u32;
                }
                if let Some(v) = meta.get("candidatesTokenCount").and_then(Value::as_u64) {
                    *output = v as u32;
                }
            }
        }
        _ => {
            // OpenAI 호환: 마지막 청크의 usage (stream_options.include_usage = true)
            if let Some(usage) = val.get("usage") {
                if let Some(v) = usage.get("prompt_tokens").and_then(Value::as_u64) {
                    *input = v as u32;
                }
                if let Some(v) = usage.get("completion_tokens").and_then(Value::as_u64) {
                    *output = v as u32;
                }
            }
        }
    }
}

fn extract_token(val: &Value, provider_id: &str) -> Option<String> {
    match provider_id {
        "anthropic" => {
            // content_block_delta 이벤트: delta.type == "text_delta" && delta.text
            let delta = val.get("delta")?;
            if delta.get("type")?.as_str()? == "text_delta" {
                delta.get("text")?.as_str().map(String::from)
            } else {
                None
            }
        }
        "google" => {
            // candidates[0].content.parts[0].text
            val.get("candidates")?
                .get(0)?
                .get("content")?
                .get("parts")?
                .get(0)?
                .get("text")?
                .as_str()
                .map(String::from)
        }
        _ => {
            // OpenAI 호환: choices[0].delta.content
            let content = val
                .get("choices")?
                .get(0)?
                .get("delta")?
                .get("content")?;
            // null이면 None 반환 (스트림 종료 청크)
            if content.is_null() {
                None
            } else {
                content.as_str().map(String::from)
            }
        }
    }
}
