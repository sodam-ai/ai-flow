use crate::AppState;
use tauri::State;

/// Get cost report (period: "week" | "month" | "all")
#[tauri::command]
pub async fn get_cost_report(
    state: State<'_, AppState>,
    period: String,
) -> Result<crate::services::cost_report::CostReport, String> {
    crate::services::cost_report::get_report(&state.db, &period)
}

/// Get current month budget status
#[tauri::command]
pub async fn get_budget_status(
    state: State<'_, AppState>,
) -> Result<crate::services::cost_report::BudgetStatus, String> {
    crate::services::cost_report::get_budget_status(&state.db)
}

/// Update monthly budget settings
#[tauri::command]
pub async fn set_budget(
    state: State<'_, AppState>,
    monthly_usd: f64,
    threshold_pct: i32,
) -> Result<(), String> {
    if monthly_usd < 0.0 {
        return Err("BUDGET_001: Budget must be non-negative".into());
    }
    if !(1..=100).contains(&threshold_pct) {
        return Err("BUDGET_002: Threshold must be 1~100".into());
    }
    crate::services::cost_report::set_budget(&state.db, monthly_usd, threshold_pct)
}
