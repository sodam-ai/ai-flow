use crate::db::pool::Database;
use crate::models::local_llm::{LocalLlmDetectionResult, LocalLlmEndpoint, LocalLlmModel};
use reqwest::Client;
use std::time::Duration;

/// Known local LLM endpoints to probe
const ENDPOINTS: &[(&str, &str, &str)] = &[
    ("Ollama", "http://localhost:11434", "ollama"),
    ("LM Studio", "http://localhost:1234", "openai_compat"),
];

/// Detect running local LLM servers (5s timeout per endpoint)
pub async fn detect_all(db: &Database) -> Vec<LocalLlmDetectionResult> {
    let client = Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .unwrap_or_default();

    let mut results = Vec::new();

    for (name, base_url, api_type) in ENDPOINTS {
        let detection = detect_endpoint(&client, name, base_url, api_type).await;
        results.push(detection.clone());

        // Persist to DB if running
        if detection.is_running {
            let _ = save_endpoint(db, name, base_url, api_type, &detection.models);
        }
    }

    results
}

/// Probe a single endpoint for available models
async fn detect_endpoint(
    client: &Client,
    name: &str,
    base_url: &str,
    api_type: &str,
) -> LocalLlmDetectionResult {
    let models = match api_type {
        "ollama" => detect_ollama(client, base_url).await,
        "openai_compat" => detect_openai_compat(client, base_url).await,
        _ => Vec::new(),
    };

    LocalLlmDetectionResult {
        endpoint_name: name.to_string(),
        base_url: base_url.to_string(),
        is_running: !models.is_empty(),
        models,
    }
}

/// Ollama: GET /api/tags → list of models
async fn detect_ollama(client: &Client, base_url: &str) -> Vec<LocalLlmModel> {
    let url = format!("{}/api/tags", base_url);

    let resp = match client.get(&url).send().await {
        Ok(r) if r.status().is_success() => r,
        _ => return Vec::new(),
    };

    let body: serde_json::Value = match resp.json().await {
        Ok(v) => v,
        Err(_) => return Vec::new(),
    };

    let models = body.get("models")
        .and_then(|m| m.as_array())
        .map(|arr| {
            arr.iter().filter_map(|m| {
                let name = m.get("name")?.as_str()?.to_string();
                let size = m.get("size")
                    .and_then(|s| s.as_u64())
                    .map(|bytes| format_bytes(bytes));
                let params = m.get("details")
                    .and_then(|d| d.get("parameter_size"))
                    .and_then(|p| p.as_str())
                    .map(|s| s.to_string());

                Some(LocalLlmModel {
                    id: uuid::Uuid::new_v4().to_string(),
                    endpoint_id: String::new(), // filled later
                    model_name: name,
                    model_size: size,
                    parameter_count: params,
                })
            }).collect()
        })
        .unwrap_or_default();

    models
}

/// OpenAI-compatible: GET /v1/models → list of models (LM Studio)
async fn detect_openai_compat(client: &Client, base_url: &str) -> Vec<LocalLlmModel> {
    let url = format!("{}/v1/models", base_url);

    let resp = match client.get(&url).send().await {
        Ok(r) if r.status().is_success() => r,
        _ => return Vec::new(),
    };

    let body: serde_json::Value = match resp.json().await {
        Ok(v) => v,
        Err(_) => return Vec::new(),
    };

    let models = body.get("data")
        .and_then(|d| d.as_array())
        .map(|arr| {
            arr.iter().filter_map(|m| {
                let id_str = m.get("id")?.as_str()?.to_string();
                Some(LocalLlmModel {
                    id: uuid::Uuid::new_v4().to_string(),
                    endpoint_id: String::new(),
                    model_name: id_str,
                    model_size: None,
                    parameter_count: None,
                })
            }).collect()
        })
        .unwrap_or_default();

    models
}

/// Save detected endpoint + models to DB
fn save_endpoint(
    db: &Database,
    name: &str,
    base_url: &str,
    api_type: &str,
    models: &[LocalLlmModel],
) -> Result<(), String> {
    let now = chrono::Utc::now().to_rfc3339();

    db.write(|conn| {
        // Upsert endpoint
        let endpoint_id: String = match conn.query_row(
            "SELECT id FROM local_llm_endpoints WHERE base_url = ?1",
            rusqlite::params![base_url],
            |row| row.get(0),
        ) {
            Ok(id) => {
                conn.execute(
                    "UPDATE local_llm_endpoints SET is_active = 1, last_seen_at = ?2 WHERE id = ?1",
                    rusqlite::params![id, now],
                )?;
                id
            }
            Err(_) => {
                let id = uuid::Uuid::new_v4().to_string();
                conn.execute(
                    "INSERT INTO local_llm_endpoints (id, name, base_url, api_type, is_active, last_seen_at, created_at)
                     VALUES (?1, ?2, ?3, ?4, 1, ?5, ?6)",
                    rusqlite::params![id, name, base_url, api_type, now, now],
                )?;
                id
            }
        };

        // Clear old models for this endpoint
        conn.execute(
            "DELETE FROM local_llm_models WHERE endpoint_id = ?1",
            rusqlite::params![endpoint_id],
        )?;

        // Insert fresh model list
        for model in models {
            conn.execute(
                "INSERT INTO local_llm_models (id, endpoint_id, model_name, model_size, parameter_count, last_seen_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                rusqlite::params![
                    uuid::Uuid::new_v4().to_string(),
                    endpoint_id,
                    model.model_name,
                    model.model_size,
                    model.parameter_count,
                    now,
                ],
            )?;
        }

        Ok(())
    })
}

/// Get saved local LLM endpoints from DB
pub fn get_endpoints(db: &Database) -> Result<Vec<LocalLlmEndpoint>, String> {
    db.read(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, name, base_url, api_type, is_active, last_seen_at
             FROM local_llm_endpoints
             ORDER BY name ASC",
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(LocalLlmEndpoint {
                id: row.get(0)?,
                name: row.get(1)?,
                base_url: row.get(2)?,
                api_type: row.get(3)?,
                is_active: row.get(4)?,
                last_seen_at: row.get(5)?,
            })
        })?;

        rows.collect::<Result<Vec<_>, _>>()
    })
}

fn format_bytes(bytes: u64) -> String {
    if bytes >= 1_073_741_824 {
        format!("{:.1} GB", bytes as f64 / 1_073_741_824.0)
    } else if bytes >= 1_048_576 {
        format!("{:.1} MB", bytes as f64 / 1_048_576.0)
    } else {
        format!("{} bytes", bytes)
    }
}
