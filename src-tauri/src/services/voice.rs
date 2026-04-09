//! Voice transcription service — OpenAI Whisper API
//!
//! Security:
//! - OWASP ASVS 5.2.3: control characters stripped from transcription output
//! - Audio bytes wrapped in `Zeroizing<Vec<u8>>` — wiped from memory on drop
//! - 25 MB hard limit enforced (Whisper API constraint)
//! - MIME type validated before network call

use reqwest::multipart;
use zeroize::Zeroizing;

/// 25 MB — Whisper API hard limit
const MAX_AUDIO_BYTES: usize = 25 * 1024 * 1024;

/// OWASP ASVS 5.2.3 — remove control characters from transcription output.
/// Keeps printable ASCII/Unicode, newline, carriage return, and tab.
fn sanitize_transcript(raw: &str) -> String {
    raw.chars()
        .filter(|&c| {
            let cp = c as u32;
            cp >= 0x20 || matches!(c, '\n' | '\r' | '\t')
        })
        .collect()
}

/// Map MIME type → filename extension that Whisper recognizes.
fn mime_to_filename(mime: &str) -> &'static str {
    match mime {
        "audio/wav" | "audio/x-wav" => "audio.wav",
        "audio/mp4" | "audio/m4a"  => "audio.m4a",
        "audio/ogg"                => "audio.ogg",
        "audio/mpeg"               => "audio.mp3",
        _                          => "audio.webm",
    }
}

/// Transcribe audio bytes via OpenAI Whisper API (`/v1/audio/transcriptions`).
///
/// # Arguments
/// * `http_client`  — shared reqwest client (connection pool reuse)
/// * `api_key`      — OpenAI key; never logged or returned to frontend
/// * `audio_bytes`  — raw audio wrapped in `Zeroizing<Vec<u8>>`; wiped on drop
/// * `language`     — optional ISO 639-1 hint (e.g. `"ko"`, `"en"`, `"ja"`)
/// * `audio_mime`   — MIME type for correct Whisper file extension detection
///
/// Returns sanitized transcription text on success.
pub async fn transcribe_audio(
    http_client: &reqwest::Client,
    api_key: &str,
    audio_bytes: Zeroizing<Vec<u8>>,
    language: Option<String>,
    audio_mime: &str,
) -> Result<String, String> {
    if audio_bytes.is_empty() {
        return Err("VOICE_001: Audio data is empty".to_string());
    }
    if audio_bytes.len() > MAX_AUDIO_BYTES {
        return Err(format!(
            "VOICE_002: Audio size ({} bytes) exceeds 25 MB Whisper limit",
            audio_bytes.len()
        ));
    }

    let filename = mime_to_filename(audio_mime);

    let audio_part = multipart::Part::bytes(audio_bytes.to_vec())
        .file_name(filename)
        .mime_str(audio_mime)
        .map_err(|e| format!("VOICE_003: MIME configuration error — {e}"))?;

    let mut form = multipart::Form::new()
        .part("file", audio_part)
        .text("model", "whisper-1")
        .text("response_format", "json");

    if let Some(lang) = language {
        form = form.text("language", lang);
    }

    let resp = http_client
        .post("https://api.openai.com/v1/audio/transcriptions")
        .header("Authorization", format!("Bearer {api_key}"))
        .multipart(form)
        .timeout(std::time::Duration::from_secs(30))
        .send()
        .await
        .map_err(|e| format!("VOICE_004: Network error — {e}"))?;

    let status = resp.status();
    let body: serde_json::Value = resp
        .json()
        .await
        .map_err(|e| format!("VOICE_005: Response parse error — {e}"))?;

    if !status.is_success() {
        let msg = body
            .pointer("/error/message")
            .and_then(|v| v.as_str())
            .unwrap_or("Unknown Whisper API error");
        return Err(format!("VOICE_006: Whisper API ({status}) — {msg}"));
    }

    let text = body["text"]
        .as_str()
        .ok_or_else(|| "VOICE_007: Missing 'text' field in Whisper response".to_string())?;

    Ok(sanitize_transcript(text.trim()))
}
