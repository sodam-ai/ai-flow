use std::collections::HashMap;
use std::sync::Mutex;
use tokio::sync::oneshot;

/// Registry for active AI streams — enables cancellation
pub struct StreamRegistry {
    senders: Mutex<HashMap<String, oneshot::Sender<()>>>,
}

impl StreamRegistry {
    pub fn new() -> Self {
        Self {
            senders: Mutex::new(HashMap::new()),
        }
    }

    /// Register a new stream, returns receiver for cancellation signal
    pub fn register(&self, stream_id: &str) -> Result<oneshot::Receiver<()>, String> {
        let mut map = self.senders.lock().map_err(|e| format!("StreamRegistry lock: {}", e))?;

        // TOCTOU-safe: check + insert inside lock
        if map.len() >= 5 {
            return Err("RATE_003: Maximum 5 concurrent streams".to_string());
        }

        let (tx, rx) = oneshot::channel();
        map.insert(stream_id.to_string(), tx);
        Ok(rx)
    }

    /// Cancel an active stream
    pub fn cancel(&self, stream_id: &str) {
        if let Ok(mut map) = self.senders.lock() {
            if let Some(sender) = map.remove(stream_id) {
                let _ = sender.send(());
                log::info!("Stream cancelled: {}", stream_id);
            }
        }
    }

    /// Remove stream when completed normally
    pub fn remove(&self, stream_id: &str) {
        if let Ok(mut map) = self.senders.lock() {
            map.remove(stream_id);
        }
    }
}
