use anyhow::Result;
use rusqlite::Connection;
use rusqlite_migration::{Migrations, M};

/// DB 마이그레이션 실행 — rusqlite_migration 사용 (sqlx 사용 금지)
/// 04_PROJECT_SPEC.md A-1 수정: sqlx → rusqlite_migration
pub fn run_migrations(conn: &mut Connection) -> Result<()> {
    let migrations = Migrations::new(vec![
        // 001: 핵심 테이블 (providers, settings)
        M::up(include_str!("../../migrations/20260327000001_core.sql")),
        // 002: 대화/메시지 테이블
        M::up(include_str!("../../migrations/20260327000002_chat.sql")),
        // 003: 첨부파일
        M::up(include_str!("../../migrations/20260327000003_attachments.sql")),
        // 004: 프롬프트 저장고
        M::up(include_str!("../../migrations/20260327000004_prompts.sql")),
        // 005: AI 페르소나
        M::up(include_str!("../../migrations/20260327000005_personas.sql")),
        // 006: 프라이버시 모드
        M::up(include_str!("../../migrations/20260327000006_privacy.sql")),
    ]);

    migrations.to_latest(conn)?;
    Ok(())
}
