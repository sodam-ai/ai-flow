use serde::{Deserialize, Serialize};

/// Smart routing rule: maps complexity range → provider + model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoutingRule {
    pub id: String,
    pub name: String,
    pub min_complexity: i32,
    pub max_complexity: i32,
    pub provider_id: String,
    pub model_id: String,
    pub fallback_chain: Vec<FallbackEntry>,
    pub priority: i32,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FallbackEntry {
    pub provider_id: String,
    pub model_id: String,
}

/// Result of complexity analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoutingSuggestion {
    pub complexity_score: i32,
    pub complexity_label: String, // "simple" | "medium" | "complex"
    pub suggested_provider_id: String,
    pub suggested_model_id: String,
    pub suggested_model_name: String,
    pub estimated_cost_usd: f64,
    pub cheapest_cost_usd: f64,
    pub potential_savings_usd: f64,
    pub rule_id: Option<String>,
    pub fallback_chain: Vec<FallbackEntry>,
}

/// Comparison group for multi-AI side-by-side
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComparisonGroup {
    pub id: String,
    pub conversation_id: String,
    pub user_message_id: String,
    pub adopted_message_id: Option<String>,
    pub members: Vec<ComparisonMember>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComparisonMember {
    pub id: String,
    pub group_id: String,
    pub message_id: String,
    pub provider_id: String,
    pub model_id: String,
    pub stream_index: i32,
    pub is_adopted: bool,
}

/// Multi-AI stream target
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StreamTarget {
    pub provider_id: String,
    pub model_id: String,
}
