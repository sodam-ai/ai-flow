use crate::{
    db::pool::Database,
    models::agent::*,
    services::{ai_client, knowledge_base},
};
use rusqlite::params;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

const MAX_AGENT_STEPS: i64 = 20; // safety cap
const MAX_GOAL_LEN: usize = 2000;
const MAX_FEEDBACK_LEN: usize = 500;

// ─── Start agent run ──────────────────────────────────────────────────────

/// Creates a new agent run. Generates a plan via AI, then executes non-approval steps.
pub async fn start_agent_run(
    db: Arc<Database>,
    app: AppHandle,
    http_client: Arc<reqwest::Client>,
    req: StartAgentRequest,
) -> Result<AgentRun, String> {
    // Input validation
    if req.goal.trim().is_empty() || req.goal.len() > MAX_GOAL_LEN {
        return Err(format!("목표는 1~{}자여야 합니다.", MAX_GOAL_LEN));
    }

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
{\"step_type\": \"think|action|search_kb\", \"title\": \"단계 제목\", \"description\": \"설명\", \"tool_name\": null|\"search_knowledge_base\"|\"write_file\", \"tool_args\": null|{...}}

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
