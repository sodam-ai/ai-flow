use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AgentRun {
    pub id: i64,
    pub conversation_id: Option<String>,
    pub goal: String,
    pub status: String,
    pub provider: String,
    pub model: String,
    pub total_steps: i64,
    pub completed_steps: i64,
    pub total_cost_usd: f64,
    pub final_output: Option<String>,
    pub error_msg: Option<String>,
    pub started_at: String,
    pub completed_at: Option<String>,
    pub steps: Vec<AgentStep>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AgentStep {
    pub id: i64,
    pub run_id: i64,
    pub step_order: i64,
    pub step_type: String,
    pub title: String,
    pub description: Option<String>,
    pub input_text: Option<String>,
    pub output_text: Option<String>,
    pub tool_name: Option<String>,
    pub tool_args: Option<String>,
    pub tool_result: Option<String>,
    pub requires_approval: bool,
    pub approval_message: Option<String>,
    pub approved: Option<bool>,
    pub status: String,
    pub cost_usd: f64,
    pub tokens_in: i64,
    pub tokens_out: i64,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AgentTool {
    pub id: i64,
    pub name: String,
    pub description: String,
    pub parameters_json: String,
    pub is_enabled: bool,
    pub requires_approval: bool,
}

// ─── Events ───────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AgentProgressEvent {
    pub run_id: i64,
    pub step_id: i64,
    pub step_order: i64,
    pub step_type: String,
    pub title: String,
    pub status: String,
    pub output: Option<String>,
    pub requires_approval: bool,
    pub approval_message: Option<String>,
}

// ─── Requests ─────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct StartAgentRequest {
    pub goal: String,
    pub provider: Option<String>,
    pub model: Option<String>,
    pub conversation_id: Option<String>,
    pub kb_ids: Option<Vec<i64>>,  // knowledge bases to search
    pub max_steps: Option<i64>,    // safety limit (default 10)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ApproveAgentStepRequest {
    pub run_id: i64,
    pub step_id: i64,
    pub approved: bool,
    pub feedback: Option<String>,  // optional user feedback on denial
}

// ─── Conversation branch types ─────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ConversationBranch {
    pub id: i64,
    pub parent_conversation_id: String,
    pub branch_conversation_id: String,
    pub fork_message_id: String,
    pub fork_message_index: i64,
    pub label: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreateBranchRequest {
    pub parent_conversation_id: String,
    pub fork_message_id: String,
    pub fork_message_index: i64,
    pub label: Option<String>,
}
