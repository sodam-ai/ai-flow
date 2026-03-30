use rusqlite_migration::{Migrations, M};

/// Run all database migrations
pub fn run(conn: &mut rusqlite::Connection) -> Result<(), Box<dyn std::error::Error>> {
    let migrations = Migrations::new(vec![
        M::up(include_str!("../../migrations/001_core.sql")),
        M::up(include_str!("../../migrations/002_chat.sql")),
        M::up(include_str!("../../migrations/003_audit.sql")),
        M::up(include_str!("../../migrations/004_personas.sql")),
        M::up(include_str!("../../migrations/005_prompt_templates.sql")),
    ]);

    migrations.to_latest(conn)?;
    log::info!("Database migrations complete");
    Ok(())
}
