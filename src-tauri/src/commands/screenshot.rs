use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};

/// Capture the primary display and return a base64-encoded PNG.
///
/// Security (OWASP ASVS):
/// - 4.1.3: Output capped at 10 MB to prevent OOM on high-DPI displays
/// - No file I/O — bytes live in memory only for the duration of this call
/// - No user-supplied parameters — no injection surface
#[tauri::command]
pub async fn capture_screen() -> Result<String, String> {
    let screens = screenshots::Screen::all()
        .map_err(|e| format!("SCREEN_001: Failed to enumerate displays: {e}"))?;

    let screen = screens
        .into_iter()
        .next()
        .ok_or_else(|| "SCREEN_002: No display found".to_string())?;

    // capture() returns image::RgbaImage (ImageBuffer<Rgba<u8>, Vec<u8>>)
    let rgba_image = screen
        .capture()
        .map_err(|e| format!("SCREEN_003: Capture failed: {e}"))?;

    // Encode to PNG via image::DynamicImage
    let dynamic = image::DynamicImage::ImageRgba8(rgba_image);
    let mut cursor = std::io::Cursor::new(Vec::<u8>::new());
    dynamic
        .write_to(&mut cursor, image::ImageFormat::Png)
        .map_err(|e| format!("SCREEN_004: PNG encode failed: {e}"))?;

    let png_bytes = cursor.into_inner();

    // ASVS 4.1.3: hard size limit — 10 MB
    const MAX_BYTES: usize = 10 * 1024 * 1024;
    if png_bytes.len() > MAX_BYTES {
        return Err("SCREEN_005: Screenshot exceeds 10 MB — reduce display resolution".to_string());
    }

    Ok(BASE64.encode(&png_bytes))
}
