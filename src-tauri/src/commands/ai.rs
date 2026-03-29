use std::sync::Arc;
use tauri::ipc::Channel;
use tauri::State;
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

use crate::error::{CommandResult, ErrorCode, IpcError};
use crate::models::conversation::{Message, MessageRole};
use crate::models::provider::{ProviderId, ALLOWED_PROVIDERS};
use crate::services::ai_client::{stream_ai, validate_model_id, validate_model_id_for_url, StreamChunk, StreamRequest};
use crate::services::audit::AuditEvent;
use crate::services::cost::CostCalculator;
use crate::AppState;

// ── 입력 검증 ──────────────────────────────────────────────────────────────

fn validate_stream_request(request: &StreamRequest) -> Result<(), IpcError> {
    // CRIT-01: provider_id 화이트리스트 검증
    if !ALLOWED_PROVIDERS.contains(&request.provider_id.as_str()) {
        return Err(IpcError::new(
            ErrorCode::Ai002,
            format!("Unsupported provider: {}", request.provider_id),
        ));
    }

    // conversation_id UUID 검증 — DB 인젝션 방지
    if Uuid::parse_str(&request.conversation_id).is_err() {
        return Err(IpcError::new(
            ErrorCode::Ai002,
            "Invalid conversation_id (must be UUID)",
        ));
    }

    // model_id 검증 — SSRF / 경로 탐색 방지
    let model_valid = if request.provider_id == "google" {
        validate_model_id_for_url(&request.model_id)
    } else {
        validate_model_id(&request.model_id)
    };
    if !model_valid {
        return Err(IpcError::new(
            ErrorCode::Ai002,
            format!("Invalid model_id: {}", request.model_id),
        ));
    }

    // 메시지 최소 1개 필수
    if request.messages.is_empty() {
        return Err(IpcError::new(ErrorCode::Ai002, "messages cannot be empty"));
    }

    Ok(())
}

// ── Tauri Commands ─────────────────────────────────────────────────────────

/// AI 스트리밍 시작 — ipc::Channel로 토큰 전송
/// 04_PROJECT_SPEC.md: API 키는 Rust 내에서만 사용, IPC 경계 절대 넘지 않음
#[tauri::command]
pub async fn stream_ai_command(
    state: State<'_, AppState>,
    request: StreamRequest,
    channel: Channel<StreamChunk>,
) -> CommandResult<String> {
    // 입력 검증
    validate_stream_request(&request).map_err(|e| e)?;

    let conversation_id = request.conversation_id.clone();
    let provider_id = request.provider_id.clone();
    let model_id = request.model_id.clone();

    let provider = ProviderId::from_str(&provider_id)
        .ok_or_else(|| IpcError::new(ErrorCode::Ai002, "Unknown provider"))?;

    // Ollama는 API 키 불필요
    let api_key = if provider.requires_api_key() {
        let account = provider.keychain_account();
        state
            .keychain
            .get_secret("aiflow", &account)
            .map_err(|e| {
                IpcError::new(ErrorCode::Keychain001, "Failed to read API key")
                    .with_detail(e.to_string())
            })?
            .ok_or_else(|| {
                IpcError::new(
                    ErrorCode::Ai001,
                    format!("API key not set for provider: {}", provider_id),
                )
            })?
    } else {
        // Ollama: 빈 키 (stream_ai 내부에서 auth 헤더 생략)
        zeroize::Zeroizing::new(String::new())
    };

    // Azure/Custom: 키체인에서 커스텀 base URL 읽기
    let custom_base_url = if let Some(url_account) = provider.keychain_base_url_account() {
        state
            .keychain
            .get_secret("aiflow", &url_account)
            .ok()
            .flatten()
            .map(|z| z.as_str().to_string())
    } else {
        None
    };

    // 취소 토큰 생성
    let cancel_token = CancellationToken::new();
    let stream_id = conversation_id.clone();

    // 동시 스트림 상한 검사 (max 5) — TOCTOU 방지: register 내부에서 체크
    state
        .streams
        .register(stream_id.clone(), cancel_token.clone())
        .await
        .map_err(|_| {
            IpcError::new(ErrorCode::Rate002, "Too many concurrent AI streams (max 5)")
        })?;

    state
        .audit
        .log(AuditEvent::StreamStarted {
            conversation_id: conversation_id.clone(),
        })
        .await;

    // 사용자 메시지를 spawn 전에 DB 저장 — 충돌/취소 시에도 유실 방지
    let last_user_content = request
        .messages
        .iter()
        .rev()
        .find(|m| m.role == "user")
        .map(|m| m.content.clone())
        .unwrap_or_default();

    if !last_user_content.is_empty() {
        let user_msg = Message {
            id: Uuid::new_v4().to_string(),
            conversation_id: conversation_id.clone(),
            role: MessageRole::User,
            content: last_user_content,
            tokens_used: None,
            cost_usd: None,
            model_id: Some(model_id.clone()),
            is_redacted: false,
            created_at: chrono::Utc::now(),
        };
        if let Err(e) = state.chat.save_message(user_msg).await {
            tracing::warn!("Failed to save user message: {}", e);
        }
    }

    // 커스텀 base_url을 request에 주입
    let mut request = request;
    request.custom_base_url = custom_base_url;

    // Arc 복사 — spawn 클로저에 이동
    let https_client = Arc::clone(&state.http_client);
    let local_client = Arc::clone(&state.local_client);
    let audit = Arc::clone(&state.audit);
    let chat = Arc::clone(&state.chat);
    let streams = Arc::clone(&state.streams);
    let sid = stream_id.clone();
    let cid = conversation_id.clone();

    tokio::spawn(async move {
        match stream_ai(
            &https_client,
            &local_client,
            request,
            api_key,
            channel.clone(),
            cancel_token,
        )
        .await
        {
            Ok(result) => {
                let cost_usd = CostCalculator::calculate_usd(
                    &model_id,
                    result.input_tokens,
                    result.output_tokens,
                );
                let tokens_used = result.input_tokens + result.output_tokens;

                // 어시스턴트 메시지 DB 저장
                if !result.content.is_empty() {
                    let asst_msg = Message {
                        id: result.message_id.clone(),
                        conversation_id: cid.clone(),
                        role: MessageRole::Assistant,
                        content: result.content,
                        tokens_used: Some(tokens_used as i64),
                        cost_usd: Some(cost_usd),
                        model_id: Some(model_id.clone()),
                        is_redacted: false,
                        created_at: chrono::Utc::now(),
                    };
                    if let Err(e) = chat.save_message(asst_msg).await {
                        tracing::warn!("Failed to save assistant message: {}", e);
                    }

                    // 대화 통계 업데이트
                    if let Err(e) = chat
                        .update_conversation_stats(cid.clone(), tokens_used as i64, cost_usd)
                        .await
                    {
                        tracing::warn!("Failed to update conversation stats: {}", e);
                    }
                }

                let _ = channel.send(StreamChunk::Done {
                    message_id: result.message_id,
                    tokens_used,
                    cost_usd,
                });
            }
            Err(e) => {
                let _ = channel.send(StreamChunk::Error {
                    code: "AI_007".to_string(),
                    message: e.to_string(),
                });
            }
        }

        streams.remove(&sid).await;
        audit
            .log(AuditEvent::StreamCancelled {
                conversation_id: sid,
            })
            .await;
    });

    Ok(stream_id)
}

/// AI 스트리밍 취소
#[tauri::command]
pub async fn cancel_stream(state: State<'_, AppState>, stream_id: String) -> CommandResult<()> {
    state.streams.cancel(&stream_id).await;
    Ok(())
}
