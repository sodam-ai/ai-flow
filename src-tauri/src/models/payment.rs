use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LicenseInfo {
    pub id: i64,
    pub tier: String,                              // 'free' | 'pro'
    pub payment_provider: Option<String>,
    pub order_id: Option<String>,
    pub activated_at: Option<String>,
    pub expires_at: Option<String>,
    pub last_verified_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckoutUrlResponse {
    pub url: String,
    pub provider: String,
}

#[derive(Debug, Deserialize)]
pub struct ActivateLicenseRequest {
    pub license_key: String,
    pub provider: String,  // 'lemonsqueezy' | 'toss' | 'naverpay'
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProFeatures {
    pub mcp_plugins: bool,
    pub workflow_builder: bool,
    pub batch_processing: bool,
    pub browser_extension: bool,
    pub smart_routing: bool,
    pub unlimited_history: bool,
}

impl ProFeatures {
    pub fn free() -> Self {
        Self {
            mcp_plugins: false,
            workflow_builder: false,
            batch_processing: false,
            browser_extension: false,
            smart_routing: true,       // 스마트 라우팅은 무료
            unlimited_history: false,
        }
    }

    pub fn pro() -> Self {
        Self {
            mcp_plugins: true,
            workflow_builder: true,
            batch_processing: true,
            browser_extension: true,
            smart_routing: true,
            unlimited_history: true,
        }
    }
}
