use crate::db::pool::Database;
use rusqlite::params;
use serde::{Deserialize, Serialize};

/// Cost summary per model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelCostSummary {
    pub provider_id: String,
    pub model_id: String,
    pub message_count: i64,
    pub total_input_tokens: i64,
    pub total_output_tokens: i64,
    pub total_cost_usd: f64,
}

/// Daily cost entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyCost {
    pub date: String,  // "2026-03-31"
    pub message_count: i64,
    pub total_cost_usd: f64,
}

/// Full cost report
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CostReport {
    pub period: String,  // "week" | "month" | "all"
    pub total_cost_usd: f64,
    pub total_messages: i64,
    pub total_input_tokens: i64,
    pub total_output_tokens: i64,
    pub by_model: Vec<ModelCostSummary>,
    pub by_day: Vec<DailyCost>,
    pub avg_cost_per_message: f64,
}

/// Budget status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BudgetStatus {
    pub monthly_budget_usd: f64,
    pub spent_this_month_usd: f64,
    pub remaining_usd: f64,
    pub usage_pct: f64,
    pub alert_threshold_pct: i32,
    pub is_over_threshold: bool,
    pub is_over_budget: bool,
}

/// Get cost report for a time period
pub fn get_report(db: &Database, period: &str) -> Result<CostReport, String> {
    // Compute cutoff as a Rust value and pass as param — avoids format! SQL assembly
    let cutoff: Option<String> = match period {
        "week" => Some(
            (chrono::Utc::now() - chrono::Duration::days(7))
                .format("%Y-%m-%d %H:%M:%S")
                .to_string(),
        ),
        "month" => Some(
            (chrono::Utc::now() - chrono::Duration::days(30))
                .format("%Y-%m-%d %H:%M:%S")
                .to_string(),
        ),
        _ => None, // "all" — no filter
    };

    // By model
    let by_model = db.read(|conn| {
        let mut stmt = conn.prepare(
            "SELECT
                c.provider_id, c.model_id,
                COUNT(*) as msg_count,
                COALESCE(SUM(m.input_tokens), 0) as total_in,
                COALESCE(SUM(m.output_tokens), 0) as total_out,
                COALESCE(SUM(m.cost_usd), 0.0) as total_cost
             FROM messages m
             JOIN conversations c ON m.conversation_id = c.id
             WHERE m.role = 'assistant' AND m.cost_usd IS NOT NULL
               AND (?1 IS NULL OR m.created_at >= ?1)
             GROUP BY c.provider_id, c.model_id
             ORDER BY total_cost DESC",
        )?;
        let rows = stmt.query_map(params![cutoff], |row| {
            Ok(ModelCostSummary {
                provider_id: row.get(0)?,
                model_id: row.get(1)?,
                message_count: row.get(2)?,
                total_input_tokens: row.get(3)?,
                total_output_tokens: row.get(4)?,
                total_cost_usd: row.get(5)?,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>()
    })?;

    // By day
    let by_day = db.read(|conn| {
        let mut stmt = conn.prepare(
            "SELECT
                DATE(m.created_at) as day,
                COUNT(*) as msg_count,
                COALESCE(SUM(m.cost_usd), 0.0) as total_cost
             FROM messages m
             WHERE m.role = 'assistant' AND m.cost_usd IS NOT NULL
               AND (?1 IS NULL OR m.created_at >= ?1)
             GROUP BY DATE(m.created_at)
             ORDER BY day DESC
             LIMIT 30",
        )?;
        let rows = stmt.query_map(params![cutoff], |row| {
            Ok(DailyCost {
                date: row.get(0)?,
                message_count: row.get(1)?,
                total_cost_usd: row.get(2)?,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>()
    })?;

    // Totals
    let total_cost: f64 = by_model.iter().map(|m| m.total_cost_usd).sum();
    let total_messages: i64 = by_model.iter().map(|m| m.message_count).sum();
    let total_input: i64 = by_model.iter().map(|m| m.total_input_tokens).sum();
    let total_output: i64 = by_model.iter().map(|m| m.total_output_tokens).sum();
    let avg = if total_messages > 0 { total_cost / total_messages as f64 } else { 0.0 };

    Ok(CostReport {
        period: period.to_string(),
        total_cost_usd: total_cost,
        total_messages,
        total_input_tokens: total_input,
        total_output_tokens: total_output,
        by_model,
        by_day,
        avg_cost_per_message: avg,
    })
}

/// Get current month budget status
pub fn get_budget_status(db: &Database) -> Result<BudgetStatus, String> {
    // Get budget settings
    let (budget, threshold) = db.read(|conn| {
        conn.query_row(
            "SELECT monthly_budget_usd, alert_threshold_pct FROM budget_settings WHERE id = 'default'",
            [],
            |row| Ok((row.get::<_, f64>(0)?, row.get::<_, i32>(1)?)),
        )
    })?;

    // Get this month's spending
    let spent: f64 = db.read(|conn| {
        conn.query_row(
            "SELECT COALESCE(SUM(cost_usd), 0.0) FROM messages
             WHERE role = 'assistant' AND cost_usd IS NOT NULL
             AND created_at >= datetime('now', 'start of month')",
            [],
            |row| row.get(0),
        )
    })?;

    let remaining = (budget - spent).max(0.0);
    let usage_pct = if budget > 0.0 { (spent / budget) * 100.0 } else { 0.0 };

    Ok(BudgetStatus {
        monthly_budget_usd: budget,
        spent_this_month_usd: spent,
        remaining_usd: remaining,
        usage_pct,
        alert_threshold_pct: threshold,
        is_over_threshold: usage_pct >= threshold as f64,
        is_over_budget: spent >= budget,
    })
}

/// Update budget settings
pub fn set_budget(db: &Database, monthly_usd: f64, threshold_pct: i32) -> Result<(), String> {
    let now = chrono::Utc::now().to_rfc3339();
    db.write(|conn| {
        conn.execute(
            "UPDATE budget_settings SET monthly_budget_usd = ?1, alert_threshold_pct = ?2, updated_at = ?3 WHERE id = 'default'",
            rusqlite::params![monthly_usd, threshold_pct, now],
        )?;
        Ok(())
    })
}
