use crate::db::pool::Database;
use crate::models::persona::{CreatePersonaInput, Persona, UpdatePersonaInput};

/// List all active personas (sorted by sort_order)
pub fn list_personas(db: &Database) -> Result<Vec<Persona>, String> {
    db.read(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, name, slug, description, system_prompt, icon, color,
                    is_builtin, is_active, sort_order, created_at, updated_at
             FROM personas
             WHERE is_active = 1
             ORDER BY sort_order ASC, name ASC",
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(Persona {
                id: row.get(0)?,
                name: row.get(1)?,
                slug: row.get(2)?,
                description: row.get(3)?,
                system_prompt: row.get(4)?,
                icon: row.get(5)?,
                color: row.get(6)?,
                is_builtin: row.get(7)?,
                is_active: row.get(8)?,
                sort_order: row.get(9)?,
                created_at: row.get(10)?,
                updated_at: row.get(11)?,
            })
        })?;

        rows.collect::<Result<Vec<_>, _>>()
    })
}

/// Get a single persona by ID
pub fn get_persona(db: &Database, id: &str) -> Result<Persona, String> {
    db.read(|conn| {
        conn.query_row(
            "SELECT id, name, slug, description, system_prompt, icon, color,
                    is_builtin, is_active, sort_order, created_at, updated_at
             FROM personas WHERE id = ?1",
            rusqlite::params![id],
            |row| {
                Ok(Persona {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    slug: row.get(2)?,
                    description: row.get(3)?,
                    system_prompt: row.get(4)?,
                    icon: row.get(5)?,
                    color: row.get(6)?,
                    is_builtin: row.get(7)?,
                    is_active: row.get(8)?,
                    sort_order: row.get(9)?,
                    created_at: row.get(10)?,
                    updated_at: row.get(11)?,
                })
            },
        )
    })
    .map_err(|e| {
        if e.contains("no rows") {
            "PERSONA_001: Persona not found".to_string()
        } else {
            e
        }
    })
}

/// Create a custom persona
pub fn create_persona(db: &Database, input: CreatePersonaInput) -> Result<Persona, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let slug = slugify(&input.name);
    let description = input.description.unwrap_or_default();
    let icon = input.icon.unwrap_or_else(|| "bot".to_string());
    let color = input.color.unwrap_or_else(|| "#6366f1".to_string());

    // Get next sort_order
    let max_order: i32 = db
        .read(|conn| {
            conn.query_row("SELECT COALESCE(MAX(sort_order), 0) FROM personas", [], |row| {
                row.get(0)
            })
        })
        .unwrap_or(0);

    db.write(|conn| {
        conn.execute(
            "INSERT INTO personas (id, name, slug, description, system_prompt, icon, color, is_builtin, is_active, sort_order, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0, 1, ?8, ?9, ?10)",
            rusqlite::params![id, input.name, slug, description, input.system_prompt, icon, color, max_order + 1, now, now],
        )?;
        Ok(())
    })?;

    Ok(Persona {
        id,
        name: input.name,
        slug,
        description,
        system_prompt: input.system_prompt,
        icon,
        color,
        is_builtin: false,
        is_active: true,
        sort_order: max_order + 1,
        created_at: now.clone(),
        updated_at: now,
    })
}

/// Update an existing persona
pub fn update_persona(
    db: &Database,
    id: &str,
    input: UpdatePersonaInput,
) -> Result<Persona, String> {
    let existing = get_persona(db, id)?;
    let now = chrono::Utc::now().to_rfc3339();

    let name = input.name.unwrap_or(existing.name);
    let description = input.description.unwrap_or(existing.description);
    let system_prompt = input.system_prompt.unwrap_or(existing.system_prompt);
    let icon = input.icon.unwrap_or(existing.icon);
    let color = input.color.unwrap_or(existing.color);
    let is_active = input.is_active.unwrap_or(existing.is_active);
    let slug = slugify(&name);

    db.write(|conn| {
        conn.execute(
            "UPDATE personas SET name = ?2, slug = ?3, description = ?4, system_prompt = ?5,
             icon = ?6, color = ?7, is_active = ?8, updated_at = ?9
             WHERE id = ?1",
            rusqlite::params![id, name, slug, description, system_prompt, icon, color, is_active, now],
        )?;
        Ok(())
    })?;

    Ok(Persona {
        id: id.to_string(),
        name,
        slug,
        description,
        system_prompt,
        icon,
        color,
        is_builtin: existing.is_builtin,
        is_active,
        sort_order: existing.sort_order,
        created_at: existing.created_at,
        updated_at: now,
    })
}

/// Delete a persona (only custom, not built-in)
pub fn delete_persona(db: &Database, id: &str) -> Result<(), String> {
    let existing = get_persona(db, id)?;
    if existing.is_builtin {
        return Err("PERSONA_002: Cannot delete built-in persona".to_string());
    }

    db.write(|conn| {
        conn.execute("DELETE FROM personas WHERE id = ?1 AND is_builtin = 0", rusqlite::params![id])?;
        Ok(())
    })
}

/// Simple slug generation (lowercase, replace spaces with hyphens)
fn slugify(name: &str) -> String {
    name.to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}
