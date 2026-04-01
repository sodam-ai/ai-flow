use rusqlite_migration::{Migrations, M};

/// Run all database migrations
pub fn run(conn: &mut rusqlite::Connection) -> Result<(), Box<dyn std::error::Error>> {
    let migrations = Migrations::new(vec![
        M::up(include_str!("../../migrations/001_core.sql")),
        M::up(include_str!("../../migrations/002_chat.sql")),
        M::up(include_str!("../../migrations/003_audit.sql")),
        M::up(include_str!("../../migrations/004_personas.sql")),
        M::up(include_str!("../../migrations/005_prompt_templates.sql")),
        M::up(include_str!("../../migrations/006_message_versions.sql")),
        // Phase 2
        M::up(include_str!("../../migrations/007_comparison_groups.sql")),
        M::up(include_str!("../../migrations/008_routing_rules.sql")),
        M::up(include_str!("../../migrations/009_privacy_local_llm.sql")),
        M::up(include_str!("../../migrations/010_budget_prompt_versions.sql")),
        // Phase 2 continued
        M::up(include_str!("../../migrations/011_mcp_servers.sql")),
        M::up(include_str!("../../migrations/012_workflows.sql")),
        M::up(include_str!("../../migrations/013_batch_jobs.sql")),
        M::up(include_str!("../../migrations/014_workflow_templates.sql")),
        M::up(include_str!("../../migrations/015_payment.sql")),
    ]);

    migrations.to_latest(conn)?;
    log::info!("Database migrations complete");
    Ok(())
}
