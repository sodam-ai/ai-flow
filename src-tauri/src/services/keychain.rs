use anyhow::Result;
use keyring::Entry;
use tracing::{info, warn};
use zeroize::Zeroizing;

/// OS 키체인 서비스 — 05_SECURITY_SPEC.md §2 폴백 전략 구현
/// 1순위: OS 키체인 (Windows Credential Manager)
/// 2순위: 메모리 캐시 (세션 중 임시, 재시작 시 소멸)
/// 3순위: CI 환경 InMemoryKeychain (KEYCHAIN_TEST=1)
pub struct KeychainService {
    /// CI/테스트 환경에서 메모리 폴백 활성화
    use_memory_fallback: bool,
    memory_store: std::sync::Mutex<std::collections::HashMap<String, String>>,
}

impl KeychainService {
    pub fn new() -> Self {
        let use_memory_fallback = std::env::var("KEYCHAIN_TEST")
            .map(|v| v == "1")
            .unwrap_or(false);

        if use_memory_fallback {
            warn!("KEYCHAIN_TEST=1: using in-memory keychain (CI mode)");
        }

        Self {
            use_memory_fallback,
            memory_store: std::sync::Mutex::new(std::collections::HashMap::new()),
        }
    }

    /// API 키 저장 — 실제 값을 OS 키체인에만 저장
    pub fn set_secret(&self, service: &str, account: &str, secret: &str) -> Result<()> {
        if self.use_memory_fallback {
            let key = format!("{}/{}", service, account);
            self.memory_store
                .lock()
                .unwrap_or_else(|p| p.into_inner()) // CRIT-02: 독 가드 복구
                .insert(key, secret.to_string());
            return Ok(());
        }

        let entry = Entry::new(service, account)?;
        entry.set_password(secret)?;
        info!("keychain: stored secret for {}/{}", service, account);
        Ok(())
    }

    /// API 키 읽기 — Zeroizing으로 감싸 메모리 클리어 보장
    pub fn get_secret(&self, service: &str, account: &str) -> Result<Option<Zeroizing<String>>> {
        if self.use_memory_fallback {
            let key = format!("{}/{}", service, account);
            let value = self
                .memory_store
                .lock()
                .unwrap_or_else(|p| p.into_inner()) // CRIT-02: 독 가드 복구
                .get(&key)
                .map(|s| Zeroizing::new(s.clone()));
            return Ok(value);
        }

        let entry = Entry::new(service, account)?;
        match entry.get_password() {
            Ok(secret) => Ok(Some(Zeroizing::new(secret))),
            Err(keyring::Error::NoEntry) => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    /// API 키 삭제
    pub fn delete_secret(&self, service: &str, account: &str) -> Result<()> {
        if self.use_memory_fallback {
            let key = format!("{}/{}", service, account);
            self.memory_store
                .lock()
                .unwrap_or_else(|p| p.into_inner()) // CRIT-02: 독 가드 복구
                .remove(&key);
            return Ok(());
        }

        let entry = Entry::new(service, account)?;
        entry.delete_credential()?;
        info!("keychain: deleted secret for {}/{}", service, account);
        Ok(())
    }

    /// API 키 존재 여부 확인 (키값 반환 안 함)
    pub fn has_secret(&self, service: &str, account: &str) -> bool {
        self.get_secret(service, account)
            .ok()
            .flatten()
            .is_some()
    }
}
