use once_cell::sync::Lazy;
use reqwest::Client;
use std::time::Duration;

/// Singleton HTTP client (PRD v4.1 §04: reqwest connection pool)
static HTTP_CLIENT: Lazy<Client> = Lazy::new(|| {
    Client::builder()
        .pool_max_idle_per_host(5)
        .pool_idle_timeout(Duration::from_secs(90))
        .connect_timeout(Duration::from_secs(10))
        .timeout(Duration::from_secs(300))
        .use_rustls_tls()
        .build()
        .expect("Failed to create HTTP client")
});

pub fn get_http_client() -> Client {
    HTTP_CLIENT.clone()
}
