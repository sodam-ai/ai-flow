use crate::{models::payment::*, AppState};
use rusqlite::params;
use tauri::State;

const KEYCHAIN_LICENSE_KEY: &str = "aiflow-pro-license";
const LEMONSQUEEZY_STORE_ID: &str = "aiflow-store"; // 실 배포 시 변경
const LEMONSQUEEZY_VARIANT_ID: &str = "pro-monthly"; // 실 배포 시 변경

// ─── License Status ───────────────────────────────────────────────────────

#[tauri::command]
pub fn get_license_status(state: State<'_, AppState>) -> Result<LicenseInfo, String> {
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT id, tier, payment_provider, order_id, activated_at, expires_at,
                last_verified_at, created_at, updated_at
         FROM license_info WHERE id=1",
        [],
        |row| {
            Ok(LicenseInfo {
                id: row.get(0)?,
                tier: row.get(1)?,
                payment_provider: row.get(2)?,
                order_id: row.get(3)?,
                activated_at: row.get(4)?,
                expires_at: row.get(5)?,
                last_verified_at: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_pro_features(state: State<'_, AppState>) -> Result<ProFeatures, String> {
    let info = get_license_status(state)?;
    if info.tier == "pro" {
        // 만료 확인
        if let Some(expires) = &info.expires_at {
            let now = chrono::Utc::now().to_rfc3339();
            if now > *expires {
                return Ok(ProFeatures::free());
            }
        }
        Ok(ProFeatures::pro())
    } else {
        Ok(ProFeatures::free())
    }
}

// ─── Checkout URL 생성 ────────────────────────────────────────────────────

/// LemonSqueezy Checkout URL 생성
/// PRD: "LemonSqueezy Checkout URL 생성 (Rust reqwest)"
#[tauri::command]
pub async fn create_lemonsqueezy_checkout(
    state: State<'_, AppState>,
) -> Result<CheckoutUrlResponse, String> {
    // LemonSqueezy API 키는 OS 키체인에서 조회
    // 개발/배포 시 설정 페이지에서 저장
    let api_key = crate::services::keychain::get_key_internal("lemonsqueezy")
        .unwrap_or_else(|_| std::env::var("LEMONSQUEEZY_API_KEY").unwrap_or_default());

    if api_key.is_empty() {
        // API 키 없어도 기본 결제 페이지 URL은 생성 가능
        let url = format!(
            "https://aiflow.lemonsqueezy.com/checkout/buy/{}?checkout[custom][app_version]=2&checkout[redirect_url]=aiflow://payment/callback",
            LEMONSQUEEZY_VARIANT_ID
        );
        return Ok(CheckoutUrlResponse { url, provider: "lemonsqueezy".into() });
    }

    let body = serde_json::json!({
        "data": {
            "type": "checkouts",
            "attributes": {
                "checkout_options": {
                    "embed": false
                },
                "checkout_data": {
                    "custom": {
                        "app_version": "2"
                    }
                },
                "expires_at": null,
                "preview": false,
                "test_mode": true   // 실 배포 시 false
            },
            "relationships": {
                "store": {
                    "data": { "type": "stores", "id": LEMONSQUEEZY_STORE_ID }
                },
                "variant": {
                    "data": { "type": "variants", "id": LEMONSQUEEZY_VARIANT_ID }
                }
            }
        }
    });

    let response = state.http_client
        .post("https://api.lemonsqueezy.com/v1/checkouts")
        .header("Authorization", format!("Bearer {api_key}"))
        .header("Accept", "application/vnd.api+json")
        .header("Content-Type", "application/vnd.api+json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("결제 URL 생성 실패: {e}"))?;

    let json: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    let url = json["data"]["attributes"]["url"]
        .as_str()
        .ok_or_else(|| "결제 URL을 가져올 수 없습니다.".to_string())?
        .to_string();

    Ok(CheckoutUrlResponse { url, provider: "lemonsqueezy".into() })
}

/// 토스페이먼츠 결제 URL (한국 결제)
#[tauri::command]
pub fn create_toss_checkout() -> Result<CheckoutUrlResponse, String> {
    // 토스페이먼츠는 SDK를 프론트엔드에서 호출 — Rust에서는 URL만 반환
    let url = "https://aiflow.kr/payment/toss?product=pro&redirect=aiflow://payment/callback".to_string();
    Ok(CheckoutUrlResponse { url, provider: "toss".into() })
}

/// 네이버페이 결제 URL (한국 결제)
#[tauri::command]
pub fn create_naverpay_checkout() -> Result<CheckoutUrlResponse, String> {
    let url = "https://aiflow.kr/payment/naverpay?product=pro&redirect=aiflow://payment/callback".to_string();
    Ok(CheckoutUrlResponse { url, provider: "naverpay".into() })
}

// ─── 라이선스 키 활성화 ───────────────────────────────────────────────────

/// 라이선스 키 검증 + OS 키체인 저장 + DB 업데이트
/// PRD: "라이선스 키 검증 + OS 키체인 저장"
#[tauri::command]
pub async fn activate_license(
    state: State<'_, AppState>,
    req: ActivateLicenseRequest,
) -> Result<LicenseInfo, String> {
    // 1. 라이선스 검증
    match req.provider.as_str() {
        "lemonsqueezy" => verify_lemonsqueezy_license(&state, &req.license_key).await?,
        "toss" | "naverpay" => verify_order_id(&req.license_key)?,
        _ => return Err("알 수 없는 결제 수단입니다.".into()),
    }

    // 2. OS 키체인에 라이선스 키 저장 (DB에 평문 없음)
    crate::services::keychain::save_key(KEYCHAIN_LICENSE_KEY, &req.license_key)
        .map_err(|e| format!("라이선스 키 저장 실패: {e}"))?;

    // 3. DB 업데이트 (키체인 참조 키만 저장)
    let conn = state.db.get_conn().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE license_info SET tier='pro', license_key_ref=?1, payment_provider=?2,
         activated_at=datetime('now'), last_verified_at=datetime('now'), updated_at=datetime('now')
         WHERE id=1",
        params![KEYCHAIN_LICENSE_KEY, req.provider],
    )
    .map_err(|e| e.to_string())?;
    drop(conn);

    get_license_status(state)
}

/// LemonSqueezy 라이선스 키 검증 (API 호출)
async fn verify_lemonsqueezy_license(
    state: &State<'_, AppState>,
    license_key: &str,
) -> Result<(), String> {
    let body = serde_json::json!({
        "license_key": license_key,
        "instance_name": format!("aiflow-{}", hostname::get().unwrap_or_default().to_string_lossy())
    });

    let response = state.http_client
        .post("https://api.lemonsqueezy.com/v1/licenses/activate")
        .header("Accept", "application/json")
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("라이선스 검증 서버 연결 실패: {e}"))?;

    if !response.status().is_success() {
        return Err("유효하지 않은 라이선스 키입니다.".into());
    }

    let json: serde_json::Value = response.json().await.map_err(|e| e.to_string())?;
    let activated = json["activated"].as_bool().unwrap_or(false);
    if !activated {
        return Err("라이선스 활성화에 실패했습니다.".into());
    }

    Ok(())
}

fn verify_order_id(order_id: &str) -> Result<(), String> {
    // 토스/네이버페이는 주문 ID 형식 검증 (실제 서버 검증은 배포 서버에서)
    if order_id.len() < 8 {
        return Err("올바르지 않은 주문 ID입니다.".into());
    }
    Ok(())
}

/// deep-link 콜백 처리: aiflow://payment/callback?key=...
#[tauri::command]
pub async fn handle_payment_callback(
    state: State<'_, AppState>,
    license_key: String,
    provider: String,
) -> Result<LicenseInfo, String> {
    let req = ActivateLicenseRequest { license_key, provider };
    activate_license(state, req).await
}

/// 라이선스 초기화 (테스트/환불용)
#[tauri::command]
pub fn reset_license(state: State<'_, AppState>) -> Result<(), String> {
    // 키체인에서 제거
    let _ = crate::services::keychain::delete_key(KEYCHAIN_LICENSE_KEY);

    let conn = state.db.get_conn().map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE license_info SET tier='free', license_key_ref=NULL, payment_provider=NULL,
         order_id=NULL, activated_at=NULL, expires_at=NULL, updated_at=datetime('now')
         WHERE id=1",
        [],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}
