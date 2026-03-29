use serde::Serialize;

/// IPC error returned to frontend — matches 14_ERROR_CATALOG
#[derive(Debug, Serialize, Clone)]
pub struct IpcError {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
}

impl std::fmt::Display for IpcError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "[{}] {}", self.code, self.message)
    }
}

impl From<IpcError> for String {
    fn from(e: IpcError) -> String {
        serde_json::to_string(&e).unwrap_or_else(|_| e.message)
    }
}

/// Convenience constructor
impl IpcError {
    pub fn new(code: &str, message: &str) -> Self {
        Self {
            code: code.to_string(),
            message: message.to_string(),
            detail: None,
        }
    }

    pub fn with_detail(code: &str, message: &str, detail: &str) -> Self {
        Self {
            code: code.to_string(),
            message: message.to_string(),
            detail: Some(detail.to_string()),
        }
    }
}

pub type CommandResult<T> = Result<T, String>;
