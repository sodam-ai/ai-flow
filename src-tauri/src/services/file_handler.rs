use serde::{Deserialize, Serialize};
use std::path::Path;

const MAX_FILE_SIZE: u64 = 10 * 1024 * 1024; // 10MB

const ALLOWED_EXTENSIONS: &[&str] = &[
    "pdf", "txt", "md", "py", "js", "ts", "json", "csv", "rs", "go", "java", "c", "cpp", "h",
    "png", "jpg", "jpeg", "gif", "webp",
];

const IMAGE_EXTENSIONS: &[&str] = &["png", "jpg", "jpeg", "gif", "webp"];

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileInfo {
    pub path: String,
    pub name: String,
    pub extension: String,
    pub size: u64,
    pub is_image: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileContent {
    pub info: FileInfo,
    pub content: String,
    pub content_type: String, // "text" or "image"
}

/// Validate a file against whitelist and size limit
pub fn validate_file(path: &str) -> Result<FileInfo, String> {
    let file_path = Path::new(path);

    // Check file exists
    if !file_path.exists() {
        return Err("FILE_001: File not found".to_string());
    }

    // Check it's a file (not directory)
    if !file_path.is_file() {
        return Err("FILE_002: Path is not a file".to_string());
    }

    // Get file name
    let name = file_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    // Check extension
    let extension = file_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    if !ALLOWED_EXTENSIONS.contains(&extension.as_str()) {
        return Err(format!(
            "FILE_003: File type '.{}' is not supported. Allowed: {}",
            extension,
            ALLOWED_EXTENSIONS.join(", ")
        ));
    }

    // Check file size
    let metadata = std::fs::metadata(path)
        .map_err(|e| format!("FILE_004: Cannot read file metadata: {}", e))?;
    let size = metadata.len();

    if size > MAX_FILE_SIZE {
        return Err(format!(
            "FILE_005: File size ({:.1}MB) exceeds 10MB limit",
            size as f64 / (1024.0 * 1024.0)
        ));
    }

    if size == 0 {
        return Err("FILE_006: File is empty".to_string());
    }

    let is_image = IMAGE_EXTENSIONS.contains(&extension.as_str());

    Ok(FileInfo {
        path: path.to_string(),
        name,
        extension,
        size,
        is_image,
    })
}

/// Read file content: text for text files, base64 for images
pub fn read_file_content(path: &str) -> Result<FileContent, String> {
    let info = validate_file(path)?;

    if info.is_image {
        // Read as binary and encode to base64
        let bytes = std::fs::read(path)
            .map_err(|e| format!("FILE_007: Cannot read image file: {}", e))?;

        use std::io::Write;
        let mut buf = Vec::new();
        {
            let mut encoder = base64_encode_writer(&mut buf);
            encoder.write_all(&bytes).map_err(|e| format!("FILE_008: Base64 encoding failed: {}", e))?;
        }
        let content = String::from_utf8(buf)
            .map_err(|e| format!("FILE_008: Base64 encoding failed: {}", e))?;

        Ok(FileContent {
            info,
            content,
            content_type: "image".to_string(),
        })
    } else {
        // Read as UTF-8 text
        let content = std::fs::read_to_string(path)
            .map_err(|e| format!("FILE_007: Cannot read text file: {}", e))?;

        Ok(FileContent {
            info,
            content,
            content_type: "text".to_string(),
        })
    }
}

/// Simple base64 encoder (no external dependency — uses standard encoding)
fn base64_encode_writer(output: &mut Vec<u8>) -> Base64Writer<'_> {
    Base64Writer { output }
}

struct Base64Writer<'a> {
    output: &'a mut Vec<u8>,
}

impl<'a> std::io::Write for Base64Writer<'a> {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        // Simple base64 encoding
        const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        let mut i = 0;
        while i + 2 < buf.len() {
            let n = ((buf[i] as u32) << 16) | ((buf[i + 1] as u32) << 8) | (buf[i + 2] as u32);
            self.output.push(CHARS[((n >> 18) & 0x3F) as usize]);
            self.output.push(CHARS[((n >> 12) & 0x3F) as usize]);
            self.output.push(CHARS[((n >> 6) & 0x3F) as usize]);
            self.output.push(CHARS[(n & 0x3F) as usize]);
            i += 3;
        }
        let remaining = buf.len() - i;
        if remaining == 2 {
            let n = ((buf[i] as u32) << 16) | ((buf[i + 1] as u32) << 8);
            self.output.push(CHARS[((n >> 18) & 0x3F) as usize]);
            self.output.push(CHARS[((n >> 12) & 0x3F) as usize]);
            self.output.push(CHARS[((n >> 6) & 0x3F) as usize]);
            self.output.push(b'=');
        } else if remaining == 1 {
            let n = (buf[i] as u32) << 16;
            self.output.push(CHARS[((n >> 18) & 0x3F) as usize]);
            self.output.push(CHARS[((n >> 12) & 0x3F) as usize]);
            self.output.push(b'=');
            self.output.push(b'=');
        }
        Ok(buf.len())
    }

    fn flush(&mut self) -> std::io::Result<()> {
        Ok(())
    }
}
