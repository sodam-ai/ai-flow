# AIFlow 릴리즈 체크리스트 v1.0

> 생성: 2026-03-27 | 모든 릴리즈(stable/beta)에 적용
> **이 체크리스트를 통과하지 못하면 배포 금지**

---

## 개요

```
릴리즈 흐름:
  코드 완료 → QA 게이트 → 보안 게이트 → 성능 게이트
            → 문서 게이트 → 빌드·서명 → 배포 → 사후 모니터링
```

### 릴리즈 채널별 적용 범위

| 체크리스트 섹션 | stable | beta | nightly |
|----------------|--------|------|---------|
| QA 게이트 | 전체 | 전체 | 기본만 |
| 보안 게이트 | 전체 | 전체 | 생략 가능 |
| 성능 게이트 | 전체 | 주요 지표 | 생략 가능 |
| 문서 게이트 | 전체 | 최소 | 생략 |
| 빌드·서명 | Authenticode | Authenticode | 미서명 허용 |
| 사후 모니터링 | 72시간 | 24시간 | 모니터링 없음 |

---

## Phase 1: QA 게이트

### 1.1 단위 테스트

```
[ ] cargo test --workspace 전체 통과
[ ] Rust 커버리지 ≥ 80% (cargo-tarpaulin 보고서 확인)
[ ] npx vitest run 전체 통과
[ ] TypeScript 커버리지 ≥ 75% (vitest --coverage 보고서 확인)
[ ] 실패 테스트 0건 (flaky 테스트도 수정 또는 quarantine 처리)
```

### 1.2 E2E 테스트 (Playwright)

반드시 실제 빌드 바이너리로 실행 (dev 서버 불가):

```
[ ] E2E-01: 앱 시작 → 오버레이 열기 (Alt+Space) → 메시지 전송 → 응답 수신
[ ] E2E-02: API 키 등록 → OS 키체인 저장 → 재시작 후 유지 확인
[ ] E2E-03: 파일 첨부 → PDF/이미지 업로드 → 응답에 내용 반영 확인
[ ] E2E-04: Pro 기능 잠금 → 업그레이드 안내 다이얼로그 노출 확인
[ ] E2E-05: 프라이버시 모드 → 로컬 DB에 저장 안 됨 확인
[ ] E2E-06: 앱 업데이트 → 알림 → 재시작 → 새 버전 부팅 확인
```

### 1.3 회귀 테스트

```
[ ] 이전 버전 대비 기능 회귀 없음 (CHANGELOG 대비 수동 확인)
[ ] Windows 10 21H2 (빌드 19044) 최소 요구 환경에서 실행 확인
[ ] Windows 11 최신 버전 실행 확인
[ ] Alt+Space 단축키 충돌 없음 (Win11 스냅 레이아웃 등)
[ ] 한국어/영어 UI 렌더링 이상 없음
```

### 1.4 접근성 (WCAG 2.1 AA)

```
[ ] axe-core 자동 점검 → 위반 0건 (critical, serious)
[ ] 키보드 전용 조작 전체 흐름 통과
[ ] 포커스 트랩: 오버레이 열림/닫힘 시 포커스 복원 확인
[ ] 색상 대비: 텍스트 4.5:1, 대형 텍스트 3:1 이상
[ ] 스크린리더 (Narrator) 기본 시나리오 통과
```

---

## Phase 2: 보안 게이트

### 2.1 의존성 취약점

```bash
# Rust
cargo audit
# → 취약점 0건 (RUSTSEC-*) 확인
# → unmaintained 경고 검토 후 결정

# npm
npm audit --audit-level=high
# → high/critical 취약점 0건
# → moderate는 검토 후 결정
```

```
[ ] cargo audit 통과 (취약점 0건)
[ ] npm audit high/critical 0건
[ ] 의존성 라이선스 확인 (GPL 오염 없음 — cargo-license, license-checker)
```

### 2.2 비밀 정보 스캔

```bash
# API 키·토큰·비밀번호 하드코딩 스캔
gitleaks detect --source . --verbose
# → 0건 확인

# 추가 패턴 확인
grep -r "sk-" src/ --include="*.rs" --include="*.ts"
grep -r "AIzaSy" src/ --include="*.rs" --include="*.ts"
```

```
[ ] gitleaks 스캔 0건
[ ] API 키 패턴 수동 grep 0건
[ ] .env 파일 .gitignore 포함 확인
[ ] 테스트 코드에 실제 API 키 없음 확인
```

### 2.3 코드 정적 분석

```bash
# Rust
cargo clippy --all-targets --all-features -- -D warnings
# → 경고 0건

# TypeScript
npx eslint src/ --max-warnings 0
# → 경고 0건
```

```
[ ] cargo clippy 경고 0건
[ ] eslint 경고 0건
[ ] unsafe 블록 사용처 검토 및 주석 확인
[ ] SQL 쿼리 parameterized 사용 확인 (인젝션 방지)
```

### 2.4 SQLCipher / 암호화 검증

```
[ ] SQLCipher PBKDF2-SHA512 25만 반복 설정 유지 확인
[ ] DB 파일 암호화 확인: `file aiflow.db` → "data" (헤더 "SQLite" 아님)
[ ] 키체인 저장 API 키 평문 로그 없음 확인
[ ] zeroize 크레이트: API 키 사용 후 메모리 덮어쓰기 코드 경로 확인
```

### 2.5 IPC 검증

```
[ ] invokeValidated() 모든 IPC 핸들러에 적용 확인
[ ] Zod 스키마: 입력값 타입·길이·범위 검증 확인
[ ] tauri_allowlist: 최소 권한 원칙 적용 확인
[ ] 파일시스템 접근: 허용된 경로($APPDATA, $APPDATA/aiflow)만 사용
```

### 2.6 인증·권한

```
[ ] JWT 공개키 번들 경로 확인 (assets/jwt_public_key.pem)
[ ] Pro 라이선스 오프라인 캐시 30일 만료 로직 확인
[ ] LemonSqueezy 웹훅 서명 검증 확인
[ ] 플러그인 샌드박스: 능력 목록 외 API 접근 차단 확인
```

---

## Phase 3: 성능 게이트

### 3.1 벤치마크 기준값

아래 모든 지표가 목표값을 초과하면 배포 차단:

| 지표 | 목표 | 측정 방법 |
|------|------|----------|
| 오버레이 열림 | < 200ms | E2E 타이밍 측정 |
| 첫 번째 토큰 (TTFT) | < 800ms | Playwright 측정 |
| 메모리 유휴 | < 80MB | Windows 작업 관리자 |
| 메모리 30분 사용 | < 200MB | 연속 사용 30분 후 측정 |
| 앱 시작 (cold start) | < 3초 | 타이머 측정 |
| DB 쿼리 p95 | < 50ms | criterion 벤치마크 |
| 번들 크기 | < 15MB | `du -sh` 빌드 출력 |
| 설치 파일 크기 | < 80MB | .msi 파일 크기 |

```
[ ] 오버레이 열림 < 200ms
[ ] TTFT < 800ms (GPT-4o, Claude, Gemini 각각)
[ ] 메모리 유휴 < 80MB
[ ] 메모리 30분 < 200MB (메모리 누수 없음)
[ ] 앱 cold start < 3초
[ ] DB 쿼리 p95 < 50ms
[ ] 번들 크기 < 15MB
[ ] .msi 설치 파일 < 80MB
```

### 3.2 성능 회귀 방지

```bash
# criterion 벤치마크 실행
cargo bench --bench aiflow_bench > bench_current.txt

# 이전 버전 대비 비교
# → 130% 이상 느려진 함수 없음 확인
```

```
[ ] criterion 벤치마크 실행 완료
[ ] 전 버전 대비 성능 회귀 130% 초과 항목 없음
[ ] React DevTools Profiler: 불필요한 리렌더링 없음 확인
[ ] Tauri 번들 분석: 미사용 의존성 없음 확인
```

---

## Phase 4: 문서 게이트

### 4.1 CHANGELOG 업데이트

```markdown
# CHANGELOG.md 필수 항목:
[ ] 버전 번호 (SemVer: MAJOR.MINOR.PATCH)
[ ] 릴리즈 날짜
[ ] 새 기능 목록 (## Added)
[ ] 변경 사항 목록 (## Changed)
[ ] 버그 수정 목록 (## Fixed)
[ ] 보안 수정 (## Security — 존재 시 반드시 포함)
[ ] 하위 호환성 파괴 변경 (## Breaking Changes — 존재 시)
```

### 4.2 버전 번호 동기화

```
[ ] Cargo.toml 버전 업데이트
[ ] package.json 버전 업데이트
[ ] tauri.conf.json version 업데이트
[ ] 세 파일의 버전 번호 일치 확인
```

검증 스크립트:
```bash
CARGO_VER=$(grep '^version' src-tauri/Cargo.toml | head -1 | cut -d'"' -f2)
PKG_VER=$(node -p "require('./package.json').version")
TAURI_VER=$(node -p "require('./src-tauri/tauri.conf.json').package.version")

echo "Cargo: $CARGO_VER | package.json: $PKG_VER | tauri.conf: $TAURI_VER"
[ "$CARGO_VER" = "$PKG_VER" ] && [ "$PKG_VER" = "$TAURI_VER" ] && echo "✅ 버전 일치" || echo "❌ 불일치"
```

### 4.3 업데이트 메타데이터

```
[ ] update-server의 latest.json 업데이트 예정 확인
[ ] 릴리즈 노트 (GitHub Releases) 초안 작성 완료
[ ] 사용자 가이드 변경 내용 반영 (해당 시)
[ ] README 스크린샷·기능 목록 최신화 (major 릴리즈 시)
```

---

## Phase 5: 빌드·서명

### 5.1 클린 빌드

```bash
# 캐시 정리 후 클린 빌드
cargo clean
npm run tauri build -- --target x86_64-pc-windows-msvc
```

```
[ ] 클린 빌드 성공 (캐시 없는 상태)
[ ] 빌드 경고 0건 (warning 허용 안 함)
[ ] .msi 파일 생성 확인: src-tauri/target/release/bundle/msi/AIFlow_*.msi
[ ] .exe 파일 생성 확인 (내부 포함)
```

### 5.2 코드서명 (Windows Authenticode)

Azure Key Vault 기반 서명:

```bash
# Azure Key Vault로 서명
AzureSignTool sign \
  --azure-key-vault-url $AZURE_VAULT_URL \
  --azure-key-vault-client-id $AZURE_CLIENT_ID \
  --azure-key-vault-client-secret $AZURE_CLIENT_SECRET \
  --azure-key-vault-certificate $AZURE_CERT_NAME \
  --timestamp-rfc3161 http://timestamp.digicert.com \
  --file-digest sha256 \
  "AIFlow_${VERSION}_x64_en-US.msi"
```

```
[ ] .msi 파일 서명 완료
[ ] 서명 유효성 확인: sigcheck AIFlow_*.msi
[ ] 서명 인증서: "AIFlow by SoDam AI Studio" 확인
[ ] 타임스탬프 서버 응답 확인 (서명 만료 방지)
[ ] SmartScreen 경고 없음 확인 (신규 릴리즈 시 VirusTotal 업로드)
```

### 5.3 업데이터 서명

```bash
# Tauri 업데이터 서명 키
tauri signer sign \
  --private-key $TAURI_PRIVATE_KEY \
  "AIFlow_${VERSION}_x64_en-US.msi.zip"
```

```
[ ] .msi.zip 파일 생성 확인
[ ] .msi.zip.sig 서명 파일 생성 확인
[ ] latest.json에 서명 값 삽입 예정 확인
```

### 5.4 체크섬 생성

```bash
# SHA-256 체크섬
certutil -hashfile "AIFlow_${VERSION}_x64_en-US.msi" SHA256 > CHECKSUMS.txt
certutil -hashfile "AIFlow_${VERSION}_x64_en-US.msi.zip" SHA256 >> CHECKSUMS.txt
```

```
[ ] CHECKSUMS.txt 생성 완료
[ ] 체크섬 값 GitHub Releases에 포함 예정 확인
```

---

## Phase 6: 배포

### 6.1 GitHub Releases 생성

```
[ ] GitHub Release 드래프트 생성
[ ] 태그 형식: v{MAJOR}.{MINOR}.{PATCH} (예: v1.0.0)
[ ] 릴리즈 노트 첨부 (CHANGELOG에서 해당 버전 섹션)
[ ] 첨부 파일:
    [ ] AIFlow_{VERSION}_x64_en-US.msi
    [ ] AIFlow_{VERSION}_x64_en-US.msi.zip (업데이터용)
    [ ] AIFlow_{VERSION}_x64_en-US.msi.zip.sig
    [ ] CHECKSUMS.txt
[ ] 채널 설정: stable 태그에는 stable, beta 태그에는 pre-release 체크
```

### 6.2 업데이트 서버 갱신

```json
// latest.json (Cloudflare Workers KV)
{
  "version": "1.0.0",
  "notes": "릴리즈 노트 요약",
  "pub_date": "2026-03-27T09:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "url": "https://releases.aiflow.app/AIFlow_1.0.0_x64_en-US.msi.zip",
      "signature": "서명값 (sig 파일 내용)",
      "with_elevated_task": true
    }
  }
}
```

```
[ ] latest.json 업데이트 완료
[ ] Cloudflare Workers KV 반영 확인
[ ] 업데이터 엔드포인트 응답 확인: https://releases.aiflow.app/latest.json
[ ] stable / beta 채널 각각 별도 latest.json 확인
```

### 6.3 GitHub Release 공개

```
[ ] 드래프트 → Publish 전환
[ ] 알림 이메일 발송 (릴리즈 구독자)
[ ] 배포 공지 (Discord, 뉴스레터 등 — 해당 채널)
```

---

## Phase 7: 사후 모니터링

### 7.1 즉시 모니터링 (배포 후 1시간)

```
[ ] Sentry 오류율 급증 없음 확인 (배포 전 대비 2배 이하)
[ ] 충돌 보고 0건 (새 버전 관련)
[ ] 업데이터 자동 업데이트 성공률 확인 (첫 10분)
[ ] SmartScreen 차단 보고 없음
```

### 7.2 24시간 모니터링

```
[ ] Sentry p95 오류율: 전 버전 대비 유의미한 증가 없음
[ ] 메모리 크래시 보고 없음
[ ] API 연결 실패율 정상 범위
[ ] 업데이터 배포율: 첫 24시간 내 30% 이상 (기존 사용자)
[ ] 사용자 피드백 채널 모니터링 (GitHub Issues, Discord)
```

### 7.3 72시간 모니터링 (stable 채널만)

```
[ ] 충돌 보고 10건 미만 (심각 버그 없음)
[ ] 성능 지표 이상 없음 (TTFT, 메모리)
[ ] 업데이터 배포율: 72시간 내 70% 이상
[ ] 사용자 보고 버그 우선순위 분류 완료
[ ] 다음 패치 버전 필요성 판단
```

---

## 롤백 기준

다음 조건 중 하나라도 충족되면 **즉시 롤백**:

### 자동 롤백 트리거

| 조건 | 기준 | 조치 |
|------|------|------|
| 충돌율 급증 | 배포 후 1시간 내 전 버전 5배 이상 | 즉시 롤백 |
| 데이터 손실 | 사용자 대화/설정 유실 보고 | 즉시 롤백 |
| API 키 노출 | 보안 취약점 확인 | 즉시 롤백 + 보안 공지 |
| 업데이터 무한 루프 | 재시작 반복 보고 5건 이상 | 즉시 롤백 |
| SmartScreen 차단 | 대규모 배포 차단 | 즉시 롤백 + 재서명 |

### 롤백 절차

```bash
# 1. latest.json을 이전 버전으로 되돌리기
# Cloudflare Workers KV에서 이전 latest.json 복원

# 2. GitHub Release를 pre-release로 변경 (공개 숨김)
gh release edit v{VERSION} --prerelease

# 3. 긴급 패치 릴리즈 준비
# → 핫픽스 브랜치 생성: hotfix/v{VERSION}.{PATCH+1}
```

```
[ ] 롤백 절차 문서 팀 공유 확인
[ ] Cloudflare KV 이전 버전 백업 확인
[ ] 긴급 연락처 목록 최신화 확인
```

---

## 릴리즈 서명 (Release Sign-off)

모든 체크리스트 항목 완료 후 아래 서명:

```
릴리즈 버전: v_____________________
릴리즈 날짜: _____________________
채널: [ ] stable  [ ] beta

QA 게이트:        [ ] 통과  [ ] 불통과 (사유: _____________)
보안 게이트:      [ ] 통과  [ ] 불통과 (사유: _____________)
성능 게이트:      [ ] 통과  [ ] 불통과 (사유: _____________)
문서 게이트:      [ ] 통과  [ ] 불통과 (사유: _____________)
빌드·서명 게이트: [ ] 통과  [ ] 불통과 (사유: _____________)

최종 승인: _____________________
배포 시작: _____________________
```

---

## 빠른 참조 — 명령어 모음

```bash
# === QA ===
cargo test --workspace                              # Rust 전체 테스트
cargo tarpaulin --workspace --out html              # Rust 커버리지
npx vitest run --coverage                           # TS 테스트 + 커버리지
npx playwright test                                 # E2E 테스트

# === 보안 ===
cargo audit                                         # Rust 취약점
npm audit --audit-level=high                        # npm 취약점
cargo clippy --all-targets -- -D warnings           # Rust 정적 분석
gitleaks detect --source . --verbose                # 비밀 스캔
cargo-license --all-features                        # 라이선스 확인

# === 성능 ===
cargo bench --bench aiflow_bench                    # criterion 벤치마크
npx vite build --analyze                            # 번들 분석

# === 버전 확인 ===
CARGO_VER=$(grep '^version' src-tauri/Cargo.toml | head -1 | cut -d'"' -f2)
PKG_VER=$(node -p "require('./package.json').version")
echo "Cargo=$CARGO_VER | pkg=$PKG_VER"

# === 빌드 ===
cargo clean && npm run tauri build

# === 서명 검증 ===
sigcheck -a "AIFlow_*.msi"
certutil -hashfile "AIFlow_*.msi" SHA256
```

---

> **관련 문서**
> - [06_TEST_SPEC.md](./06_TEST_SPEC.md) — 테스트 전략 전체
> - [07_DEVOPS.md](./07_DEVOPS.md) — CI/CD 파이프라인
> - [05_SECURITY_SPEC.md](./05_SECURITY_SPEC.md) — 보안 명세
> - [10_PERFORMANCE_SPEC.md](./10_PERFORMANCE_SPEC.md) — 성능 목표·벤치마크
> - [11_MONITORING_SPEC.md](./11_MONITORING_SPEC.md) — 모니터링·사후 추적
