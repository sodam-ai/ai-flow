use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowTemplate {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub category: String,
    pub icon: String,
    pub steps: Vec<TemplateStep>,
    pub is_builtin: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemplateStep {
    pub name: String,
    pub prompt: String,
    pub model: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workflow {
    pub id: i64,
    pub name: String,
    pub description: Option<String>,
    pub template_id: Option<i64>,
    pub is_active: bool,
    pub steps: Vec<WorkflowStep>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowStep {
    pub id: i64,
    pub workflow_id: i64,
    pub step_order: i32,
    pub name: String,
    pub provider: Option<String>,
    pub model: Option<String>,
    pub system_prompt: Option<String>,
    pub user_prompt_template: String,
    pub mcp_server_id: Option<i64>,
    pub is_enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowRun {
    pub id: i64,
    pub workflow_id: i64,
    pub status: String,
    pub initial_input: String,
    pub final_output: Option<String>,
    pub error_message: Option<String>,
    pub total_cost_usd: f64,
    pub step_results: Vec<WorkflowStepResult>,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowStepResult {
    pub id: i64,
    pub run_id: i64,
    pub step_id: i64,
    pub step_order: i32,
    pub input_text: String,
    pub output_text: Option<String>,
    pub status: String,
    pub error_message: Option<String>,
    pub tokens_in: i32,
    pub tokens_out: i32,
    pub cost_usd: f64,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
}

// --- Requests ---

#[derive(Debug, Deserialize)]
pub struct CreateWorkflowRequest {
    pub name: String,
    pub description: Option<String>,
    pub template_id: Option<i64>,
    pub steps: Vec<CreateWorkflowStepRequest>,
}

#[derive(Debug, Deserialize)]
pub struct CreateWorkflowStepRequest {
    pub name: String,
    pub provider: Option<String>,
    pub model: Option<String>,
    pub system_prompt: Option<String>,
    pub user_prompt_template: String,
    pub mcp_server_id: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct RunWorkflowRequest {
    pub workflow_id: i64,
    pub initial_input: String,
    pub provider_override: Option<String>,
    pub model_override: Option<String>,
}

// --- Batch ---

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchJob {
    pub id: i64,
    pub name: String,
    pub workflow_id: Option<i64>,
    pub provider: Option<String>,
    pub model: Option<String>,
    pub system_prompt: Option<String>,
    pub status: String,
    pub total_items: i32,
    pub processed_items: i32,
    pub failed_items: i32,
    pub output_dir: Option<String>,
    pub total_cost_usd: f64,
    pub created_at: String,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchItem {
    pub id: i64,
    pub job_id: i64,
    pub item_order: i32,
    pub input_text: Option<String>,
    pub input_file_path: Option<String>,
    pub output_text: Option<String>,
    pub output_file_path: Option<String>,
    pub status: String,
    pub error_message: Option<String>,
    pub tokens_in: i32,
    pub tokens_out: i32,
    pub cost_usd: f64,
    pub processed_at: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateBatchJobRequest {
    pub name: String,
    pub workflow_id: Option<i64>,
    pub provider: Option<String>,
    pub model: Option<String>,
    pub system_prompt: Option<String>,
    pub output_dir: Option<String>,
    pub items: Vec<BatchItemInput>,
}

#[derive(Debug, Deserialize)]
pub struct BatchItemInput {
    pub input_text: Option<String>,
    pub input_file_path: Option<String>,
}

/// 배치 진행 이벤트 (프론트엔드로 emit)
#[derive(Debug, Clone, Serialize)]
pub struct BatchProgressEvent {
    pub job_id: i64,
    pub item_id: i64,
    pub item_order: i32,
    pub total_items: i32,
    pub processed_items: i32,
    pub status: String,
    pub output_text: Option<String>,
    pub error_message: Option<String>,
}
