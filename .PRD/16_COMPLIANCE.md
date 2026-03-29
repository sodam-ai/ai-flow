# AIFlow — 컴플라이언스 명세 v1.0

> 생성: 2026-03-28 (v1.0)
> 개인정보 처리·결제·라이선스 관련 코드 작성 시 이 문서를 반드시 함께 제공하세요.

---

## 1. 적용 법령

| 법령 | 적용 이유 | 주요 의무 |
|------|----------|----------|
| **PIPA (개인정보보호법, 한국)** | 한국 사용자 대상 서비스 | 수집 최소화, 동의, 열람·삭제권 |
| **GDPR (EU)** | 글로벌 배포 (EU 거주자 사용 가능) | 처리 근거, 삭제권, 데이터 이동권 |
| **CCPA (캘리포니아)** | 미국 사용자 대상 | 판매 금지, 삭제권, 공개 의무 |

---

## 2. 수집 데이터 인벤토리

### 2.1 로컬 저장 데이터 (서버 미전송)

| 데이터 | 저장 위치 | 보존 기간 | 법적 근거 |
|--------|----------|----------|----------|
| AI 대화 내용 | SQLCipher DB (로컬) | 사용자 삭제 시까지 | 계약 이행 |
| AI Provider API 키 | OS 키체인 | 사용자 삭제 시까지 | 계약 이행 |
| 프롬프트 저장고 | SQLCipher DB (로컬) | 사용자 삭제 시까지 | 계약 이행 |
| AI 페르소나 | SQLCipher DB (로컬) | 사용자 삭제 시까지 | 계약 이행 |
| 비용 사용 내역 | SQLCipher DB (로컬) | 3년 (부가세법) | 법적 의무 |
| 앱 설정값 | tauri-plugin-store | 앱 삭제 시까지 | 계약 이행 |

### 2.2 서버 전송 데이터

| 데이터 | 전송 대상 | 목적 | 수집 최소화 조치 |
|--------|----------|------|-----------------|
| AI 메시지 | AI Provider (OpenAI/Anthropic/Google) | AI 응답 생성 | 사용자가 직접 입력한 내용만 |
| 익명 사용 통계 | Sentry (오류), 자체 분석 서버 | 오류 추적·제품 개선 | 대화 내용·API 키 절대 미포함 |
| 기기 식별자 (랜덤 UUID) | 라이선스 서버 | 기기 수 제한 | 하드웨어 ID 아닌 랜덤 UUID |
| Pro 결제 정보 | LemonSqueezy (글로벌) / 토스페이먼츠 (한국) | 결제 처리 | 카드 정보는 결제 대행사만 보관 |
| 앱 버전, OS 버전 | 업데이트 서버 | 호환 업데이트 제공 | 식별자 미포함 |

### 2.3 절대 수집 금지

```
❌ AI 대화 내용 → 자체 서버에 절대 미전송
❌ AI Provider API 키 → 자체 서버에 절대 미전송
❌ 하드웨어 ID (CPU ID, 디스크 시리얼) → 수집 금지 (v3.6: 랜덤 UUID로 교체)
❌ 위치 정보 → 수집 금지
❌ 생체 정보 → 수집 금지
```

---

## 3. 기기 식별자 정책 (v3.6 변경)

### 3.1 변경 내용

| 항목 | v3.5 이전 (문제) | v3.6 (수정) |
|------|----------------|------------|
| 식별자 유형 | CPU ID + 디스크 시리얼 해시 | 랜덤 UUID (암호학적 난수) |
| 저장 위치 | 미정의 | OS 키체인 (`aiflow/device_id`) |
| PIPA 준수 | ❌ 하드웨어 ID = 개인정보 해당 가능 | ✅ 비식별 난수 |
| 기기 변경 시 | CPU/디스크 교체 시 라이선스 분실 | 수동 이전 절차 제공 |

### 3.2 기기 ID 구현

```rust
// src-tauri/src/services/device_id.rs
use uuid::Uuid;
use tauri_plugin_keyring::KeyringExt;

/// 기기 고유 식별자 — 최초 실행 시 생성, OS 키체인에 저장
/// 하드웨어 ID(CPU, 디스크)를 절대 사용하지 않음 (PIPA 준수)
pub fn get_or_create_device_id(app: &tauri::AppHandle) -> Result<String, String> {
    const SERVICE: &str = "aiflow";
    const KEY: &str = "device_id";

    // 기존 ID 조회
    if let Ok(id) = app.keyring().get_password(SERVICE, KEY) {
        return Ok(id);
    }

    // 최초 실행: 암호학적 난수 UUID 생성
    let new_id = Uuid::new_v4().to_string();
    app.keyring()
        .set_password(SERVICE, KEY, &new_id)
        .map_err(|e| format!("기기 ID 저장 실패: {}", e))?;

    tracing::info!("새 기기 ID 생성 (랜덤 UUID, 하드웨어 정보 미사용)");
    Ok(new_id)
}
```

### 3.3 기기 이전 절차

사용자가 기기를 교체하거나 OS를 재설치할 때 라이선스를 유지하는 방법:

1. 기존 기기에서 `설정 > 라이선스 > 기기 이전 코드 생성` (15분 유효)
2. 새 기기에서 `설정 > 라이선스 > 이전 코드 입력`
3. 라이선스 서버에서 기존 기기 ID 제거 + 새 기기 ID 등록

---

## 4. 사용자 권리 구현 (PIPA + GDPR)

### 4.1 열람권 (Right of Access)

```typescript
// 사용자가 앱이 보관한 자신의 모든 데이터를 확인
// 설정 > 개인정보 > 내 데이터 보기
export async function getUserDataSummary(): Promise<UserDataSummary> {
  return invokeValidated('get_user_data_summary', {}, UserDataSummarySchema);
}

// Rust: 모든 로컬 데이터 집계 반환
// - 대화 수, 메시지 수, 프롬프트 수, 페르소나 수
// - 비용 총계
// - API 키 저장 여부 (값은 절대 반환 안 함)
// - 감사 로그 최근 30건
```

### 4.2 삭제권 (Right to Erasure — "잊혀질 권리")

```typescript
// 설정 > 개인정보 > 모든 데이터 삭제
export async function deleteAllUserData(): Promise<void> {
  // 확인 다이얼로그 표시 후
  await invokeValidated('delete_all_user_data', {}, z.void());
}
```

```rust
// Rust: 완전 삭제 순서
// 1. 진행 중 AI 스트림 전체 취소
// 2. DB 모든 테이블 데이터 삭제 (Cascade Delete)
// 3. OS 키체인 API 키 전체 삭제
// 4. OS 키체인 DB 마스터 키 삭제
// 5. OS 키체인 기기 ID 삭제
// 6. DB 파일 안전 삭제 (덮어쓰기 후 삭제)
// 7. db_salt.bin 삭제
// 8. 임시 파일 전체 삭제
// 9. 익명 분석: "account_deleted" 이벤트만 전송 (내용 없음)
#[tauri::command]
pub async fn delete_all_user_data(app: tauri::AppHandle) -> Result<(), AiFlowError> { ... }
```

### 4.3 데이터 이동권 (Right to Data Portability)

```typescript
// 설정 > 개인정보 > 내 데이터 내보내기
export async function exportAllData(): Promise<void> {
  await invokeValidated('export_all_data', { format: 'json' }, z.void());
}
// 내보내기 형식: JSON (schema_version: "aiflow-export-v1")
// 포함 데이터: 대화, 메시지, 프롬프트, 페르소나, 설정
// 미포함: API 키 (보안상), 비용 내역 (별도 CSV 내보내기)
```

### 4.4 처리 제한권 (Right to Restriction)

```typescript
// Privacy Mode 활성화 = AI 대화를 로컬 DB에 저장하지 않음
// 설정 > 프라이버시 > 저장하지 않는 대화 모드
// (이미 01_PRD.md에 정의됨)
```

---

## 5. 개인정보처리방침 (Privacy Policy) 초안

> 실제 서비스 전 법률 전문가 검토 필수

```markdown
# AIFlow 개인정보처리방침

최종 업데이트: 2026-03-28

## 수집하는 정보

AIFlow는 개인정보 수집을 최소화합니다.

**로컬에만 저장되며 AIFlow 서버로 전송되지 않는 정보:**
- AI 대화 내용 및 메시지
- AI Provider API 키 (OS 키체인에 암호화 저장)
- 프롬프트, 페르소나 설정

**AIFlow 서버로 전송되는 정보:**
- 앱 오류 정보 (대화 내용, API 키 제외한 익명 데이터)
- 라이선스 확인을 위한 익명 기기 식별자 (랜덤 UUID)
- 앱 버전, 운영체제 버전

## 제3자 제공

- AI Provider (OpenAI, Anthropic, Google): 귀하가 입력한 AI 메시지
- 결제 대행사 (LemonSqueezy, 토스페이먼츠): 결제 정보 (카드 정보는 당사 미보관)
- Sentry: 익명화된 앱 오류 정보

## 귀하의 권리

- **열람**: 앱 내 설정 > 개인정보 > 내 데이터 보기
- **삭제**: 앱 내 설정 > 개인정보 > 모든 데이터 삭제
- **이동**: 앱 내 설정 > 개인정보 > 내 데이터 내보내기

## 보안

모든 로컬 데이터는 SQLCipher(AES-256)로 암호화됩니다.
API 키는 OS 키체인에만 저장됩니다.

## 문의

privacy@aiflow.app
```

---

## 6. 결제 컴플라이언스

### 6.1 LemonSqueezy (글로벌)

```typescript
// 환불 정책: 구매 후 14일 이내 (EU 소비자 보호법 준수)
// 카드 정보: LemonSqueezy에서만 처리, AIFlow 서버 미경유
// 부가세: LemonSqueezy가 국가별 자동 처리 (한국 제외)

const LEMON_SQUEEZY_PRODUCT_IDS = {
  pro_monthly_global: process.env.LS_PRODUCT_MONTHLY_GLOBAL,
  pro_yearly_global: process.env.LS_PRODUCT_YEARLY_GLOBAL,
} as const;
```

### 6.2 토스페이먼츠 (한국)

```typescript
// 정기결제: 토스페이먼츠 빌링키 방식
// 부가세: 한국 10% 자동 포함 (₩14,900 = VAT 포함 가격)
// 현금영수증: 토스페이먼츠 자동 발행
// 환불: 30일 이내 전액 환불 (공정거래위원회 전자상거래 표준약관)

// 중요: 한국 결제 시 주민등록번호 수집 절대 금지
// 휴대폰 인증은 토스페이먼츠가 처리, AIFlow는 결과만 수신
```

---

## 7. PIPA 준수 체크리스트

### Phase 1 출시 전 필수

- [ ] 개인정보처리방침 앱 내 접근 가능 (설정 화면)
- [ ] 최초 실행 시 개인정보처리방침 동의 화면
- [ ] 익명 분석 수집 옵트아웃 옵션 (설정 > 프라이버시)
- [ ] 데이터 삭제 기능 구현 (`delete_all_user_data`)
- [ ] 기기 식별자를 랜덤 UUID로 사용 (하드웨어 ID 금지) ✅ v3.6
- [ ] AI 대화 내용을 자체 서버로 미전송 확인 (코드 감사)
- [ ] API 키를 자체 서버로 미전송 확인 (코드 감사)
- [ ] Sentry PII 필터 적용 (`11_MONITORING_SPEC.md` §4)

### Phase 2 출시 전 필수

- [ ] 브라우저 확장 별도 개인정보처리방침
- [ ] 클립보드 접근 권한 최소화 + 안내
- [ ] 한국어 개인정보처리방침 법률 검토

### Phase 3 출시 전 필수

- [ ] 플러그인 마켓 개인정보처리방침
- [ ] 제3자 플러그인 개인정보 처리 고지
- [ ] PIPA 개인정보보호책임자(CPO) 지정

---

## 8. 데이터 보존 정책

| 데이터 유형 | 보존 기간 | 삭제 방법 |
|------------|----------|----------|
| AI 대화 내용 | 사용자 삭제 시까지 | 사용자 직접 삭제 + 자동 완전 삭제 |
| 비용 사용 내역 | 5년 (부가세법 §35: 장부 5년 보존) | 만료 후 자동 삭제 |
| 감사 로그 | 1년 | 만료 후 자동 삭제 |
| 임시 파일 | 처리 완료 즉시 | TempFileGuard 자동 삭제 |
| Sentry 오류 로그 | 90일 (Sentry 기본) | Sentry 자동 삭제 |

---

## 9. 제3자 서비스 데이터 처리 계약 (DPA)

Phase 1 출시 전 체결 필요:

| 서비스 | DPA 필요 | 위치 |
|--------|---------|------|
| OpenAI | ✅ | https://openai.com/policies/data-processing-addendum |
| Anthropic | ✅ | Anthropic API 이용약관 §데이터 처리 |
| Google AI | ✅ | Google Cloud DPA |
| Sentry | ✅ | Sentry DPA (GDPR) |
| LemonSqueezy | ✅ | LemonSqueezy DPA |
| 토스페이먼츠 | ✅ | 토스페이먼츠 정보처리위탁 계약 |
