use crate::{
    db::pool::Database,
    models::agent::*,
    services::{ai_client, knowledge_base},
};
use rusqlite::params;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

const MAX_AGENT_STEPS: i64 = 20; // safety cap
const MAX_AGENT_COST_USD: f64 = 2.0; // per-run cost ceiling (OWASP: resource exhaustion prevention)
const MAX_GOAL_LEN: usize = 2000;
const MAX_FEEDBACK_LEN: usize = 500;
const MAX_SEARCH_QUERY_LEN: usize = 200;
const MAX_URL_LEN: usize = 2048;
const MAX_FETCH_BYTES: usize = 50 * 1024; // 50KB response cap
const TOOL_TIMEOUT_SECS: u64 = 10;
/// Characters that can be used for prompt injection — stripped from goal before AI planning
const PROMPT_INJECTION_CHARS: &[char] = &['\x00', '\x01', '\x02', '\x03', '\x04', '\x05',
    '\x06', '\x07', '\x08', '\x0b', '\x0c', '\x0e', '\x0f', '\x10', '\x11', '\x12', '\x13',
    '\x14', '\x15', '\x16', '\x17', '\x18', '\x19', '\x1a', '\x1b', '\x1c', '\x1d', '\x1e', '\x1f'];

// ─── Start agent run ──────────────────────────────────────────────────────

/// Creates a new agent run. Generates a plan via AI, then executes non-approval steps.
pub async fn start_agent_run(
    db: Arc<Database>,
    app: AppHandle,
    http_client: Arc<reqwest::Client>,
    req: StartAgentRequest,
) -> Result<AgentRun, String> {
    // Input validation — strip control characters (prompt injection prevention, OWASP ASVS 5.2.3)
    let sanitized_goal: String = req.goal.chars()
        .filter(|c| !PROMPT_INJECTION_CHARS.contains(c))
        .collect();
    let sanitized_goal = sanitized_goal.trim().to_string();
    if sanitized_goal.is_empty() || sanitized_goal.len() > MAX_GOAL_LEN {
        return Err(format!("목표는 1~{}자여야 합니다.", MAX_GOAL_LEN));
    }
    let req = StartAgentRequest { goal: sanitized_goal, ..req };

    let provider = req.provider.unwrap_or_else(|| "anthropic".to_string());
    let model = req.model.unwrap_or_else(|| "claude-sonnet-4-6".to_string());
    let max_steps = req.max_steps.unwrap_or(10).min(MAX_AGENT_STEPS);

    // Create run record
    let run_id = db.write(|conn| {
        conn.execute(
            "INSERT INTO agent_runs (conversation_id, goal, status, provider, model)
             VALUES (?1, ?2, 'running', ?3, ?4)",
            params![req.conversation_id, req.goal.trim(), provider, model],
        )?;
        Ok(conn.last_insert_rowid())
    })?;

    // Step 1: Planning — use AI to break down the goal into steps
    let plan_steps = plan_with_ai(&http_client, &provider, &model, &req.goal, max_steps).await?;

    // Save planned steps to DB
    db.write(|conn| {
        for (i, step) in plan_steps.iter().enumerate() {
            let requires_approval = step_requires_approval(&step.step_type, &step.tool_name);
            conn.execute(
                "INSERT INTO agent_steps (run_id, step_order, step_type, title, description, tool_name, tool_args, requires_approval, approval_message, status)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, 'pending')",
                params![
                    run_id, i as i64, step.step_type, step.title, step.description,
                    step.tool_name, step.tool_args,
                    requires_approval,
                    step.approval_msg,
                ],
            )?;
        }
        conn.execute(
            "UPDATE agent_runs SET total_steps=?1 WHERE id=?2",
            params![plan_steps.len() as i64, run_id],
        )?;
        Ok(())
    })?;

    let _ = app.emit(
        "aiflow://agent-started",
        serde_json::json!({ "run_id": run_id, "total_steps": plan_steps.len() }),
    );

    // Execute steps until we hit an approval gate or finish
    execute_steps(&db, &app, &http_client, run_id, req.kb_ids.as_deref()).await?;

    get_agent_run(&db, run_id)
}

/// Resume execution after an approval decision
pub async fn resume_agent_run(
    db: Arc<Database>,
    app: AppHandle,
    http_client: Arc<reqwest::Client>,
    run_id: i64,
) -> Result<AgentRun, String> {
    let run = get_agent_run(&db, run_id)?;
    if run.status == "completed" || run.status == "failed" || run.status == "cancelled" {
        return Err("이 에이전트 실행은 이미 종료되었습니다.".into());
    }

    execute_steps(&db, &app, &http_client, run_id, None).await?;
    get_agent_run(&db, run_id)
}

/// Approve or deny a step at an approval gate
pub fn approve_step(db: &Arc<Database>, req: ApproveAgentStepRequest) -> Result<AgentStep, String> {
    if req.approved {
        if let Some(fb) = &req.feedback {
            if fb.len() > MAX_FEEDBACK_LEN {
                return Err(format!("피드백은 {}자 이하여야 합니다.", MAX_FEEDBACK_LEN));
            }
        }
    }

    let conn = db.get_conn().map_err(|e| e.to_string())?;
    let new_status = if req.approved { "pending" } else { "skipped" };
    conn.execute(
        "UPDATE agent_steps SET approved=?1, approved_at=datetime('now'), status=?2 WHERE id=?3 AND run_id=?4",
        params![req.approved as i64, new_status, req.step_id, req.run_id],
    )
    .map_err(|e| e.to_string())?;

    if !req.approved {
        // Mark run as still running (skip this step)
        conn.execute(
            "UPDATE agent_runs SET status='running' WHERE id=?1 AND status='awaiting_approval'",
            params![req.run_id],
        )
        .map_err(|e| e.to_string())?;
    }

    get_agent_step(&conn, req.step_id)
}

pub fn cancel_agent_run(db: &Arc<Database>, run_id: i64) -> Result<(), String> {
    let conn = db.get_conn().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE agent_runs SET status='cancelled', completed_at=datetime('now') WHERE id=?1",
        params![run_id],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE agent_steps SET status='skipped' WHERE run_id=?1 AND status IN ('pending', 'awaiting_approval')",
        params![run_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// ─── Queries ──────────────────────────────────────────────────────────────

pub fn list_agent_runs(db: &Arc<Database>) -> Result<Vec<AgentRun>, String> {
    let conn = db.get_conn().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id FROM agent_runs ORDER BY started_at DESC LIMIT 50",
        )
        .map_err(|e| e.to_string())?;

    let ids: Vec<i64> = stmt
        .query_map([], |r| r.get(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    ids.iter().map(|&id| get_agent_run(db, id)).collect()
}

pub fn get_agent_run(db: &Arc<Database>, run_id: i64) -> Result<AgentRun, String> {
    let conn = db.get_conn().map_err(|e| e.to_string())?;

    let run = conn
        .query_row(
            "SELECT id, conversation_id, goal, status, provider, model, total_steps,
                    completed_steps, total_cost_usd, final_output, error_msg, started_at, completed_at
             FROM agent_runs WHERE id=?1",
            params![run_id],
            |row| {
                Ok(AgentRun {
                    id: row.get(0)?,
                    conversation_id: row.get(1)?,
                    goal: row.get(2)?,
                    status: row.get(3)?,
                    provider: row.get(4)?,
                    model: row.get(5)?,
                    total_steps: row.get(6)?,
                    completed_steps: row.get(7)?,
                    total_cost_usd: row.get(8)?,
                    final_output: row.get(9)?,
                    error_msg: row.get(10)?,
                    started_at: row.get(11)?,
                    completed_at: row.get(12)?,
                    steps: vec![],
                })
            },
        )
        .map_err(|e| format!("에이전트 실행을 찾을 수 없습니다: {}", e))?;

    let mut step_stmt = conn
        .prepare(
            "SELECT id, run_id, step_order, step_type, title, description, input_text, output_text,
                    tool_name, tool_args, tool_result, requires_approval, approval_message,
                    approved, status, cost_usd, tokens_in, tokens_out, started_at, completed_at
             FROM agent_steps WHERE run_id=?1 ORDER BY step_order ASC",
        )
        .map_err(|e| e.to_string())?;

    let steps: Vec<AgentStep> = step_stmt
        .query_map(params![run_id], |row| {
            Ok(AgentStep {
                id: row.get(0)?,
                run_id: row.get(1)?,
                step_order: row.get(2)?,
                step_type: row.get(3)?,
                title: row.get(4)?,
                description: row.get(5)?,
                input_text: row.get(6)?,
                output_text: row.get(7)?,
                tool_name: row.get(8)?,
                tool_args: row.get(9)?,
                tool_result: row.get(10)?,
                requires_approval: row.get::<_, i64>(11)? == 1,
                approval_message: row.get(12)?,
                approved: row.get::<_, Option<i64>>(13)?.map(|v| v == 1),
                status: row.get(14)?,
                cost_usd: row.get(15)?,
                tokens_in: row.get(16)?,
                tokens_out: row.get(17)?,
                started_at: row.get(18)?,
                completed_at: row.get(19)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(AgentRun { steps, ..run })
}

// ─── Conversation Branching ───────────────────────────────────────────────

pub fn create_branch(
    db: &Arc<Database>,
    req: CreateBranchRequest,
) -> Result<ConversationBranch, String> {
    // Input validation (OWASP ASVS 5.1.3)
    if let Some(ref label) = req.label {
        let trimmed = label.trim();
        if trimmed.len() > 50 {
            return Err("브랜치 레이블은 50자 이하여야 합니다.".into());
        }
    }
    if req.parent_conversation_id.is_empty() || req.fork_message_id.is_empty() {
        return Err("유효하지 않은 브랜치 요청입니다.".into());
    }

    // Generate a new conversation ID for the branch
    let branch_id = uuid::Uuid::new_v4().to_string();

    // Copy messages from parent up to (and including) the fork point
    let conn = db.get_conn().map_err(|e| e.to_string())?;

    // Get messages up to fork point
    let mut msg_stmt = conn
        .prepare(
            "SELECT id, role, content, input_tokens, output_tokens, cost_usd, created_at
             FROM messages WHERE conversation_id=?1 ORDER BY created_at ASC",
        )
        .map_err(|e| e.to_string())?;

    let messages: Vec<(String, String, String, Option<i64>, Option<i64>, Option<f64>, String)> =
        msg_stmt
            .query_map(params![req.parent_conversation_id], |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                    row.get(5)?,
                    row.get(6)?,
                ))
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .collect();

    // Create the branch conversation
    conn.execute(
        "INSERT INTO conversations (id, title, provider_id, model_id, created_at, updated_at)
         SELECT ?1, title || ' (브랜치)', provider_id, model_id, datetime('now'), datetime('now')
         FROM conversations WHERE id=?2",
        params![branch_id, req.parent_conversation_id],
    )
    .map_err(|e| e.to_string())?;

    // Copy messages up to fork point
    let mut copied = 0i64;
    for msg in &messages {
        let new_msg_id = uuid::Uuid::new_v4().to_string();
        conn.execute(
            "INSERT INTO messages (id, conversation_id, role, content, input_tokens, output_tokens, cost_usd, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![new_msg_id, branch_id, msg.1, msg.2, msg.3, msg.4, msg.5, msg.6],
        )
        .map_err(|e| e.to_string())?;

        copied += 1;
        if msg.0 == req.fork_message_id {
            break;
        }
    }

    // Record the branch relationship
    conn.execute(
        "INSERT INTO conversation_branches
         (parent_conversation_id, branch_conversation_id, fork_message_id, fork_message_index, label)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        params![
            req.parent_conversation_id,
            branch_id,
            req.fork_message_id,
            req.fork_message_index,
            req.label
        ],
    )
    .map_err(|e| e.to_string())?;

    let branch_db_id = conn.last_insert_rowid();
    let _ = copied;

    conn.query_row(
        "SELECT id, parent_conversation_id, branch_conversation_id, fork_message_id,
                fork_message_index, label, created_at
         FROM conversation_branches WHERE id=?1",
        params![branch_db_id],
        |row| {
            Ok(ConversationBranch {
                id: row.get(0)?,
                parent_conversation_id: row.get(1)?,
                branch_conversation_id: row.get(2)?,
                fork_message_id: row.get(3)?,
                fork_message_index: row.get(4)?,
                label: row.get(5)?,
                created_at: row.get(6)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

pub fn list_branches(
    db: &Arc<Database>,
    conversation_id: &str,
) -> Result<Vec<ConversationBranch>, String> {
    let conn = db.get_conn().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, parent_conversation_id, branch_conversation_id, fork_message_id,
                    fork_message_index, label, created_at
             FROM conversation_branches WHERE parent_conversation_id=?1 ORDER BY created_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map(params![conversation_id], |row| {
            Ok(ConversationBranch {
                id: row.get(0)?,
                parent_conversation_id: row.get(1)?,
                branch_conversation_id: row.get(2)?,
                fork_message_id: row.get(3)?,
                fork_message_index: row.get(4)?,
                label: row.get(5)?,
                created_at: row.get(6)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(rows)
}

// ─── Internal execution engine ─────────────────────────────────────────────

async fn execute_steps(
    db: &Arc<Database>,
    app: &AppHandle,
    http_client: &Arc<reqwest::Client>,
    run_id: i64,
    kb_ids: Option<&[i64]>,
) -> Result<(), String> {
    loop {
        // Get next pending step
        use rusqlite::OptionalExtension;
        let next_step: Option<(i64, String, String, Option<String>, i64, Option<String>)> =
            db.read(|conn| {
                conn.query_row(
                    "SELECT id, step_type, title, tool_name, requires_approval, tool_args
                     FROM agent_steps WHERE run_id=?1 AND status='pending' ORDER BY step_order ASC LIMIT 1",
                    params![run_id],
                    |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?)),
                )
                .optional()
            })?;

        let (step_id, step_type, title, tool_name, requires_approval, tool_args) = match next_step {
            Some(s) => s,
            None => {
                // All steps done — finalize
                finalize_run(db, run_id).await?;
                return Ok(());
            }
        };

        // Cost ceiling check (OWASP: resource exhaustion prevention)
        let current_cost: f64 = db.read(|conn| {
            conn.query_row(
                "SELECT total_cost_usd FROM agent_runs WHERE id=?1",
                params![run_id],
                |r| r.get(0),
            )
        })?;
        if current_cost >= MAX_AGENT_COST_USD {
            db.write(|conn| {
                conn.execute(
                    "UPDATE agent_runs SET status='failed', error_msg='비용 상한($2.00)에 도달하여 실행을 중단했습니다.', completed_at=datetime('now') WHERE id=?1",
                    params![run_id],
                )?;
                conn.execute(
                    "UPDATE agent_steps SET status='skipped' WHERE run_id=?1 AND status IN ('pending','awaiting_approval')",
                    params![run_id],
                )?;
                Ok(())
            })?;
            let _ = app.emit("aiflow://agent-cost-limit", serde_json::json!({ "run_id": run_id }));
            return Ok(());
        }

        // Check if approval needed
        if requires_approval == 1 {
            db.write(|conn| {
                conn.execute(
                    "UPDATE agent_steps SET status='awaiting_approval' WHERE id=?1",
                    params![step_id],
                )?;
                conn.execute(
                    "UPDATE agent_runs SET status='awaiting_approval' WHERE id=?1",
                    params![run_id],
                )?;
                Ok(())
            })?;

            let _ = app.emit(
                "aiflow://agent-approval-needed",
                serde_json::json!({
                    "run_id": run_id,
                    "step_id": step_id,
                    "title": title,
                    "tool_name": tool_name,
                }),
            );
            return Ok(()); // Pause; resumed via resume_agent_run
        }

        // Execute the step
        db.write(|conn| {
            conn.execute(
                "UPDATE agent_steps SET status='running', started_at=datetime('now') WHERE id=?1",
                params![step_id],
            )?;
            Ok(())
        })?;

        let _ = app.emit(
            "aiflow://agent-step-started",
            serde_json::json!({ "run_id": run_id, "step_id": step_id, "title": title }),
        );

        let (output, cost, tok_in, tok_out) = match step_type.as_str() {
            "write_file" => {
                // Secure file write — absolute path required, system dirs blocked
                let args: serde_json::Value = serde_json::from_str(
                    tool_args.as_deref().unwrap_or("{}"),
                ).unwrap_or_default();
                let file_path = args.get("path").and_then(|v| v.as_str()).unwrap_or("").trim();
                let content = args.get("content").and_then(|v| v.as_str()).unwrap_or("");

                let result = if file_path.is_empty() {
                    "오류: 파일 경로가 없습니다.".to_string()
                } else {
                    let path = std::path::Path::new(file_path);
                    if !path.is_absolute() {
                        "오류: 절대 경로가 필요합니다.".to_string()
                    } else {
                        // Block system directories (path security, Secure by Design)
                        let lower = file_path.to_lowercase();
                        let blocked = [
                            "\\windows\\system", "/windows/system", "\\system32", "/system32",
                            "\\syswow64", "/syswow64", "/etc/", "/usr/", "/bin/", "/sbin/",
                        ];
                        if blocked.iter().any(|b| lower.contains(b)) {
                            "오류: 시스템 디렉터리에는 쓸 수 없습니다.".to_string()
                        } else {
                            // Ensure parent directory exists
                            if let Some(parent) = path.parent() {
                                let _ = std::fs::create_dir_all(parent);
                            }
                            match std::fs::write(file_path, content) {
                                Ok(_) => format!("파일 작성 완료: {} ({} bytes)", file_path, content.len()),
                                Err(e) => format!("파일 작성 실패: {}", e),
                            }
                        }
                    }
                };
                (result, 0.0, 0i64, 0i64)
            }
            "search_kb" => {
                let query = tool_args
                    .as_deref()
                    .and_then(|a| serde_json::from_str::<serde_json::Value>(a).ok())
                    .and_then(|v| v.get("query").and_then(|q| q.as_str()).map(String::from))
                    .unwrap_or_else(|| title.clone());

                let kb_id = kb_ids.and_then(|ids| ids.first().copied());
                let results = knowledge_base::search_kb(
                    db,
                    crate::models::knowledge_base::SearchKbRequest {
                        kb_id,
                        query,
                        limit: Some(5),
                    },
                )
                .unwrap_or_default();

                let result_text = results
                    .iter()
                    .enumerate()
                    .map(|(i, r)| format!("[{}] {} — {}", i + 1, r.filename, r.snippet))
                    .collect::<Vec<_>>()
                    .join("\n");

                (result_text, 0.0, 0i64, 0i64)
            }
            "search_web" => {
                // Web search via DuckDuckGo Instant Answer (no API key required)
                let query = tool_args
                    .as_deref()
                    .and_then(|a| serde_json::from_str::<serde_json::Value>(a).ok())
                    .and_then(|v| v.get("query").and_then(|q| q.as_str()).map(String::from))
                    .unwrap_or_else(|| title.clone());
                // Strip control characters (OWASP ASVS 5.2.3)
                let safe_query: String = query.chars()
                    .filter(|c| !c.is_control())
                    .take(MAX_SEARCH_QUERY_LEN)
                    .collect();
                let result = if safe_query.trim().is_empty() {
                    "오류: 검색어가 없습니다.".to_string()
                } else {
                    web_search(http_client, safe_query.trim()).await
                };
                (result, 0.0, 0i64, 0i64)
            }
            "read_url" => {
                // Fetch URL content with SSRF defense (OWASP ASVS 4.3.2, CWE-918)
                let url = tool_args
                    .as_deref()
                    .and_then(|a| serde_json::from_str::<serde_json::Value>(a).ok())
                    .and_then(|v| v.get("url").and_then(|u| u.as_str()).map(String::from))
                    .unwrap_or_default();
                let result = fetch_url_content(http_client, url.trim()).await;
                (result, 0.0, 0i64, 0i64)
            }
            "think" | "action" | _ => {
                // AI call for this step
                let run = get_agent_run(db, run_id)?;
                let prior_output = run
                    .steps
                    .iter()
                    .filter(|s| s.status == "completed")
                    .last()
                    .and_then(|s| s.output_text.clone())
                    .unwrap_or_default();

                let prompt = format!(
                    "Task: {}\nStep: {}\nPrevious context: {}\n\nExecute this step.",
                    run.goal, title, prior_output
                );

                let msgs = vec![serde_json::json!({ "role": "user", "content": prompt })];
                match ai_client::call_ai_non_stream(http_client, &run.provider, &run.model, None, &msgs).await {
                    Ok((text, usage)) => {
                        let ti = usage.get("prompt_tokens").and_then(|v| v.as_i64()).unwrap_or(0);
                        let to = usage.get("completion_tokens").and_then(|v| v.as_i64()).unwrap_or(0);
                        let c = ai_client::estimate_cost(&run.provider, &run.model, ti as i32, to as i32);
                        (text, c, ti, to)
                    }
                    Err(e) => {
                        mark_step_failed(db, step_id, run_id, &e)?;
                        let _ = app.emit("aiflow://agent-step-failed", serde_json::json!({ "run_id": run_id, "step_id": step_id, "error": e }));
                        return Ok(());
                    }
                }
            }
        };

        // Save result
        db.write(|conn| {
            conn.execute(
                "UPDATE agent_steps SET status='completed', output_text=?1, cost_usd=?2,
                         tokens_in=?3, tokens_out=?4, completed_at=datetime('now') WHERE id=?5",
                params![output, cost, tok_in, tok_out, step_id],
            )?;
            conn.execute(
                "UPDATE agent_runs SET completed_steps=completed_steps+1, total_cost_usd=total_cost_usd+?1 WHERE id=?2",
                params![cost, run_id],
            )?;
            Ok(())
        })?;

        let _ = app.emit(
            "aiflow://agent-step-completed",
            serde_json::json!({ "run_id": run_id, "step_id": step_id, "output": output }),
        );
    }
}

async fn finalize_run(db: &Arc<Database>, run_id: i64) -> Result<(), String> {
    use rusqlite::OptionalExtension;
    let final_output: Option<String> = db.read(|conn| {
        conn.query_row(
            "SELECT output_text FROM agent_steps WHERE run_id=?1 AND status='completed' ORDER BY step_order DESC LIMIT 1",
            params![run_id],
            |row| row.get(0),
        )
        .optional()
    })?.flatten();

    db.write(|conn| {
        conn.execute(
            "UPDATE agent_runs SET status='completed', final_output=?1, completed_at=datetime('now') WHERE id=?2",
            params![final_output, run_id],
        )?;
        Ok(())
    })
}

fn mark_step_failed(db: &Arc<Database>, step_id: i64, run_id: i64, error: &str) -> Result<(), String> {
    db.write(|conn| {
        conn.execute(
            "UPDATE agent_steps SET status='failed', completed_at=datetime('now') WHERE id=?1",
            params![step_id],
        )?;
        conn.execute(
            "UPDATE agent_runs SET status='failed', error_msg=?1, completed_at=datetime('now') WHERE id=?2",
            params![error, run_id],
        )?;
        Ok(())
    })
}

fn get_agent_step(conn: &rusqlite::Connection, step_id: i64) -> Result<AgentStep, String> {
    conn.query_row(
        "SELECT id, run_id, step_order, step_type, title, description, input_text, output_text,
                tool_name, tool_args, tool_result, requires_approval, approval_message,
                approved, status, cost_usd, tokens_in, tokens_out, started_at, completed_at
         FROM agent_steps WHERE id=?1",
        params![step_id],
        |row| {
            Ok(AgentStep {
                id: row.get(0)?,
                run_id: row.get(1)?,
                step_order: row.get(2)?,
                step_type: row.get(3)?,
                title: row.get(4)?,
                description: row.get(5)?,
                input_text: row.get(6)?,
                output_text: row.get(7)?,
                tool_name: row.get(8)?,
                tool_args: row.get(9)?,
                tool_result: row.get(10)?,
                requires_approval: row.get::<_, i64>(11)? == 1,
                approval_message: row.get(12)?,
                approved: row.get::<_, Option<i64>>(13)?.map(|v| v == 1),
                status: row.get(14)?,
                cost_usd: row.get(15)?,
                tokens_in: row.get(16)?,
                tokens_out: row.get(17)?,
                started_at: row.get(18)?,
                completed_at: row.get(19)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

fn step_requires_approval(step_type: &str, tool_name: &Option<String>) -> i64 {
    match step_type {
        "action" => {
            if let Some(tool) = tool_name {
                match tool.as_str() {
                    "write_file" | "run_workflow" => 1,
                    _ => 0,
                }
            } else {
                0
            }
        }
        _ => 0,
    }
}

// ─── AI Planning ──────────────────────────────────────────────────────────

struct PlannedStep {
    step_type: String,
    title: String,
    description: Option<String>,
    tool_name: Option<String>,
    tool_args: Option<String>,
    approval_msg: Option<String>,
}

async fn plan_with_ai(
    http_client: &Arc<reqwest::Client>,
    provider: &str,
    model: &str,
    goal: &str,
    max_steps: i64,
) -> Result<Vec<PlannedStep>, String> {
    let system = "당신은 AI 에이전트 플래너입니다. 주어진 목표를 달성하기 위한 단계를 JSON 배열로 반환하세요.
각 단계는 다음 형식을 따릅니다:
{\"step_type\": \"think|search_web|read_url|search_kb|write_file|action\", \"title\": \"단계 제목\", \"description\": \"설명\", \"tool_name\": null|\"search_web\"|\"read_url\"|\"write_file\"|\"search_kb\", \"tool_args\": null|{...}}

사용 가능한 도구:
- search_web: 웹 검색 {\"query\": \"검색어\"}
- read_url: URL 페이지 읽기 {\"url\": \"https://...\"}  (https만 가능)
- search_kb: 지식베이스 검색 {\"query\": \"검색어\"}
- write_file: 파일 쓰기 {\"path\": \"/절대/경로\", \"content\": \"내용\"} (승인 필요)

최대 단계 수는 제한이 있습니다. 반드시 JSON 배열만 반환하세요.";

    let prompt = format!("목표: {}\n최대 {} 단계로 계획을 세우세요.", goal, max_steps);

    let msgs = vec![serde_json::json!({ "role": "user", "content": prompt })];
    let (response, _) =
        ai_client::call_ai_non_stream(http_client, provider, model, Some(system), &msgs).await?;

    // Parse JSON response — extract array from response
    let json_start = response.find('[').unwrap_or(0);
    let json_end = response.rfind(']').map(|i| i + 1).unwrap_or(response.len());
    let json_str = &response[json_start..json_end];

    let parsed: Vec<serde_json::Value> =
        serde_json::from_str(json_str).unwrap_or_else(|_| {
            // Fallback: single step
            vec![serde_json::json!({
                "step_type": "think",
                "title": goal,
                "description": "목표 달성을 위해 분석합니다."
            })]
        });

    let steps = parsed
        .into_iter()
        .take(max_steps as usize)
        .map(|v| PlannedStep {
            step_type: v
                .get("step_type")
                .and_then(|s| s.as_str())
                .unwrap_or("think")
                .to_string(),
            title: v
                .get("title")
                .and_then(|s| s.as_str())
                .unwrap_or("단계")
                .to_string(),
            description: v
                .get("description")
                .and_then(|s| s.as_str())
                .map(String::from),
            tool_name: v
                .get("tool_name")
                .and_then(|s| s.as_str())
                .filter(|s| !s.is_empty())
                .map(String::from),
            tool_args: v
                .get("tool_args")
                .filter(|a| !a.is_null())
                .map(|a| a.to_string()),
            approval_msg: None,
        })
        .collect();

    Ok(steps)
}

// ─── Web Tools ────────────────────────────────────────────────────────────

/// DuckDuckGo Instant Answer API search (no API key required)
/// Sanitizes query and enforces timeout (OWASP ASVS 4.3.2)
async fn web_search(http_client: &reqwest::Client, query: &str) -> String {
    use std::time::Duration;

    let resp = match tokio::time::timeout(
        Duration::from_secs(TOOL_TIMEOUT_SECS),
        http_client
            .get("https://api.duckduckgo.com/")
            .query(&[
                ("q", query),
                ("format", "json"),
                ("no_html", "1"),
                ("skip_disambig", "1"),
                ("no_redirect", "1"),
            ])
            .header("User-Agent", "AIFlow/1.0 (desktop; info-only)")
            .send(),
    )
    .await
    {
        Ok(Ok(r)) => r,
        Ok(Err(e)) => return format!("검색 요청 실패: {}", e),
        Err(_) => return format!("검색 타임아웃 ({}초)", TOOL_TIMEOUT_SECS),
    };

    let text = match tokio::time::timeout(Duration::from_secs(5), resp.text()).await {
        Ok(Ok(t)) => t,
        _ => return "검색 응답 읽기 실패".to_string(),
    };

    let json: serde_json::Value = match serde_json::from_str(&text) {
        Ok(v) => v,
        Err(_) => return "검색 응답 파싱 실패".to_string(),
    };

    let mut results: Vec<String> = Vec::new();

    if let Some(v) = json.get("Answer").and_then(|v| v.as_str()).filter(|s| !s.is_empty()) {
        results.push(format!("답변: {}", v));
    }
    if let Some(v) = json.get("AbstractText").and_then(|v| v.as_str()).filter(|s| !s.is_empty()) {
        results.push(format!("요약: {}", v));
    }
    if let Some(v) = json.get("Definition").and_then(|v| v.as_str()).filter(|s| !s.is_empty()) {
        results.push(format!("정의: {}", v));
    }
    if let Some(topics) = json.get("RelatedTopics").and_then(|v| v.as_array()) {
        for topic in topics.iter().take(5) {
            if let Some(t) = topic.get("Text").and_then(|v| v.as_str()).filter(|s| !s.is_empty()) {
                results.push(format!("• {}", t));
            }
        }
    }

    if results.is_empty() {
        format!("'{}' 에 대한 즉시 답변을 찾을 수 없습니다.", query)
    } else {
        results.join("\n")
    }
}

/// Fetch URL content with SSRF defense (OWASP ASVS 4.3.2, CWE-918)
/// - https:// only; private/reserved IPs blocked
/// - 50KB response cap; 10s timeout
async fn fetch_url_content(http_client: &reqwest::Client, url: &str) -> String {
    use std::time::Duration;

    // Scheme guard — https only
    if !url.starts_with("https://") {
        return "오류: https:// URL만 허용됩니다 (보안 정책).".to_string();
    }
    if url.len() > MAX_URL_LEN {
        return format!("오류: URL이 너무 깁니다 (최대 {}자).", MAX_URL_LEN);
    }

    // Extract hostname for SSRF hostname-level check
    let hostname = match extract_url_hostname(url) {
        Some(h) => h,
        None => return "오류: URL 파싱 실패 (호스트명 없음).".to_string(),
    };
    if is_ssrf_blocked_host(&hostname) {
        return "오류: 내부/사설 주소 접근은 보안 정책에 의해 차단됩니다.".to_string();
    }

    let resp = match tokio::time::timeout(
        Duration::from_secs(TOOL_TIMEOUT_SECS),
        http_client
            .get(url)
            .header("User-Agent", "AIFlow/1.0 (desktop; info-only)")
            .header("Accept", "text/html,text/plain;q=0.9,*/*;q=0.8")
            // Prevent tracking via Referer
            .header("Referer", "")
            .send(),
    )
    .await
    {
        Ok(Ok(r)) => r,
        Ok(Err(e)) => return format!("URL 요청 실패: {}", e),
        Err(_) => return format!("URL 요청 타임아웃 ({}초).", TOOL_TIMEOUT_SECS),
    };

    // Post-redirect SSRF check: verify final URL still safe
    let final_url = resp.url().to_string();
    if let Some(final_host) = extract_url_hostname(&final_url) {
        if is_ssrf_blocked_host(&final_host) {
            return "오류: 리다이렉트 후 내부 주소 접근이 감지되어 차단됩니다.".to_string();
        }
    }

    let bytes = match tokio::time::timeout(Duration::from_secs(TOOL_TIMEOUT_SECS), resp.bytes()).await {
        Ok(Ok(b)) => b,
        _ => return "응답 본문 읽기 실패 또는 타임아웃.".to_string(),
    };

    // Apply 50KB cap
    let slice = if bytes.len() > MAX_FETCH_BYTES { &bytes[..MAX_FETCH_BYTES] } else { &bytes[..] };
    let raw = String::from_utf8_lossy(slice).into_owned();
    let text = strip_html_to_text(&raw);

    if text.trim().is_empty() {
        "페이지에서 텍스트 콘텐츠를 추출하지 못했습니다.".to_string()
    } else {
        let truncated: String = text.chars().take(3000).collect();
        format!("[출처: {}]\n\n{}", url, truncated)
    }
}

/// Extract lowercase hostname from an https:// URL (byte-safe)
fn extract_url_hostname(url: &str) -> Option<String> {
    let without_scheme = url.strip_prefix("https://")?;
    let host_and_port = without_scheme.split('/').next()?;
    let hostname = host_and_port.split(':').next()?.trim();
    if hostname.is_empty() { None } else { Some(hostname.to_lowercase()) }
}

/// Block private/reserved/cloud-metadata hosts (SSRF, CWE-918, RFC 6890)
fn is_ssrf_blocked_host(host: &str) -> bool {
    // Exact & prefix matches for common private/loopback/metadata
    let block_prefixes = [
        "localhost", "127.", "0.0.0.0", "0.",
        "10.", "192.168.", "169.254.",       // RFC 1918 + link-local
        "fc00:", "fd",                        // IPv6 ULA
        "::1", "0:0:0:0:0:0:0:1",
        "metadata.google.internal", "metadata.goog",
    ];
    if block_prefixes.iter().any(|p| host.starts_with(p)) {
        return true;
    }
    // 172.16.0.0/12 (172.16.x.x – 172.31.x.x)
    if let Some(rest) = host.strip_prefix("172.") {
        let second_octet = rest.split('.').next().unwrap_or("");
        if let Ok(n) = second_octet.parse::<u8>() {
            if (16..=31).contains(&n) {
                return true;
            }
        }
    }
    false
}

/// Strip HTML tags and common entities to plain text
fn strip_html_to_text(html: &str) -> String {
    // Remove <script> blocks
    let html = remove_between_tags(html, "<script", "</script>");
    // Remove <style> blocks
    let html = remove_between_tags(&html, "<style", "</style>");
    // Remove HTML comments
    let html = remove_between_tags(&html, "<!--", "-->");
    // Remove <head> block
    let html = remove_between_tags(&html, "<head", "</head>");

    // Strip remaining tags, inserting spaces for block elements
    let mut out = String::with_capacity(html.len());
    let mut in_tag = false;
    let mut prev_space = true;
    let bytes = html.as_bytes();
    let mut i = 0;
    while i < bytes.len() {
        let ch = bytes[i] as char;
        match ch {
            '<' => { in_tag = true; out.push(' '); }
            '>' => { in_tag = false; out.push(' '); }
            _ if in_tag => {}
            '\n' | '\r' | '\t' | ' ' => {
                if !prev_space { out.push(' '); prev_space = true; }
            }
            c => { out.push(c); prev_space = false; }
        }
        i += 1;
    }

    // Decode common HTML entities
    let out = out
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&apos;", "'")
        .replace("&nbsp;", " ");

    // Collapse multiple spaces into one and trim lines
    out.split_whitespace()
        .collect::<Vec<_>>()
        .chunks(15) // approximate line-break every ~15 words
        .map(|words| words.join(" "))
        .collect::<Vec<_>>()
        .join("\n")
}

/// Remove content between two tag markers (case-insensitive open tag match)
fn remove_between_tags(html: &str, open: &str, close: &str) -> String {
    let lower_html = html.to_ascii_lowercase();
    let lower_open = open.to_ascii_lowercase();
    let lower_close = close.to_ascii_lowercase();
    let mut result = String::with_capacity(html.len());
    let mut pos = 0usize;

    while pos < html.len() {
        match lower_html[pos..].find(&lower_open) {
            None => {
                result.push_str(&html[pos..]);
                break;
            }
            Some(rel) => {
                let abs = pos + rel;
                result.push_str(&html[pos..abs]);
                match lower_html[abs..].find(&lower_close) {
                    None => break, // truncate rest
                    Some(end_rel) => {
                        pos = abs + end_rel + lower_close.len();
                    }
                }
            }
        }
    }
    result
}
