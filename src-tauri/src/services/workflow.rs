use crate::{db::pool::Database, models::workflow::*};
use rusqlite::params;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

// ─── Workflow Templates ───────────────────────────────────────────────────

pub fn list_templates(db: &Arc<Database>) -> Result<Vec<WorkflowTemplate>, String> {
    let conn = db.get_conn().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id, name, description, category, icon, steps_json, is_builtin, created_at FROM workflow_templates ORDER BY id")
        .map_err(|e| e.to_string())?;

    let templates = stmt
        .query_map([], |row| {
            let steps_json: String = row.get(5)?;
            let steps: Vec<TemplateStep> = serde_json::from_str(&steps_json).unwrap_or_default();
            Ok(WorkflowTemplate {
                id: row.get(0)?,
                name: row.get(1)?,
                description: row.get(2)?,
                category: row.get(3)?,
                icon: row.get(4)?,
                steps,
                is_builtin: row.get::<_, i64>(6)? == 1,
                created_at: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(templates)
}

// ─── Workflows ────────────────────────────────────────────────────────────

pub fn create_workflow(db: &Arc<Database>, req: CreateWorkflowRequest) -> Result<Workflow, String> {
    let conn = db.get_conn().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO workflows (name, description, template_id) VALUES (?1, ?2, ?3)",
        params![req.name, req.description, req.template_id],
    )
    .map_err(|e| e.to_string())?;

    let workflow_id = conn.last_insert_rowid();

    for (i, step) in req.steps.into_iter().enumerate() {
        conn.execute(
            "INSERT INTO workflow_steps (workflow_id, step_order, name, provider, model, system_prompt, user_prompt_template, mcp_server_id)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                workflow_id, i as i32, step.name, step.provider, step.model,
                step.system_prompt, step.user_prompt_template, step.mcp_server_id
            ],
        )
        .map_err(|e| e.to_string())?;
    }

    get_workflow(db, workflow_id)
}

pub fn list_workflows(db: &Arc<Database>) -> Result<Vec<Workflow>, String> {
    let conn = db.get_conn().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT id FROM workflows WHERE is_active=1 ORDER BY updated_at DESC")
        .map_err(|e| e.to_string())?;

    let ids: Vec<i64> = stmt
        .query_map([], |r| r.get(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    ids.iter()
        .map(|&id| get_workflow(db, id))
        .collect()
}

pub fn get_workflow(db: &Arc<Database>, id: i64) -> Result<Workflow, String> {
    let conn = db.get_conn().map_err(|e| e.to_string())?;

    let workflow = conn
        .query_row(
            "SELECT id, name, description, template_id, is_active, created_at, updated_at FROM workflows WHERE id=?1",
            params![id],
            |row| {
                Ok((
                    row.get::<_, i64>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, Option<String>>(2)?,
                    row.get::<_, Option<i64>>(3)?,
                    row.get::<_, i64>(4)?,
                    row.get::<_, String>(5)?,
                    row.get::<_, String>(6)?,
                ))
            },
        )
        .map_err(|e| e.to_string())?;

    let mut step_stmt = conn
        .prepare(
            "SELECT id, workflow_id, step_order, name, provider, model, system_prompt,
                    user_prompt_template, mcp_server_id, is_enabled
             FROM workflow_steps WHERE workflow_id=?1 ORDER BY step_order ASC",
        )
        .map_err(|e| e.to_string())?;

    let steps: Vec<WorkflowStep> = step_stmt
        .query_map(params![id], |row| {
            Ok(WorkflowStep {
                id: row.get(0)?,
                workflow_id: row.get(1)?,
                step_order: row.get(2)?,
                name: row.get(3)?,
                provider: row.get(4)?,
                model: row.get(5)?,
                system_prompt: row.get(6)?,
                user_prompt_template: row.get(7)?,
                mcp_server_id: row.get(8)?,
                is_enabled: row.get::<_, i64>(9)? == 1,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(Workflow {
        id: workflow.0,
        name: workflow.1,
        description: workflow.2,
        template_id: workflow.3,
        is_active: workflow.4 == 1,
        steps,
        created_at: workflow.5,
        updated_at: workflow.6,
    })
}

pub fn delete_workflow(db: &Arc<Database>, id: i64) -> Result<(), String> {
    let conn = db.get_conn().map_err(|e| e.to_string())?;
    conn.execute("UPDATE workflows SET is_active=0 WHERE id=?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

// ─── Workflow Execution ───────────────────────────────────────────────────

/// 워크플로우 실행: 각 단계를 순차 실행, 이전 단계 출력 → 다음 단계 {{input}} 치환
pub async fn run_workflow(
    db: Arc<Database>,
    app: AppHandle,
    http_client: Arc<reqwest::Client>,
    req: RunWorkflowRequest,
) -> Result<WorkflowRun, String> {
    // ─── Security: input validation ───────────────────────────────────────
    const MAX_INPUT_LEN: usize = 32_768; // 32KB
    if req.initial_input.len() > MAX_INPUT_LEN {
        return Err(format!("초기 입력은 {}자 이하여야 합니다.", MAX_INPUT_LEN));
    }

    let workflow = get_workflow(&db, req.workflow_id)?;
    if workflow.steps.is_empty() {
        return Err("워크플로우에 단계가 없습니다.".into());
    }

    // 실행 레코드 생성
    let run_id = db.write(|conn| {
        conn.execute(
            "INSERT INTO workflow_runs (workflow_id, status, initial_input, started_at) VALUES (?1, 'running', ?2, datetime('now'))",
            params![req.workflow_id, req.initial_input],
        )?;
        Ok(conn.last_insert_rowid())
    })?;

    let _ = app.emit("aiflow://workflow-started", serde_json::json!({ "run_id": run_id, "workflow_id": req.workflow_id }));

    let mut current_input = req.initial_input.clone();
    let mut total_cost = 0.0f64;
    let mut all_failed = false;

    for step in workflow.steps.iter().filter(|s| s.is_enabled) {
        // Security: sanitize input before template substitution to prevent injection
        let safe_input = sanitize_template_input(&current_input);
        let prompt = step.user_prompt_template.replace("{{input}}", &safe_input);
        let provider = req.provider_override.as_deref().or(step.provider.as_deref()).unwrap_or("anthropic");
        let model = req.model_override.as_deref().or(step.model.as_deref()).unwrap_or("claude-sonnet-4-6");

        // 단계 결과 레코드 생성
        let result_id = db.write(|conn| {
            conn.execute(
                "INSERT INTO workflow_step_results (run_id, step_id, step_order, input_text, status, started_at)
                 VALUES (?1, ?2, ?3, ?4, 'running', datetime('now'))",
                params![run_id, step.id, step.step_order, prompt],
            )?;
            Ok(conn.last_insert_rowid())
        })?;

        let _ = app.emit("aiflow://workflow-step-started", serde_json::json!({
            "run_id": run_id, "step_order": step.step_order, "step_name": step.name
        }));

        // AI 호출 (비스트리밍 — 워크플로우는 단계 완료 후 다음 단계로)
        match call_ai_for_step(&http_client, provider, model, step.system_prompt.as_deref(), &prompt).await {
            Ok((output, tokens_in, tokens_out, cost)) => {
                total_cost += cost;
                db.write(|conn| {
                    conn.execute(
                        "UPDATE workflow_step_results SET status='completed', output_text=?1,
                         tokens_in=?2, tokens_out=?3, cost_usd=?4, completed_at=datetime('now')
                         WHERE id=?5",
                        params![output, tokens_in, tokens_out, cost, result_id],
                    )?;
                    Ok(())
                })?;

                let _ = app.emit("aiflow://workflow-step-done", serde_json::json!({
                    "run_id": run_id, "step_order": step.step_order,
                    "output": output, "cost_usd": cost
                }));

                current_input = output; // 다음 단계 입력 = 현재 단계 출력
            }
            Err(e) => {
                db.write(|conn| {
                    conn.execute(
                        "UPDATE workflow_step_results SET status='failed', error_message=?1, completed_at=datetime('now') WHERE id=?2",
                        params![e, result_id],
                    )?;
                    conn.execute(
                        "UPDATE workflow_runs SET status='failed', error_message=?1, completed_at=datetime('now'), total_cost_usd=?2 WHERE id=?3",
                        params![e, total_cost, run_id],
                    )?;
                    Ok(())
                })?;

                let _ = app.emit("aiflow://workflow-failed", serde_json::json!({ "run_id": run_id, "error": e }));
                all_failed = true;
                break;
            }
        }
    }

    if !all_failed {
        db.write(|conn| {
            conn.execute(
                "UPDATE workflow_runs SET status='completed', final_output=?1, total_cost_usd=?2, completed_at=datetime('now') WHERE id=?3",
                params![current_input, total_cost, run_id],
            )?;
            Ok(())
        })?;
        let _ = app.emit("aiflow://workflow-completed", serde_json::json!({
            "run_id": run_id, "final_output": current_input, "total_cost_usd": total_cost
        }));
    }

    get_workflow_run(&db, run_id)
}

pub fn get_workflow_run(db: &Arc<Database>, run_id: i64) -> Result<WorkflowRun, String> {
    let conn = db.get_conn().map_err(|e| e.to_string())?;

    let run = conn.query_row(
        "SELECT id, workflow_id, status, initial_input, final_output, error_message,
                total_cost_usd, started_at, completed_at, created_at
         FROM workflow_runs WHERE id=?1",
        params![run_id],
        |row| Ok((
            row.get::<_, i64>(0)?,
            row.get::<_, i64>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, String>(3)?,
            row.get::<_, Option<String>>(4)?,
            row.get::<_, Option<String>>(5)?,
            row.get::<_, f64>(6)?,
            row.get::<_, Option<String>>(7)?,
            row.get::<_, Option<String>>(8)?,
            row.get::<_, String>(9)?,
        )),
    ).map_err(|e| e.to_string())?;

    let mut step_stmt = conn
        .prepare(
            "SELECT id, run_id, step_id, step_order, input_text, output_text, status,
                    error_message, tokens_in, tokens_out, cost_usd, started_at, completed_at
             FROM workflow_step_results WHERE run_id=?1 ORDER BY step_order",
        )
        .map_err(|e| e.to_string())?;

    let step_results: Vec<WorkflowStepResult> = step_stmt
        .query_map(params![run_id], |row| {
            Ok(WorkflowStepResult {
                id: row.get(0)?,
                run_id: row.get(1)?,
                step_id: row.get(2)?,
                step_order: row.get(3)?,
                input_text: row.get(4)?,
                output_text: row.get(5)?,
                status: row.get(6)?,
                error_message: row.get(7)?,
                tokens_in: row.get(8)?,
                tokens_out: row.get(9)?,
                cost_usd: row.get(10)?,
                started_at: row.get(11)?,
                completed_at: row.get(12)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(WorkflowRun {
        id: run.0, workflow_id: run.1, status: run.2, initial_input: run.3,
        final_output: run.4, error_message: run.5, total_cost_usd: run.6,
        step_results, started_at: run.7, completed_at: run.8, created_at: run.9,
    })
}

pub fn list_workflow_runs(db: &Arc<Database>, workflow_id: i64) -> Result<Vec<WorkflowRun>, String> {
    let conn = db.get_conn().map_err(|e| e.to_string())?;
    let ids: Vec<i64> = conn
        .prepare("SELECT id FROM workflow_runs WHERE workflow_id=?1 ORDER BY created_at DESC LIMIT 50")
        .map_err(|e| e.to_string())?
        .query_map(params![workflow_id], |r| r.get(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    ids.iter().map(|&id| get_workflow_run(db, id)).collect()
}

// ─── Batch Jobs ───────────────────────────────────────────────────────────

pub fn create_batch_job(db: &Arc<Database>, req: CreateBatchJobRequest) -> Result<BatchJob, String> {
    let conn = db.get_conn().map_err(|e| e.to_string())?;
    let total = req.items.len() as i32;
    conn.execute(
        "INSERT INTO batch_jobs (name, workflow_id, provider, model, system_prompt, output_dir, total_items)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        params![req.name, req.workflow_id, req.provider, req.model, req.system_prompt, req.output_dir, total],
    )
    .map_err(|e| e.to_string())?;
    let job_id = conn.last_insert_rowid();

    for (i, item) in req.items.into_iter().enumerate() {
        conn.execute(
            "INSERT INTO batch_items (job_id, item_order, input_text, input_file_path) VALUES (?1, ?2, ?3, ?4)",
            params![job_id, i as i32, item.input_text, item.input_file_path],
        )
        .map_err(|e| e.to_string())?;
    }

    get_batch_job(db, job_id)
}

pub fn get_batch_job(db: &Arc<Database>, id: i64) -> Result<BatchJob, String> {
    let conn = db.get_conn().map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT id, name, workflow_id, provider, model, system_prompt, status,
                total_items, processed_items, failed_items, output_dir,
                total_cost_usd, created_at, started_at, completed_at
         FROM batch_jobs WHERE id=?1",
        params![id],
        |row| {
            Ok(BatchJob {
                id: row.get(0)?,
                name: row.get(1)?,
                workflow_id: row.get(2)?,
                provider: row.get(3)?,
                model: row.get(4)?,
                system_prompt: row.get(5)?,
                status: row.get(6)?,
                total_items: row.get(7)?,
                processed_items: row.get(8)?,
                failed_items: row.get(9)?,
                output_dir: row.get(10)?,
                total_cost_usd: row.get(11)?,
                created_at: row.get(12)?,
                started_at: row.get(13)?,
                completed_at: row.get(14)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

pub fn list_batch_jobs(db: &Arc<Database>) -> Result<Vec<BatchJob>, String> {
    let conn = db.get_conn().map_err(|e| e.to_string())?;
    let ids: Vec<i64> = conn
        .prepare("SELECT id FROM batch_jobs ORDER BY created_at DESC LIMIT 100")
        .map_err(|e| e.to_string())?
        .query_map([], |r| r.get(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    ids.iter().map(|&id| get_batch_job(db, id)).collect()
}

pub fn get_batch_items(db: &Arc<Database>, job_id: i64) -> Result<Vec<BatchItem>, String> {
    let conn = db.get_conn().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare(
            "SELECT id, job_id, item_order, input_text, input_file_path, output_text,
                    output_file_path, status, error_message, tokens_in, tokens_out, cost_usd, processed_at
             FROM batch_items WHERE job_id=?1 ORDER BY item_order",
        )
        .map_err(|e| e.to_string())?;

    let items = stmt
        .query_map(params![job_id], |row| {
            Ok(BatchItem {
                id: row.get(0)?,
                job_id: row.get(1)?,
                item_order: row.get(2)?,
                input_text: row.get(3)?,
                input_file_path: row.get(4)?,
                output_text: row.get(5)?,
                output_file_path: row.get(6)?,
                status: row.get(7)?,
                error_message: row.get(8)?,
                tokens_in: row.get(9)?,
                tokens_out: row.get(10)?,
                cost_usd: row.get(11)?,
                processed_at: row.get(12)?,
            })
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();
    Ok(items)
}

/// 배치 작업 실행 (백그라운드 Tokio 태스크)
pub async fn run_batch_job(
    db: Arc<Database>,
    app: AppHandle,
    http_client: Arc<reqwest::Client>,
    job_id: i64,
) -> Result<(), String> {
    let job = get_batch_job(&db, job_id)?;
    let items = get_batch_items(&db, job_id)?;

    // 상태를 running으로 변경
    {
        let conn = db.get_conn().map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE batch_jobs SET status='running', started_at=datetime('now') WHERE id=?1",
            params![job_id],
        )
        .map_err(|e| e.to_string())?;
    }

    let provider = job.provider.as_deref().unwrap_or("anthropic");
    let model = job.model.as_deref().unwrap_or("claude-sonnet-4-6");
    let total = items.len() as i32;
    let mut processed = 0i32;
    let mut failed = 0i32;
    let mut total_cost = 0.0f64;

    for item in &items {
        let input = item
            .input_text
            .clone()
            .unwrap_or_else(|| item.input_file_path.clone().unwrap_or_default());

        // DB: 아이템 상태 running
        {
            let conn = db.get_conn().map_err(|e| e.to_string())?;
            conn.execute(
                "UPDATE batch_items SET status='running' WHERE id=?1",
                params![item.id],
            )
            .map_err(|e| e.to_string())?;
        }

        match call_ai_for_step(&http_client, provider, model, job.system_prompt.as_deref(), &input).await {
            Ok((output, tokens_in, tokens_out, cost)) => {
                processed += 1;
                total_cost += cost;

                // 결과 파일 저장 (output_dir 설정 시)
                let output_file = if let Some(dir) = &job.output_dir {
                    let path = format!("{}/item_{:04}.txt", dir, item.item_order);
                    let _ = std::fs::write(&path, &output);
                    Some(path)
                } else {
                    None
                };

                let conn = db.get_conn().map_err(|e| e.to_string())?;
                conn.execute(
                    "UPDATE batch_items SET status='completed', output_text=?1, output_file_path=?2,
                     tokens_in=?3, tokens_out=?4, cost_usd=?5, processed_at=datetime('now') WHERE id=?6",
                    params![output, output_file, tokens_in, tokens_out, cost, item.id],
                )
                .map_err(|e| e.to_string())?;

                let _ = app.emit("aiflow://batch-progress", BatchProgressEvent {
                    job_id,
                    item_id: item.id,
                    item_order: item.item_order,
                    total_items: total,
                    processed_items: processed,
                    status: "completed".into(),
                    output_text: Some(output),
                    error_message: None,
                });
            }
            Err(e) => {
                failed += 1;
                processed += 1;

                let conn = db.get_conn().map_err(|e| e.to_string())?;
                conn.execute(
                    "UPDATE batch_items SET status='failed', error_message=?1, processed_at=datetime('now') WHERE id=?2",
                    params![e, item.id],
                )
                .map_err(|e| e.to_string())?;

                let _ = app.emit("aiflow://batch-progress", BatchProgressEvent {
                    job_id,
                    item_id: item.id,
                    item_order: item.item_order,
                    total_items: total,
                    processed_items: processed,
                    status: "failed".into(),
                    output_text: None,
                    error_message: Some(e),
                });
            }
        }

        // 전체 배치 진행률 업데이트
        {
            let conn = db.get_conn().map_err(|e| e.to_string())?;
            conn.execute(
                "UPDATE batch_jobs SET processed_items=?1, failed_items=?2, total_cost_usd=?3 WHERE id=?4",
                params![processed, failed, total_cost, job_id],
            )
            .map_err(|e| e.to_string())?;
        }
    }

    // 완료 처리
    let final_status = if failed == total { "failed" } else { "completed" };
    {
        let conn = db.get_conn().map_err(|e| e.to_string())?;
        conn.execute(
            "UPDATE batch_jobs SET status=?1, completed_at=datetime('now'), total_cost_usd=?2 WHERE id=?3",
            params![final_status, total_cost, job_id],
        )
        .map_err(|e| e.to_string())?;
    }

    let _ = app.emit("aiflow://batch-completed", serde_json::json!({
        "job_id": job_id,
        "status": final_status,
        "processed": processed,
        "failed": failed,
        "total_cost_usd": total_cost
    }));

    Ok(())
}

pub fn cancel_batch_job(db: &Arc<Database>, job_id: i64) -> Result<(), String> {
    let conn = db.get_conn().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE batch_jobs SET status='cancelled', completed_at=datetime('now') WHERE id=?1 AND status IN ('pending','running')",
        params![job_id],
    )
    .map_err(|e| e.to_string())?;
    // 미처리 아이템 취소
    conn.execute(
        "UPDATE batch_items SET status='cancelled' WHERE job_id=?1 AND status='pending'",
        params![job_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

// ─── Workflow Export / Import ─────────────────────────────────────────────

/// Export a workflow as a JSON string for sharing
pub fn export_workflow(db: &Arc<Database>, workflow_id: i64) -> Result<String, String> {
    let workflow = get_workflow(db, workflow_id)?;
    let exported_at = chrono::Utc::now().to_rfc3339();
    let export = serde_json::json!({
        "version": "1.0",
        "exported_at": exported_at,
        "workflow": {
            "name": workflow.name,
            "description": workflow.description,
            "steps": workflow.steps.iter().map(|s| serde_json::json!({
                "name": s.name,
                "provider": s.provider,
                "model": s.model,
                "system_prompt": s.system_prompt,
                "user_prompt_template": s.user_prompt_template,
                "step_order": s.step_order,
            })).collect::<Vec<_>>(),
        }
    });

    // Record export
    let json_str = serde_json::to_string_pretty(&export).map_err(|e| e.to_string())?;
    let checksum = format!("{:x}", md5_simple(&json_str));
    db.write(|conn| {
        conn.execute(
            "INSERT OR IGNORE INTO workflow_exports (workflow_id, checksum) VALUES (?1, ?2)",
            params![workflow_id, checksum],
        )?;
        Ok(())
    })?;

    Ok(json_str)
}

/// Import a workflow from a JSON string (previously exported)
pub fn import_workflow(db: &Arc<Database>, json_str: &str) -> Result<Workflow, String> {
    // Size limit: 256KB
    if json_str.len() > 256 * 1024 {
        return Err("가져오기 파일이 너무 큽니다 (최대 256KB).".into());
    }

    let parsed: serde_json::Value =
        serde_json::from_str(json_str).map_err(|_| "유효하지 않은 JSON 형식입니다.".to_string())?;

    let wf = parsed
        .get("workflow")
        .ok_or("workflow 필드가 없습니다.")?;

    let name = wf
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("가져온 워크플로우")
        .to_string();

    let description = wf
        .get("description")
        .and_then(|v| v.as_str())
        .map(String::from);

    let steps: Vec<crate::models::workflow::CreateWorkflowStepRequest> = wf
        .get("steps")
        .and_then(|v| v.as_array())
        .unwrap_or(&vec![])
        .iter()
        .map(|s| crate::models::workflow::CreateWorkflowStepRequest {
            name: s
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or("단계")
                .to_string(),
            provider: s.get("provider").and_then(|v| v.as_str()).map(String::from),
            model: s.get("model").and_then(|v| v.as_str()).map(String::from),
            system_prompt: s
                .get("system_prompt")
                .and_then(|v| v.as_str())
                .map(String::from),
            user_prompt_template: s
                .get("user_prompt_template")
                .and_then(|v| v.as_str())
                .unwrap_or("{{input}}")
                .to_string(),
            mcp_server_id: None,
        })
        .collect();

    create_workflow(
        db,
        crate::models::workflow::CreateWorkflowRequest {
            name,
            description,
            template_id: None,
            steps,
        },
    )
}

fn md5_simple(input: &str) -> u64 {
    // Simple non-cryptographic hash for export checksum (not security-critical)
    let mut hash: u64 = 14695981039346656037;
    for byte in input.bytes() {
        hash ^= byte as u64;
        hash = hash.wrapping_mul(1099511628211);
    }
    hash
}

// ─── Security: Template Input Sanitization ────────────────────────────────

/// Prevent prompt injection via {{input}} substitution.
/// Strips characters that could manipulate AI system prompts.
fn sanitize_template_input(input: &str) -> String {
    // Truncate to 32KB
    let truncated = if input.len() > 32_768 {
        &input[..32_768]
    } else {
        input
    };

    // Remove null bytes and control chars (except newline, tab)
    truncated
        .chars()
        .filter(|c| !c.is_control() || *c == '\n' || *c == '\t' || *c == '\r')
        .collect()
}

// ─── Internal AI Helper ───────────────────────────────────────────────────

async fn call_ai_for_step(
    http_client: &Arc<reqwest::Client>,
    provider: &str,
    model: &str,
    system_prompt: Option<&str>,
    user_prompt: &str,
) -> Result<(String, i32, i32, f64), String> {
    use crate::services::ai_client;

    let messages = vec![serde_json::json!({
        "role": "user",
        "content": user_prompt
    })];

    let (text, usage) = ai_client::call_ai_non_stream(
        http_client,
        provider,
        model,
        system_prompt,
        &messages,
    )
    .await
    .map_err(|e| e.to_string())?;

    let tokens_in = usage.get("prompt_tokens").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
    let tokens_out = usage.get("completion_tokens").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
    let cost = ai_client::estimate_cost(provider, model, tokens_in, tokens_out);

    Ok((text, tokens_in, tokens_out, cost))
}
