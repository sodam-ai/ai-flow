use crate::db::pool::Database;
use crate::models::prompt::{CreatePromptInput, PromptTemplate, UpdatePromptInput};
use std::collections::HashMap;

/// List all prompts, optionally filtered by tag
pub fn list_prompts(db: &Database, tag: Option<&str>) -> Result<Vec<PromptTemplate>, String> {
    db.read(|conn| {
        let (sql, params): (&str, Vec<Box<dyn rusqlite::types::ToSql>>) = match tag {
            Some(t) => (
                "SELECT id, title, content, description, tags, variables, is_favorite, use_count, created_at, updated_at
                 FROM prompt_templates
                 WHERE tags LIKE ?1
                 ORDER BY is_favorite DESC, use_count DESC, updated_at DESC",
                vec![Box::new(format!("%\"{}\"%" , t))],
            ),
            None => (
                "SELECT id, title, content, description, tags, variables, is_favorite, use_count, created_at, updated_at
                 FROM prompt_templates
                 ORDER BY is_favorite DESC, use_count DESC, updated_at DESC",
                vec![],
            ),
        };

        let mut stmt = conn.prepare(sql)?;
        let rows = stmt.query_map(rusqlite::params_from_iter(params.iter()), |row| {
            let tags_json: String = row.get(4)?;
            let vars_json: String = row.get(5)?;
            Ok(PromptTemplate {
                id: row.get(0)?,
                title: row.get(1)?,
                content: row.get(2)?,
                description: row.get(3)?,
                tags: serde_json::from_str(&tags_json).unwrap_or_default(),
                variables: serde_json::from_str(&vars_json).unwrap_or_default(),
                is_favorite: row.get(6)?,
                use_count: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })?;

        rows.collect::<Result<Vec<_>, _>>()
    })
}

/// Get a single prompt by ID
pub fn get_prompt(db: &Database, id: &str) -> Result<PromptTemplate, String> {
    db.read(|conn| {
        conn.query_row(
            "SELECT id, title, content, description, tags, variables, is_favorite, use_count, created_at, updated_at
             FROM prompt_templates WHERE id = ?1",
            rusqlite::params![id],
            |row| {
                let tags_json: String = row.get(4)?;
                let vars_json: String = row.get(5)?;
                Ok(PromptTemplate {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    content: row.get(2)?,
                    description: row.get(3)?,
                    tags: serde_json::from_str(&tags_json).unwrap_or_default(),
                    variables: serde_json::from_str(&vars_json).unwrap_or_default(),
                    is_favorite: row.get(6)?,
                    use_count: row.get(7)?,
                    created_at: row.get(8)?,
                    updated_at: row.get(9)?,
                })
            },
        )
    })
    .map_err(|e| {
        if e.contains("no rows") {
            "PROMPT_001: Prompt not found".to_string()
        } else {
            e
        }
    })
}

/// Create a new prompt template
pub fn create_prompt(db: &Database, input: CreatePromptInput) -> Result<PromptTemplate, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let description = input.description.unwrap_or_default();
    let tags = input.tags.unwrap_or_default();
    let variables = extract_variables(&input.content);
    let tags_json = serde_json::to_string(&tags).unwrap_or_else(|_| "[]".to_string());
    let vars_json = serde_json::to_string(&variables).unwrap_or_else(|_| "[]".to_string());

    db.write(|conn| {
        conn.execute(
            "INSERT INTO prompt_templates (id, title, content, description, tags, variables, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![id, input.title, input.content, description, tags_json, vars_json, now, now],
        )?;
        Ok(())
    })?;

    Ok(PromptTemplate {
        id,
        title: input.title,
        content: input.content,
        description,
        tags,
        variables,
        is_favorite: false,
        use_count: 0,
        created_at: now.clone(),
        updated_at: now,
    })
}

/// Update an existing prompt template
pub fn update_prompt(
    db: &Database,
    id: &str,
    input: UpdatePromptInput,
) -> Result<PromptTemplate, String> {
    let existing = get_prompt(db, id)?;
    let now = chrono::Utc::now().to_rfc3339();

    let title = input.title.unwrap_or(existing.title);
    let content = input.content.unwrap_or(existing.content.clone());
    let description = input.description.unwrap_or(existing.description);
    let tags = input.tags.unwrap_or(existing.tags);
    let is_favorite = input.is_favorite.unwrap_or(existing.is_favorite);
    let variables = extract_variables(&content);
    let tags_json = serde_json::to_string(&tags).unwrap_or_else(|_| "[]".to_string());
    let vars_json = serde_json::to_string(&variables).unwrap_or_else(|_| "[]".to_string());

    db.write(|conn| {
        conn.execute(
            "UPDATE prompt_templates SET title = ?2, content = ?3, description = ?4,
             tags = ?5, variables = ?6, is_favorite = ?7, updated_at = ?8
             WHERE id = ?1",
            rusqlite::params![id, title, content, description, tags_json, vars_json, is_favorite, now],
        )?;
        Ok(())
    })?;

    Ok(PromptTemplate {
        id: id.to_string(),
        title,
        content,
        description,
        tags,
        variables,
        is_favorite,
        use_count: existing.use_count,
        created_at: existing.created_at,
        updated_at: now,
    })
}

/// Delete a prompt template
pub fn delete_prompt(db: &Database, id: &str) -> Result<(), String> {
    db.write(|conn| {
        let affected = conn.execute("DELETE FROM prompt_templates WHERE id = ?1", rusqlite::params![id])?;
        if affected == 0 {
            return Err(rusqlite::Error::QueryReturnedNoRows);
        }
        Ok(())
    })
    .map_err(|e| {
        if e.contains("no rows") {
            "PROMPT_001: Prompt not found".to_string()
        } else {
            e
        }
    })
}

/// Increment use_count when a prompt is used
pub fn increment_use_count(db: &Database, id: &str) -> Result<(), String> {
    db.write(|conn| {
        conn.execute(
            "UPDATE prompt_templates SET use_count = use_count + 1, updated_at = datetime('now')
             WHERE id = ?1",
            rusqlite::params![id],
        )?;
        Ok(())
    })
}

/// Apply variable substitution: replace {{var}} with provided values
pub fn apply_variables(content: &str, variables: &HashMap<String, String>) -> String {
    let mut result = content.to_string();
    for (key, value) in variables {
        let placeholder = format!("{{{{{}}}}}", key); // {{key}}
        result = result.replace(&placeholder, value);
    }
    result
}

/// Extract variable names from {{var}} patterns in content
pub fn extract_variables(content: &str) -> Vec<String> {
    let mut vars = Vec::new();
    let mut seen = std::collections::HashSet::new();
    let bytes = content.as_bytes();
    let len = bytes.len();
    let mut i = 0;

    while i + 3 < len {
        if bytes[i] == b'{' && bytes[i + 1] == b'{' {
            i += 2; // skip "{{"
            let start = i;
            while i < len && (bytes[i].is_ascii_alphanumeric() || bytes[i] == b'_') {
                i += 1;
            }
            let end = i;
            if i + 1 < len && bytes[i] == b'}' && bytes[i + 1] == b'}' && end > start {
                let var_name = content[start..end].to_string();
                if seen.insert(var_name.clone()) {
                    vars.push(var_name);
                }
                i += 2; // skip "}}"
            }
        } else {
            i += 1;
        }
    }

    vars
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_variables() {
        assert_eq!(
            extract_variables("Hello {{name}}, welcome to {{place}}!"),
            vec!["name", "place"]
        );
        assert_eq!(
            extract_variables("{{a}} and {{b}} and {{a}}"),
            vec!["a", "b"] // no duplicates
        );
        assert_eq!(extract_variables("no variables here"), Vec::<String>::new());
        assert_eq!(
            extract_variables("{{lang}} translation: {{text}}"),
            vec!["lang", "text"]
        );
    }

    #[test]
    fn test_apply_variables() {
        let mut vars = HashMap::new();
        vars.insert("name".to_string(), "Alice".to_string());
        vars.insert("lang".to_string(), "Korean".to_string());
        assert_eq!(
            apply_variables("Hello {{name}}, translate to {{lang}}", &vars),
            "Hello Alice, translate to Korean"
        );
    }
}
