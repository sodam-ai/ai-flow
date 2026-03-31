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
    ]);

    migrations.to_latest(conn)?;
    log::info!("Database migrations complete");
    Ok(())
}
