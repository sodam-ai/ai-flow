use crate::db::pool::Database;
use crate::models::routing::{FallbackEntry, RoutingRule, RoutingSuggestion};
use crate::services::cost;

/// Complexity scoring keywords (Korean + English)
const REASONING_KEYWORDS: &[&str] = &[
    "분석", "비교", "왜", "어떻게", "설명", "추론", "근거", "증명", "논리",
    "analyze", "compare", "why", "how", "explain", "reason", "prove",
];

const CODE_INDICATORS: &[&str] = &[
    "```", "function", "def ", "class ", "import ", "const ", "let ", "var ",
    "fn ", "pub ", "struct ", "impl ", "async ", "await",
];

/// Calculate complexity score for a prompt (0~100)
/// PRD v4.0 §03 algorithm + enhancements
pub fn calc_complexity(prompt: &str, has_file: bool, has_code: bool) -> i32 {
    let mut score: i32 = 0;

    // Length scoring (longer = more complex)
    let char_count = prompt.chars().count();
    if char_count > 100 { score += 10; }
    if char_count > 200 { score += 15; }
    if char_count > 500 { score += 15; }
    if char_count > 1000 { score += 10; }

    // File attachment
    if has_file { score += 20; }

    // Code content
    if has_code { score += 15; }

    // Code indicators in prompt text
    let code_indicator_count = CODE_INDICATORS.iter()
        .filter(|kw| prompt.contains(**kw))
        .count();
    score += (code_indicator_count as i32 * 3).min(15);

    // Reasoning keywords
    let keyword_count = REASONING_KEYWORDS.iter()
        .filter(|kw| prompt.to_lowercase().contains(**kw))
        .count();
    score += (keyword_count as i32 * 5).min(25);

    // Multi-line / structured query bonus
    let line_count = prompt.lines().count();
    if line_count > 5 { score += 5; }
    if line_count > 15 { score += 5; }

    // Question marks indicate analytical queries
    let question_marks = prompt.chars().filter(|c| *c == '?').count();
    score += (question_marks as i32 * 3).min(10);

    score.clamp(0, 100)
}

/// Get complexity label from score
pub fn complexity_label(score: i32) -> &'static str {
    match score {
        0..=30 => "simple",
        31..=60 => "medium",
        _ => "complex",
    }
}

/// Suggest the best AI based on routing rules and prompt complexity
pub fn suggest_route(
    db: &Database,
    prompt: &str,
    has_file: bool,
    has_code: bool,
) -> Result<RoutingSuggestion, String> {
    let score = calc_complexity(prompt, has_file, has_code);
    let label = complexity_label(score).to_string();

    // Try to find a matching routing rule
    let rule = db.read(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, name, min_complexity, max_complexity, provider_id, model_id,
                    fallback_chain, priority, is_active, created_at, updated_at
             FROM routing_rules
             WHERE is_active = 1 AND min_complexity <= ?1 AND max_complexity >= ?1
             ORDER BY priority DESC
             LIMIT 1",
        )?;

        let result = stmt.query_row(rusqlite::params![score], |row| {
            let fallback_json: String = row.get(6)?;
            let fallback: Vec<FallbackEntry> = serde_json::from_str(&fallback_json)
                .unwrap_or_default();

            Ok(RoutingRule {
                id: row.get(0)?,
                name: row.get(1)?,
                min_complexity: row.get(2)?,
                max_complexity: row.get(3)?,
                provider_id: row.get(4)?,
                model_id: row.get(5)?,
                fallback_chain: fallback,
                priority: row.get(7)?,
                is_active: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        });

        match result {
            Ok(rule) => Ok(Some(rule)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    })?;

    // If no rule found, use defaults
    let (provider_id, model_id, model_name, fallback_chain, rule_id) = match &rule {
        Some(r) => (
            r.provider_id.clone(),
            r.model_id.clone(),
            r.name.clone(),
            r.fallback_chain.clone(),
            Some(r.id.clone()),
        ),
        None => default_route(score),
    };

    // Calculate cost comparison
    let avg_tokens = 500i64; // rough estimate for cost comparison
    let suggested_cost = cost::calc_cost(&provider_id, &model_id, avg_tokens, avg_tokens);
    let cheapest_cost = cost::calc_cost("google", "gemini-1.5-flash", avg_tokens, avg_tokens);
    let expensive_cost = cost::calc_cost("openai", "gpt-4o", avg_tokens, avg_tokens);

    let potential_savings = if score <= 30 {
        expensive_cost - suggested_cost // savings vs always using the most expensive
    } else {
        0.0 // for complex queries, no savings claim
    };

    Ok(RoutingSuggestion {
        complexity_score: score,
        complexity_label: label,
        suggested_provider_id: provider_id,
        suggested_model_id: model_id,
        suggested_model_name: model_name,
        estimated_cost_usd: suggested_cost,
        cheapest_cost_usd: cheapest_cost,
        potential_savings_usd: potential_savings.max(0.0),
        rule_id,
        fallback_chain,
    })
}

/// Default routing when no rules are configured
fn default_route(score: i32) -> (String, String, String, Vec<FallbackEntry>, Option<String>) {
    match score {
        0..=30 => (
            "google".into(), "gemini-1.5-flash".into(), "Simple → Flash".into(),
            vec![
                FallbackEntry { provider_id: "anthropic".into(), model_id: "claude-3-5-haiku-20241022".into() },
            ],
            None,
        ),
        31..=60 => (
            "anthropic".into(), "claude-sonnet-4-6-20260327".into(), "Medium → Sonnet".into(),
            vec![
                FallbackEntry { provider_id: "openai".into(), model_id: "gpt-4o".into() },
                FallbackEntry { provider_id: "google".into(), model_id: "gemini-1.5-pro".into() },
            ],
            None,
        ),
        _ => (
            "openai".into(), "gpt-4o".into(), "Complex → GPT-4o".into(),
            vec![
                FallbackEntry { provider_id: "anthropic".into(), model_id: "claude-sonnet-4-6-20260327".into() },
            ],
            None,
        ),
    }
}

/// Insert default routing rules (called after migration 008)
pub fn seed_default_rules(db: &Database) -> Result<(), String> {
    let now = chrono::Utc::now().to_rfc3339();

    // Check if rules already exist
    let count: i64 = db.read(|conn| {
        conn.query_row("SELECT COUNT(*) FROM routing_rules", [], |row| row.get(0))
    })?;

    if count > 0 {
        return Ok(()); // Already seeded
    }

    db.write(|conn| {
        // Simple queries → Gemini Flash (cheapest)
        conn.execute(
            "INSERT INTO routing_rules (id, name, min_complexity, max_complexity, provider_id, model_id, fallback_chain, priority, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            rusqlite::params![
                uuid::Uuid::new_v4().to_string(),
                "Simple → Flash",
                0, 30,
                "google", "gemini-1.5-flash",
                r#"[{"provider_id":"anthropic","model_id":"claude-3-5-haiku-20241022"}]"#,
                10,
                now, now,
            ],
        )?;

        // Medium queries → Claude Sonnet
        conn.execute(
            "INSERT INTO routing_rules (id, name, min_complexity, max_complexity, provider_id, model_id, fallback_chain, priority, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            rusqlite::params![
                uuid::Uuid::new_v4().to_string(),
                "Medium → Sonnet",
                31, 60,
                "anthropic", "claude-sonnet-4-6-20260327",
                r#"[{"provider_id":"openai","model_id":"gpt-4o"},{"provider_id":"google","model_id":"gemini-1.5-pro"}]"#,
                10,
                now, now,
            ],
        )?;

        // Complex queries → GPT-4o
        conn.execute(
            "INSERT INTO routing_rules (id, name, min_complexity, max_complexity, provider_id, model_id, fallback_chain, priority, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            rusqlite::params![
                uuid::Uuid::new_v4().to_string(),
                "Complex → GPT-4o",
                61, 100,
                "openai", "gpt-4o",
                r#"[{"provider_id":"anthropic","model_id":"claude-sonnet-4-6-20260327"}]"#,
                10,
                now, now,
            ],
        )?;

        Ok(())
    })
}

/// Get all routing rules
pub fn get_rules(db: &Database) -> Result<Vec<RoutingRule>, String> {
    db.read(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, name, min_complexity, max_complexity, provider_id, model_id,
                    fallback_chain, priority, is_active, created_at, updated_at
             FROM routing_rules
             ORDER BY priority DESC, min_complexity ASC",
        )?;

        let rows = stmt.query_map([], |row| {
            let fallback_json: String = row.get(6)?;
            let fallback: Vec<FallbackEntry> = serde_json::from_str(&fallback_json)
                .unwrap_or_default();

            Ok(RoutingRule {
                id: row.get(0)?,
                name: row.get(1)?,
                min_complexity: row.get(2)?,
                max_complexity: row.get(3)?,
                provider_id: row.get(4)?,
                model_id: row.get(5)?,
                fallback_chain: fallback,
                priority: row.get(7)?,
                is_active: row.get(8)?,
                created_at: row.get(9)?,
                updated_at: row.get(10)?,
            })
        })?;

        rows.collect::<Result<Vec<_>, _>>()
    })
}
