use anyhow::Result;
use r2d2::Pool;
use r2d2_sqlite::SqliteConnectionManager;
use rusqlite::Connection;
use std::path::Path;
use std::sync::mpsc;
use std::thread;
use tokio::sync::oneshot;

/// 읽기/쓰기 분리 DB 구조 — 04_PROJECT_SPEC.md A-2 WAL 최적화
/// 읽기: r2d2 풀 (최대 4개 동시 연결)
/// 쓰기: 단일 스레드 writer + mpsc 채널 (write 충돌 방지)
///
/// NOTE: 현재 SQLite 평문 저장 (SQLCipher는 Strawberry Perl 설치 후 적용 예정)
/// API 키는 OS 키체인에 직접 저장되므로 민감 데이터 보호는 유지됨
pub struct Database {
    read_pool: Pool<SqliteConnectionManager>,
    write_tx: mpsc::SyncSender<WriteRequest>,
}

type WriteRequest = Box<dyn FnOnce(&mut Connection) + Send + 'static>;

impl Database {
    pub fn open(db_path: &Path) -> Result<Self> {
        // --- 읽기 풀 초기화 ---
        let read_manager = SqliteConnectionManager::file(db_path)
            .with_init(|conn| setup_pragmas(conn));

        let read_pool = Pool::builder()
            .max_size(4)
            .min_idle(Some(1))
            .build(read_manager)?;

        // --- 단일 writer 스레드 ---
        let (write_tx, write_rx) = mpsc::sync_channel::<WriteRequest>(64);
        let writer_path = db_path.to_path_buf();

        thread::spawn(move || {
            let mut writer_conn =
                Connection::open(&writer_path).expect("writer connection failed");
            setup_pragmas(&writer_conn).expect("pragma setup failed");

            while let Ok(request) = write_rx.recv() {
                request(&mut writer_conn);
            }
        });

        Ok(Self {
            read_pool,
            write_tx,
        })
    }

    /// 읽기 전용 작업 — r2d2 풀에서 연결 획득
    pub fn read<F, T>(&self, f: F) -> Result<T>
    where
        F: FnOnce(&Connection) -> Result<T>,
    {
        let conn = self.read_pool.get()?;
        f(&conn)
    }

    /// 쓰기 작업 — writer 스레드로 전송 (async 호환)
    pub async fn write<F, T>(&self, f: F) -> Result<T>
    where
        F: FnOnce(&mut Connection) -> Result<T> + Send + 'static,
        T: Send + 'static,
    {
        let (tx, rx) = oneshot::channel();
        let request: WriteRequest = Box::new(move |conn| {
            let result = f(conn);
            let _ = tx.send(result);
        });
        self.write_tx
            .send(request)
            .map_err(|_| anyhow::anyhow!("writer channel closed"))?;
        rx.await
            .map_err(|_| anyhow::anyhow!("writer task dropped"))?
    }
}

/// 기본 SQLite 최적화 PRAGMA
fn setup_pragmas(conn: &Connection) -> rusqlite::Result<()> {
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "foreign_keys", true)?;
    conn.pragma_update(None, "busy_timeout", 5000_i64)?;
    conn.pragma_update(None, "synchronous", "NORMAL")?;
    Ok(())
}
