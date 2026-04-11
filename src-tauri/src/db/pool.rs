use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

/// Database wrapper with SQLCipher encryption
pub struct Database {
    /// Single writer connection (SQLite WAL allows 1 writer + N readers)
    writer: Arc<Mutex<Connection>>,
    /// DB file path
    pub path: PathBuf,
}

impl Database {
    /// Initialize database with SQLCipher encryption
    pub fn init(app: &tauri::AppHandle) -> Result<Self, Box<dyn std::error::Error>> {
        use tauri::Manager;
        let app_dir = app
            .path()
            .app_data_dir()
            .map_err(|e| format!("Failed to get app data dir: {}", e))?;

        std::fs::create_dir_all(&app_dir)?;
        let db_path = app_dir.join("aiflow.db");

        let mut conn = Connection::open(&db_path)?;

        // Get or create DB master key from OS keychain
        let master_key = get_or_create_db_key()?;

        // SQLCipher setup (PRD v4.1 §05_SECURITY_SPEC)
        // SECURITY: Use pragma_update() binding — never format!() key into SQL
        conn.pragma_update(None, "key", &master_key)?;
        conn.execute_batch(
            "PRAGMA cipher_page_size = 4096;
             PRAGMA kdf_iter = 64000;
             PRAGMA cipher_hmac_algorithm = HMAC_SHA512;
             PRAGMA cipher_memory_security = OFF;
             PRAGMA journal_mode = WAL;
             PRAGMA foreign_keys = ON;
             PRAGMA secure_delete = ON;
             PRAGMA cache_size = -4000;
             PRAGMA temp_store = MEMORY;",
        )?;

        // Immediately drop master key from memory
        drop(master_key);

        // Auto-backup before migrations (PRD: keep 5 most recent)
        if db_path.exists() {
            backup_db_before_migration(&db_path, &conn);
        }

        // Run migrations
        super::migrations::run(&mut conn)?;

        log::info!("Database initialized at {:?}", db_path);

        Ok(Self {
            writer: Arc::new(Mutex::new(conn)),
            path: db_path,
        })
    }

    /// Execute a write operation
    pub fn write<F, T>(&self, f: F) -> Result<T, String>
    where
        F: FnOnce(&Connection) -> Result<T, rusqlite::Error>,
    {
        let conn = self.writer.lock().map_err(|e| format!("DB lock: {}", e))?;
        f(&conn).map_err(|e| format!("DB write: {}", e))
    }

    /// Execute a read operation (uses same connection for now; Phase 2: add read pool)
    pub fn read<F, T>(&self, f: F) -> Result<T, String>
    where
        F: FnOnce(&Connection) -> Result<T, rusqlite::Error>,
    {
        let conn = self.writer.lock().map_err(|e| format!("DB lock: {}", e))?;
        f(&conn).map_err(|e| format!("DB read: {}", e))
    }

    /// Raw connection guard for multi-statement operations.
    /// IMPORTANT: Always drop the guard before any `.await` point to avoid deadlocks.
    pub fn get_conn(&self) -> Result<std::sync::MutexGuard<'_, Connection>, String> {
        self.writer.lock().map_err(|e| format!("DB lock: {}", e))
    }
}

/// Get or create DB encryption master key from OS keychain
fn get_or_create_db_key() -> Result<String, Box<dyn std::error::Error>> {
    let entry = keyring::Entry::new("aiflow", "db_master_key")?;

    match entry.get_password() {
        Ok(key) => Ok(key),
        Err(keyring::Error::NoEntry) => {
            // First run: generate random key
            let key = generate_random_key();
            entry.set_password(&key)?;
            log::info!("Generated new DB master key (stored in OS keychain)");
            Ok(key)
        }
        Err(e) => {
            log::error!("Keychain access failed: {}", e);
            Err(format!("KEYCHAIN_001: Cannot access OS keychain: {}", e).into())
        }
    }
}

/// Generate cryptographically secure random key (32 bytes hex)
fn generate_random_key() -> String {
    use ring::rand::{SecureRandom, SystemRandom};
    let rng = SystemRandom::new();
    let mut key_bytes = [0u8; 32];
    rng.fill(&mut key_bytes).expect("Failed to generate random key");
    hex::encode(key_bytes)
}

/// Backup DB before migration — keep 5 most recent backups (PRD §Phase 1b)
fn backup_db_before_migration(db_path: &std::path::Path, conn: &Connection) {
    // Checkpoint WAL so all data is in the main DB file
    let _ = conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);");

    let backup_dir = db_path.parent().unwrap().join("backups");
    if let Err(e) = std::fs::create_dir_all(&backup_dir) {
        log::warn!("Cannot create backup dir: {}", e);
        return;
    }

    // Generate timestamped backup filename
    let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
    let backup_name = format!("aiflow_backup_{}.db", timestamp);
    let backup_path = backup_dir.join(&backup_name);

    match std::fs::copy(db_path, &backup_path) {
        Ok(_) => log::info!("DB backed up to {:?}", backup_path),
        Err(e) => {
            log::warn!("DB backup failed: {}", e);
            return;
        }
    }

    // Prune old backups — keep only 5 most recent
    let mut backups: Vec<_> = std::fs::read_dir(&backup_dir)
        .ok()
        .into_iter()
        .flatten()
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.file_name()
                .to_str()
                .is_some_and(|n| n.starts_with("aiflow_backup_") && n.ends_with(".db"))
        })
        .collect();

    backups.sort_by_key(|e| std::cmp::Reverse(e.file_name()));

    for old in backups.into_iter().skip(5) {
        if let Err(e) = std::fs::remove_file(old.path()) {
            log::warn!("Cannot remove old backup {:?}: {}", old.path(), e);
        }
    }
}
