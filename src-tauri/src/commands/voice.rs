//! Voice IPC commands — Phase 5 (STT via OpenAI Whisper)
//!
//! Security:
//! - OWASP ASVS 4.1.3: payload size capped (34 MB base64 ≈ 25 MB raw audio)
//! - OWASP ASVS 1.5.2: MIME type whitelist validation
//! - OWASP ASVS 5.2.3: transcription output sanitized (via service layer)
//! - API key retrieved from OS keychain only — never returned to frontend
//! - Audio bytes wrapped in `Zeroizing<Vec<u8>>` — wiped from memory on drop
//! - Language code format validated (alphanumeric + hyphen, max 8 chars)

use crate::AppState;
use tauri::State;
use zeroize::Zeroizing;

/// Base64 upper bound: ~33.5 MB encodes ≈ 25 MB raw (Whisper limit)
const MAX_BASE64_LEN: usize = 34 * 1024 * 1024;

/// Allowed audio MIME types — ASVS 1.5.2 whitelist
const ALLOWED_MIMES: &[&str] = &[
    "audio/webm",
    "audio/wav",
    "audio/x-wav",
    "audio/mp4",
    "audio/m4a",
    "audio/ogg",
    "audio/mpeg",
];

/// Transcribe audio bytes via OpenAI Whisper API.
///
/// IPC contract:
/// - `audio_base64` — base64-encoded audio (WebM/WAV/MP4/OGG/MP3)
/// - `language`     — optional ISO 639-1 hint (`"ko"`, `"en"`, `"ja"`, …)
/// - `audio_mime`   — optional MIME type; defaults to `"audio/webm"`
///
/// Returns the sanitized transcription text.
#[tauri::command]
pub async fn transcribe_audio(
    state: State<'_, AppState>,
    audio_base64: String,
    language: Option<String>,
    audio_mime: Option<String>,
) -> Result<String, String> {
    // ASVS 4.1.3 — reject oversized payloads before any processing
    if audio_base64.len() > MAX_BASE64_LEN {
        return Err("VOICE_010: Audio payload exceeds maximum allowed size".to_string());
    }

    // Validate language code: ASCII alphanumeric + hyphen, max 8 chars
    if let Some(ref lang) = language {
        let valid = !lang.is_empty()
            && lang.len() <= 8
            && lang.chars().all(|c| c.is_ascii_alphanumeric() || c == '-');
        if !valid {
            return Err("VOICE_011: Invalid language code format".to_string());
        }
    }

    // ASVS 1.5.2 — MIME type whitelist
    let mime = audio_mime.as_deref().unwrap_or("audio/webm");
    if !ALLOWED_MIMES.contains(&mime) {
        return Err("VOICE_012: Unsupported audio MIME type".to_string());
    }

    // Decode base64 → raw bytes
    use base64::Engine;
    let raw_bytes = base64::engine::general_purpose::STANDARD
        .decode(&audio_base64)
        .map_err(|_| "VOICE_013: Invalid base64 audio data".to_string())?;

    // Zeroizing — audio bytes are wiped from memory when this scope exits
    let secure_bytes = Zeroizing::new(raw_bytes);

    // Retrieve OpenAI API key from OS keychain (NEVER expose full key via IPC)
    let api_key = crate::services::keychain::get_key_internal("openai").map_err(|_| {
        "VOICE_014: OpenAI API key not configured — please add it in Settings.".to_string()
    })?;
    let api_key_z = Zeroizing::new(api_key);

    crate::services::voice::transcribe_audio(
        &state.http_client,
        &api_key_z,
        secure_bytes,
        language,
        mime,
    )
    .await
}
