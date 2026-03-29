# AIFlow — DevOps 명세서 v1.0

> 생성: 2026-03-27 (v1.0)
> 대상: CI/CD 파이프라인, 빌드·코드서명·배포·업데이트·롤백

---

## 목차

1. [버전 관리 전략](#1-버전-관리-전략)
2. [브랜치 전략](#2-브랜치-전략)
3. [GitHub Actions CI 파이프라인](#3-github-actions-ci-파이프라인)
4. [빌드 매트릭스](#4-빌드-매트릭스)
5. [Windows 코드서명](#5-windows-코드서명)
6. [Tauri Auto-Updater](#6-tauri-auto-updater)
7. [배포 채널 전략](#7-배포-채널-전략)
8. [단계적 배포 (Beta → Stable)](#8-단계적-배포-beta--stable)
9. [Rollback 절차](#9-rollback-절차)
10. [릴리즈 자동화](#10-릴리즈-자동화)
11. [환경 변수 관리](#11-환경-변수-관리)
12. [모니터링 및 에러 수집](#12-모니터링-및-에러-수집)

---

## 1. 버전 관리 전략

### Semantic Versioning (SemVer 2.0)

```
MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]

예시:
  1.0.0          — GA 정식 출시
  1.1.0          — 새 기능 추가 (하위 호환)
  1.1.1          — 버그 수정
  1.2.0-beta.1   — 베타 채널
  1.2.0-beta.2   — 베타 업데이트
```

### 버전 bump 규칙

| 변경 유형 | 버전 bump | 예시 |
|-----------|-----------|------|
| 하위 비호환 API 변경, DB 마이그레이션 불가 | MAJOR | DB 스키마 삭제·rename |
| 새 기능 추가 (하위 호환) | MINOR | 새 AI 제공자, 새 export 형식 |
| 버그 수정, 성능 개선 | PATCH | 크래시 수정, 응답속도 개선 |
| 보안 패치 | PATCH (긴급 배포) | CVE 대응 |

### 버전 파일 위치

```
src-tauri/Cargo.toml         → version = "1.0.0"
src-tauri/tauri.conf.json    → "version": "1.0.0"
package.json                 → "version": "1.0.0"
```

**규칙**: 세 파일의 버전이 항상 일치해야 함. 불일치 시 CI 빌드 실패.

### Changelog 관리

[Keep a Changelog](https://keepachangelog.com/) 형식 준수:

```markdown
## [Unreleased]

## [1.1.0] - 2026-04-15
### Added
- Gemini 2.0 Flash 모델 추가
- 배치 처리 큐 (Phase 2)

### Fixed
- Alt+Space 단축키 Win11 24H2에서 간헐적 미동작 수정

### Security
- SQLCipher PBKDF2 반복 25만 → 30만으로 강화 (키 로테이션 자동 실행)
```

---

## 2. 브랜치 전략

### Git Flow (단순화 버전)

```
main ─────────────────────────────────────── 프로덕션 (stable)
  └── develop ──────────────────────────── 통합 브랜치 (beta)
        ├── feature/smart-routing ────── 기능 개발
        ├── feature/batch-queue ──────── 기능 개발
        ├── fix/hotkey-win11 ─────────── 버그 수정
        └── release/1.1.0 ────────────── 릴리즈 준비
```

### 브랜치 보호 규칙 (GitHub Branch Protection)

| 브랜치 | 규칙 |
|--------|------|
| `main` | PR 필수, 2명 리뷰, CI 통과, force push 금지, 관리자도 동일 적용 |
| `develop` | PR 필수, 1명 리뷰, CI 통과 |
| `release/*` | PR 필수, CI 통과, main merge 후 태그 자동 생성 |

### 커밋 메시지 규칙 (Conventional Commits)

```
<type>(<scope>): <description>

feat(routing): 스마트 AI 라우팅 복잡도 점수 계산 추가
fix(hotkey): Alt+Space Win11 24H2 충돌 수정
security(db): SQLCipher PBKDF2 반복 횟수 30만으로 강화
perf(stream): 토큰 스트리밍 버퍼 크기 최적화
docs(prd): Phase 2 브라우저 확장 명세 추가
chore(deps): tauri 2.10 → 2.11 업그레이드
```

**허용 type**: `feat`, `fix`, `security`, `perf`, `refactor`, `test`, `docs`, `chore`, `ci`

---

## 3. GitHub Actions CI 파이프라인

### 파이프라인 전체 흐름

```
PR 오픈 / push
  │
  ├── [병렬] check.yml ─────── Rust clippy + fmt check (3분)
  ├── [병렬] test.yml ──────── Rust unit + TS Vitest (5분)
  │
  └── [조건: main/develop] build.yml ─── 풀 빌드 + E2E (15분)
        │
        ├── build-windows-x64
        └── [조건: 태그] release.yml ─── 코드서명 + 배포 (20분)
```

### `.github/workflows/check.yml`

```yaml
name: Check

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [develop]

jobs:
  rust-check:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          components: clippy, rustfmt

      - name: Cache Rust
        uses: Swatinem/rust-cache@v2
        with:
          workspaces: src-tauri

      - name: Clippy
        run: cargo clippy --all-targets --all-features -- -D warnings
        working-directory: src-tauri

      - name: Format check
        run: cargo fmt --check
        working-directory: src-tauri

  ts-check:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install deps
        run: npm ci

      - name: TypeScript check
        run: npx tsc --noEmit

      - name: Lint
        run: npm run lint

  version-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Check version consistency
        run: |
          CARGO_VER=$(grep '^version' src-tauri/Cargo.toml | head -1 | sed 's/.*= "//;s/"//')
          TAURI_VER=$(jq -r '.package.version' src-tauri/tauri.conf.json)
          NPM_VER=$(jq -r '.version' package.json)

          echo "Cargo.toml: $CARGO_VER"
          echo "tauri.conf.json: $TAURI_VER"
          echo "package.json: $NPM_VER"

          if [ "$CARGO_VER" != "$TAURI_VER" ] || [ "$CARGO_VER" != "$NPM_VER" ]; then
            echo "❌ Version mismatch! All three files must have the same version."
            exit 1
          fi
          echo "✅ Version consistency check passed: $CARGO_VER"
```

### `.github/workflows/test.yml`

```yaml
name: Test

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [develop]

jobs:
  rust-test:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable

      - name: Cache Rust
        uses: Swatinem/rust-cache@v2
        with:
          workspaces: src-tauri

      - name: Install cargo-tarpaulin
        run: cargo install cargo-tarpaulin --locked

      - name: Run tests with coverage
        run: |
          cargo tarpaulin \
            --out Xml \
            --output-dir coverage \
            --exclude-files "src/main.rs" \
            --timeout 300
        working-directory: src-tauri

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: src-tauri/coverage/cobertura.xml
          flags: rust
          fail_ci_if_error: true

      - name: Check coverage threshold
        run: |
          COV=$(grep -oP 'line-rate="\K[0-9.]+' src-tauri/coverage/cobertura.xml | head -1)
          echo "Coverage: ${COV}"
          python3 -c "
          cov = float('$COV')
          if cov < 0.80:
              print(f'❌ Rust coverage {cov*100:.1f}% < 80% threshold')
              exit(1)
          print(f'✅ Rust coverage {cov*100:.1f}% >= 80%')
          "

  ts-test:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install deps
        run: npm ci

      - name: Run Vitest with coverage
        run: npm run test:coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: coverage/coverage-final.json
          flags: typescript
          fail_ci_if_error: true

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Scan for hardcoded secrets
        run: |
          # API 키 패턴 스캔
          if grep -rE '(sk-[a-zA-Z0-9]{32,}|AIza[0-9A-Za-z-_]{35}|anthropic[_-]api[_-]key\s*=\s*["\x27]sk-)' \
            --include="*.rs" --include="*.ts" --include="*.tsx" \
            --exclude-dir=".git" --exclude-dir="node_modules" .; then
            echo "❌ Hardcoded API keys detected!"
            exit 1
          fi
          echo "✅ No hardcoded secrets found"

      - name: cargo-audit
        uses: rustsec/audit-check@v2
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: npm audit
        run: npm audit --audit-level=high

      # ── SBOM (소프트웨어 자재 명세서) 생성 ──────────────────────
      - name: Generate Rust SBOM (CycloneDX)
        run: |
          cargo install cargo-cyclonedx --locked
          cargo cyclonedx --format json --output-file sbom-rust.json
          echo "✅ Rust SBOM 생성 완료"

      - name: Generate npm SBOM (CycloneDX)
        run: |
          npm install -g @cyclonedx/cyclonedx-npm
          cyclonedx-npm --output-format JSON --output-file sbom-npm.json
          echo "✅ npm SBOM 생성 완료"

      - name: Merge & Upload SBOM
        uses: actions/upload-artifact@v4
        with:
          name: sbom-${{ github.sha }}
          path: |
            sbom-rust.json
            sbom-npm.json
          retention-days: 90

      - name: SBOM Vulnerability Scan (Grype)
        run: |
          curl -sSfL https://raw.githubusercontent.com/anchore/grype/main/install.sh | sh -s -- -b /usr/local/bin
          grype sbom:sbom-rust.json --fail-on high
          grype sbom:sbom-npm.json --fail-on high
          echo "✅ SBOM 취약점 스캔 통과"
```

### `.github/workflows/build.yml`

```yaml
name: Build

on:
  push:
    branches: [main, develop]
  workflow_dispatch:
    inputs:
      channel:
        description: 'Release channel'
        required: true
        default: 'beta'
        type: choice
        options: [beta, stable]

jobs:
  build-windows:
    runs-on: windows-latest
    strategy:
      matrix:
        include:
          - arch: x64
            target: x86_64-pc-windows-msvc

    steps:
      - uses: actions/checkout@v4

      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.target }}

      - name: Cache Rust
        uses: Swatinem/rust-cache@v2
        with:
          workspaces: src-tauri
          key: ${{ matrix.target }}

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install deps
        run: npm ci

      - name: Build frontend
        run: npm run build

      - name: Build Tauri app (unsigned)
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          args: --target ${{ matrix.target }}

      - name: Upload unsigned artifact
        uses: actions/upload-artifact@v4
        with:
          name: aiflow-unsigned-${{ matrix.arch }}
          path: |
            src-tauri/target/${{ matrix.target }}/release/bundle/msi/*.msi
            src-tauri/target/${{ matrix.target }}/release/bundle/nsis/*.exe
          retention-days: 7
```

---

## 4. 빌드 매트릭스

### 지원 플랫폼 (Phase 1)

| 플랫폼 | 아키텍처 | 최소 요구사항 | 인스톨러 형식 |
|--------|----------|--------------|--------------|
| Windows 10 21H2+ | x64 | 빌드 19044 | NSIS (.exe) + MSI (.msi) |
| Windows 11 | x64 | 빌드 22000 | NSIS (.exe) + MSI (.msi) |

**Phase 2 추가 예정**: macOS (arm64 + x64), Linux (AppImage + deb)

### Tauri 빌드 설정 (`src-tauri/tauri.conf.json`)

```json
{
  "build": {
    "beforeBuildCommand": "npm run build",
    "frontendDist": "../dist"
  },
  "bundle": {
    "active": true,
    "targets": ["nsis", "msi"],
    "identifier": "com.sodamai.aiflow",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "windows": {
      "certificateThumbprint": null,
      "digestAlgorithm": "sha256",
      "timestampUrl": "http://timestamp.digicert.com"
    },
    "nsis": {
      "installMode": "perMachine",
      "languages": ["Korean", "English"],
      "displayLanguageSelector": true
    }
  }
}
```

### 빌드 최적화

```toml
# src-tauri/Cargo.toml

[profile.release]
opt-level = 3
lto = "thin"        # 링크 시간 최적화 (빌드 시간↑, 바이너리 크기↓)
codegen-units = 1   # 최대 최적화
strip = true        # 디버그 심볼 제거
panic = "abort"     # unwind 대신 abort (바이너리 크기 감소)

[profile.dev]
opt-level = 0
debug = true
```

---

## 5. Windows 코드서명

### 코드서명 필요 이유

Windows SmartScreen은 서명되지 않은 EXE/MSI를 "알 수 없는 앱"으로 차단. 초기에 서명 평판이 쌓이면 경고 빈도 감소.

### 인증서 종류 비교

| 종류 | 가격 | SmartScreen 경고 | 권장 시점 |
|------|------|-----------------|----------|
| OV (Organization Validation) | $200-300/년 | 일부 경고 | Phase 1 |
| EV (Extended Validation) | $400-600/년 | 즉시 신뢰 | Phase 2 이후 |
| 추천 발급처 | DigiCert, Sectigo | | |

### 코드서명 워크플로우 (`release.yml`)

```yaml
name: Release

on:
  push:
    tags:
      - 'v*.*.*'
      - 'v*.*.*-beta.*'

jobs:
  sign-and-release:
    runs-on: windows-latest
    environment: production  # GitHub Environment 보호 규칙 적용
    steps:
      - uses: actions/checkout@v4

      # 서명되지 않은 아티팩트 다운로드
      - name: Download unsigned artifact
        uses: actions/download-artifact@v4
        with:
          name: aiflow-unsigned-x64
          path: dist/

      # Azure Key Vault를 통한 코드서명 (인증서를 GitHub Secrets에 저장하지 않음)
      - name: Sign with Azure Key Vault
        uses: azure/azure-code-signing-action@v1
        with:
          azure-tenant-id: ${{ secrets.AZURE_TENANT_ID }}
          azure-client-id: ${{ secrets.AZURE_CLIENT_ID }}
          azure-client-secret: ${{ secrets.AZURE_CLIENT_SECRET }}
          endpoint: ${{ secrets.AZURE_CS_ENDPOINT }}
          code-signing-account-name: ${{ secrets.AZURE_CS_ACCOUNT }}
          certificate-profile-name: ${{ secrets.AZURE_CS_PROFILE }}
          files-folder: dist/
          files-folder-filter: 'exe,msi'
          file-digest: SHA256
          timestamp-rfc3161: http://timestamp.acs.microsoft.com
          timestamp-digest: SHA256

      # 서명 검증
      - name: Verify signatures
        shell: powershell
        run: |
          Get-ChildItem dist/ -Include @("*.exe","*.msi") -Recurse | ForEach-Object {
            $sig = Get-AuthenticodeSignature $_
            if ($sig.Status -ne "Valid") {
              Write-Error "❌ Signature invalid: $($_.Name) - $($sig.Status)"
              exit 1
            }
            Write-Host "✅ Valid: $($_.Name) - $($sig.SignerCertificate.Subject)"
          }

      # GitHub Release 생성
      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          files: |
            dist/*.exe
            dist/*.msi
          generate_release_notes: true
          prerelease: ${{ contains(github.ref, 'beta') }}
          body_path: RELEASE_NOTES.md
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

### 대안: PFX 파일 직접 사용 (소규모 초기)

```yaml
# Azure Key Vault 없이 PFX 직접 서명 (임시 방안)
- name: Decode certificate
  shell: bash
  run: |
    echo "${{ secrets.WIN_CERTIFICATE }}" | base64 -d > certificate.pfx

- name: Sign with signtool
  shell: powershell
  run: |
    $signtool = "C:\Program Files (x86)\Windows Kits\10\bin\10.0.22621.0\x64\signtool.exe"
    & $signtool sign `
      /fd SHA256 `
      /td SHA256 `
      /tr http://timestamp.digicert.com `
      /p "${{ secrets.WIN_CERTIFICATE_PASSWORD }}" `
      /f certificate.pfx `
      dist\*.exe dist\*.msi

- name: Cleanup certificate
  if: always()
  run: Remove-Item certificate.pfx -ErrorAction SilentlyContinue
```

**보안 주의**: PFX 비밀번호는 GitHub Repository Secret에 저장. 인증서 파일은 Base64 인코딩. 가능하면 Azure Key Vault 방식 사용 권장.

---

## 6. Tauri Auto-Updater

### 업데이트 아키텍처

```
앱 시작 시 (백그라운드)
  │
  ├── GET https://update.aiflow.app/check?version=1.0.0&channel=stable
  │     응답: { version, url, signature, notes }
  │
  ├── 업데이트 있음? → 사용자에게 알림 토스트
  │     "새 버전 1.1.0이 있습니다. 업데이트하시겠습니까?"
  │
  └── 동의 → NSIS 인스톨러 다운로드 → 서명 검증 → 설치 → 재시작
```

### 업데이트 서버 응답 형식

```json
{
  "version": "1.1.0",
  "notes": "스마트 AI 라우팅 개선, 버그 수정",
  "pub_date": "2026-04-15T10:00:00Z",
  "platforms": {
    "windows-x86_64": {
      "signature": "dW50cnVzdGVkIGNvbW1lbnQ...",
      "url": "https://github.com/sodamai/aiflow/releases/download/v1.1.0/AIFlow_1.1.0_x64-setup.exe"
    }
  }
}
```

### `src-tauri/tauri.conf.json` 업데이터 설정

```json
{
  "plugins": {
    "updater": {
      "active": true,
      "dialog": true,
      "endpoints": [
        "https://update.aiflow.app/{{target}}/{{current_version}}",
        "https://github.com/sodamai/aiflow/releases/latest/download/latest.json"
      ],
      "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk..."
    }
  }
}
```

### 업데이트 서버 (Cloudflare Workers)

```typescript
// update-server/worker.ts
// Cloudflare Workers로 간단한 업데이트 서버 구현

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const [, target, currentVersion] = url.pathname.split('/');

    // GitHub API로 최신 릴리즈 조회
    const release = await fetch(
      'https://api.github.com/repos/sodamai/aiflow/releases/latest',
      { headers: { 'User-Agent': 'AIFlow-Updater' } }
    ).then(r => r.json());

    const latestVersion = release.tag_name.replace('v', '');

    // 현재 버전과 동일하면 204 No Content
    if (latestVersion === currentVersion) {
      return new Response(null, { status: 204 });
    }

    // 플랫폼별 아셋 찾기
    const platformMap: Record<string, string> = {
      'windows-x86_64': 'x64-setup.exe',
    };

    const suffix = platformMap[target];
    if (!suffix) {
      return new Response('Unsupported platform', { status: 400 });
    }

    const asset = release.assets.find((a: any) =>
      a.name.includes(suffix) && !a.name.includes('.sig')
    );
    const sigAsset = release.assets.find((a: any) =>
      a.name.includes(suffix) && a.name.includes('.sig')
    );

    if (!asset || !sigAsset) {
      return new Response('Release asset not found', { status: 404 });
    }

    const signature = await fetch(sigAsset.browser_download_url).then(r => r.text());

    return Response.json({
      version: latestVersion,
      notes: release.body?.slice(0, 500) ?? '',
      pub_date: release.published_at,
      platforms: {
        [target]: {
          signature: signature.trim(),
          url: asset.browser_download_url,
        }
      }
    });
  }
};
```

### 업데이트 키 생성 및 관리

```bash
# Tauri 업데이트 키 쌍 생성 (한 번만 실행)
npx tauri signer generate -w ~/.tauri/aiflow.key

# 생성 결과:
# ~/.tauri/aiflow.key      → 비밀키 (절대 공개 금지, GitHub Secrets에 저장)
# ~/.tauri/aiflow.key.pub  → 공개키 (tauri.conf.json pubkey 필드에 넣음)

# CI에서 서명 (release.yml에 추가)
- name: Sign updater
  run: npx tauri signer sign dist/*.exe dist/*.msi
  env:
    TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
    TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_KEY_PASSWORD }}
```

### 업데이트 UI 동작 (Rust 코드)

```rust
// src-tauri/src/updater.rs
use tauri_plugin_updater::UpdaterExt;

pub fn setup_auto_updater(app: &tauri::AppHandle) {
    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        // 앱 시작 30초 후 업데이트 확인 (즉시 확인 시 UX 방해)
        tokio::time::sleep(tokio::time::Duration::from_secs(30)).await;

        match handle.updater().unwrap().check().await {
            Ok(Some(update)) => {
                let version = update.version.clone();
                let notes = update.body.clone().unwrap_or_default();

                // 프론트엔드에 업데이트 알림 이벤트 발송
                handle.emit("update-available", serde_json::json!({
                    "version": version,
                    "notes": notes,
                })).unwrap();
            }
            Ok(None) => {
                log::debug!("Already up to date");
            }
            Err(e) => {
                log::error!("Update check failed: {e}");
                // 실패해도 앱 동작에 영향 없음 (silent fail)
            }
        }
    });
}

#[tauri::command]
pub async fn install_update(app: tauri::AppHandle) -> Result<(), String> {
    let update = app.updater()
        .map_err(|e| e.to_string())?
        .check()
        .await
        .map_err(|e| e.to_string())?
        .ok_or("No update available")?;

    // 다운로드 진행률 이벤트 발송
    let handle = app.clone();
    update.download_and_install(
        |chunk_length, content_length| {
            handle.emit("update-progress", serde_json::json!({
                "downloaded": chunk_length,
                "total": content_length,
            })).ok();
        },
        || {
            handle.emit("update-ready", ()).ok();
        }
    )
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}
```

---

## 7. 배포 채널 전략

### 채널 구분

| 채널 | 대상 | 업데이트 빈도 | 안정성 |
|------|------|--------------|--------|
| `stable` | 일반 사용자 | 월 1-2회 | 매우 높음 |
| `beta` | 얼리 어답터 (옵트인) | 주 1회 | 높음 |
| `nightly` | 개발자 (옵트인) | 매일 | 중간 |

### 채널별 업데이트 엔드포인트

```
stable : https://update.aiflow.app/stable/{{target}}/{{current_version}}
beta   : https://update.aiflow.app/beta/{{target}}/{{current_version}}
nightly: https://update.aiflow.app/nightly/{{target}}/{{current_version}}
```

### 채널 전환 (Settings에서)

```typescript
// src/stores/settings-store.ts
type UpdateChannel = 'stable' | 'beta' | 'nightly';

// 채널 변경 시 Tauri 설정 업데이트
async function setUpdateChannel(channel: UpdateChannel) {
  await invoke('set_update_channel', { channel });
  // 즉시 업데이트 확인
  await invoke('check_for_updates');
}
```

### 배포 파일 위치 (GitHub Releases)

```
v1.1.0 릴리즈 아셋:
├── AIFlow_1.1.0_x64-setup.exe         (NSIS 인스톨러, 서명됨)
├── AIFlow_1.1.0_x64-setup.exe.sig     (업데이터 서명)
├── AIFlow_1.1.0_x64_en-US.msi         (MSI 인스톨러, 서명됨)
├── AIFlow_1.1.0_x64_en-US.msi.sig     (업데이터 서명)
├── latest.json                         (stable 업데이터 메타데이터)
└── CHECKSUMS.sha256                    (SHA-256 해시)
```

---

## 8. 단계적 배포 (Beta → Stable)

### 릴리즈 절차

```
1. feature 브랜치 → develop PR 머지
   └── CI: check + test 자동 실행

2. develop → release/1.1.0 브랜치 생성
   └── 버전 bump (Cargo.toml, tauri.conf.json, package.json)
   └── CHANGELOG.md 업데이트

3. release/1.1.0 → beta 태그 생성
   └── git tag v1.1.0-beta.1
   └── CI: build + sign + 배포 → beta 채널

4. Beta 테스트 기간 (최소 1주)
   └── 버그 수정은 release/1.1.0에서 핫픽스
   └── 필요 시 v1.1.0-beta.2 배포

5. Stable 승인 → main PR 머지 + stable 태그
   └── git tag v1.1.0
   └── CI: build + sign + 배포 → stable 채널
   └── GitHub Release 공개 게시
```

### 릴리즈 체크리스트

```markdown
## 릴리즈 전 확인사항

### 기능 완성도
- [ ] 이번 버전에 포함된 모든 기능 동작 확인
- [ ] 이전 버전에서 마이그레이션 테스트 (v1.0.0 → v1.1.0)
- [ ] DB 마이그레이션 롤백 테스트

### 품질
- [ ] Rust 테스트 커버리지 80%+ 통과
- [ ] TypeScript 테스트 커버리지 75%+ 통과
- [ ] E2E 6개 시나리오 모두 통과
- [ ] Clippy 경고 0개

### 보안
- [ ] cargo-audit 취약점 0개 (high/critical)
- [ ] npm audit 취약점 0개 (high)
- [ ] 하드코딩된 시크릿 스캔 통과

### 배포
- [ ] 코드서명 검증 완료 (signtool verify)
- [ ] 업데이터 서명 생성 완료 (.sig 파일)
- [ ] CHECKSUMS.sha256 생성
- [ ] CHANGELOG.md 업데이트
- [ ] latest.json 업데이트 서버 배포 확인
```

---

## 9. Rollback 절차

### 긴급 롤백 시나리오

| 상황 | 대응 |
|------|------|
| 크리티컬 버그 (데이터 손실 위험) | 즉시 이전 버전 stable 채널 복구 |
| 보안 취약점 발견 | 해당 버전 GitHub Release 비공개 + 패치 버전 긴급 배포 |
| 업데이터 서버 응답 오류 | 서버 204 응답으로 업데이트 중단 |

### Rollback 실행

```bash
# 1. GitHub Release 비공개 처리
gh release edit v1.1.0 --draft

# 2. latest.json을 이전 버전으로 교체
# update.aiflow.app 서버에서 이전 버전 latest.json 재게시
curl -X PUT https://update.aiflow.app/admin/rollback \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -d '{"channel": "stable", "version": "1.0.1"}'

# 3. 핫픽스 브랜치에서 수정 후 긴급 릴리즈
git checkout -b hotfix/1.1.1 v1.1.0
# ... 수정 ...
git tag v1.1.1
git push origin v1.1.1

# 4. 사용자 공지 (GitHub Discussions + 앱 내 배너)
```

### 사용자 데이터 보호 (Rollback 시)

```rust
// 롤백 시 DB 마이그레이션 다운그레이드
// src-tauri/src/db/migration.rs

pub fn rollback_to_version(conn: &Connection, target_version: i64) -> Result<()> {
    let current = get_schema_version(conn)?;

    // 현재 버전이 타겟보다 높으면 순차적 롤백
    for v in (target_version + 1..=current).rev() {
        apply_down_migration(conn, v)?;
        log::info!("Rolled back migration v{v}");
    }
    Ok(())
}
```

---

## 10. 릴리즈 자동화

### 자동 Changelog 생성

```yaml
# .github/workflows/release.yml 추가 스텝

- name: Generate Changelog
  id: changelog
  uses: mikepenz/release-changelog-builder-action@v4
  with:
    configuration: .github/changelog-config.json
    fromTag: ${{ steps.prev-tag.outputs.tag }}
    toTag: ${{ github.ref }}
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

- name: Write Release Notes
  run: |
    cat > RELEASE_NOTES.md << 'EOF'
    ${{ steps.changelog.outputs.changelog }}
    EOF
```

### `changelog-config.json`

```json
{
  "categories": [
    {
      "title": "## ✨ 새 기능",
      "labels": ["feat"],
      "exhaustive": true
    },
    {
      "title": "## 🐛 버그 수정",
      "labels": ["fix"]
    },
    {
      "title": "## 🔒 보안",
      "labels": ["security"]
    },
    {
      "title": "## ⚡ 성능 개선",
      "labels": ["perf"]
    }
  ],
  "label_extractor": [
    {
      "pattern": "^(feat|fix|security|perf|docs|chore|ci)(\\([a-z]+\\))?:",
      "target": "$1"
    }
  ],
  "template": "#{{CHANGELOG}}\n\n**풀 변경사항**: https://github.com/sodamai/aiflow/compare/#{{FROM_TAG}}...#{{TO_TAG}}"
}
```

### 버전 Bump 자동화 스크립트

```bash
#!/bin/bash
# scripts/bump-version.sh
# 사용: ./scripts/bump-version.sh 1.1.0

set -e

NEW_VERSION=$1
if [ -z "$NEW_VERSION" ]; then
  echo "Usage: $0 <version>"
  exit 1
fi

echo "Bumping version to $NEW_VERSION..."

# Cargo.toml
sed -i "s/^version = \".*\"/version = \"$NEW_VERSION\"/" src-tauri/Cargo.toml

# tauri.conf.json
jq --arg v "$NEW_VERSION" '.package.version = $v' \
  src-tauri/tauri.conf.json > tmp.json && mv tmp.json src-tauri/tauri.conf.json

# package.json
jq --arg v "$NEW_VERSION" '.version = $v' \
  package.json > tmp.json && mv tmp.json package.json

echo "✅ Version bumped to $NEW_VERSION"
echo "Files updated: src-tauri/Cargo.toml, src-tauri/tauri.conf.json, package.json"

# 변경 확인
grep -E '^version' src-tauri/Cargo.toml
jq '.package.version' src-tauri/tauri.conf.json
jq '.version' package.json
```

---

## 11. 환경 변수 관리

### GitHub Repository Secrets 목록

| Secret 이름 | 설명 | 보안 수준 |
|------------|------|----------|
| `AZURE_TENANT_ID` | Azure 코드서명 테넌트 | High |
| `AZURE_CLIENT_ID` | Azure 서비스 주체 ID | High |
| `AZURE_CLIENT_SECRET` | Azure 서비스 주체 비밀 | Critical |
| `AZURE_CS_ENDPOINT` | 코드서명 엔드포인트 | Medium |
| `AZURE_CS_ACCOUNT` | 코드서명 계정명 | Medium |
| `AZURE_CS_PROFILE` | 인증서 프로파일 | Medium |
| `TAURI_SIGNING_PRIVATE_KEY` | 업데이터 서명 비밀키 | Critical |
| `TAURI_SIGNING_KEY_PASSWORD` | 비밀키 암호 | Critical |
| `UPDATE_SERVER_ADMIN_TOKEN` | 업데이트 서버 관리 토큰 | High |
| `CODECOV_TOKEN` | 코드 커버리지 업로드 | Low |

### GitHub Environment 설정

```yaml
# production 환경 — stable 릴리즈만 해당
environments:
  production:
    protection_rules:
      - required_reviewers:
          - sodamai/core-team  # 최소 1명 승인 필요
      - wait_timer: 300        # 5분 대기 (취소 기회)
    deployment_branch_policy:
      protected_branches: true
      custom_branches:
        - pattern: "release/*"

  beta:
    protection_rules: []       # beta는 자동 배포
```

### 로컬 개발 환경 변수 (`.env.local` — gitignore 대상)

```bash
# 개발 시 필요한 환경 변수 (절대 커밋 금지)
# API 키는 앱 자체의 Settings UI를 통해 OS 키체인에 저장
# 아래는 CI/CD 관련 로컬 테스트용만

# 업데이트 서버 로컬 테스트
UPDATER_ENDPOINT=http://localhost:3000

# Playwright E2E 테스트 (API 키 없이 mock 사용)
E2E_MOCK_AI=true
```

---

## 12. 모니터링 및 에러 수집

### Sentry 통합 (오픈소스 self-hosted 또는 Sentry.io)

**원칙**: PII 데이터는 Sentry로 전송하지 않음. 대화 내용·API 키·파일 내용 절대 전송 금지.

```toml
# src-tauri/Cargo.toml
[dependencies]
sentry = { version = "0.34", features = ["backtrace", "contexts"] }
```

```rust
// src-tauri/src/main.rs
fn main() {
    let _guard = sentry::init(sentry::ClientOptions {
        dsn: option_env!("SENTRY_DSN").and_then(|s| s.parse().ok()),
        release: sentry::release_name!(),
        traces_sample_rate: 0.1,  // 트랜잭션 10% 샘플링
        before_send: Some(std::sync::Arc::new(|event| {
            // PII 필터링 — 대화 내용 포함 이벤트 제거
            if event.message.as_deref()
                .map(|m| m.contains("message") || m.contains("api_key"))
                .unwrap_or(false) {
                return None;  // 전송 차단
            }
            Some(event)
        })),
        ..Default::default()
    });

    // 앱 실행 ...
}
```

### 앱 내 에러 로그 수집 (로컬 전용)

```rust
// src-tauri/src/db/error_log.rs
// ErrorLog 테이블에 에러 기록 (06_TEST_SPEC.md§ DB 참조)
// 90일 자동 삭제 정책

pub async fn record_error(
    db: &Database,
    error_code: &str,
    provider_id: Option<i64>,
    context: &str,
    raw_error: &str,
) -> Result<()> {
    sqlx::query!(
        "INSERT INTO error_log (error_code, provider_id, context, raw_error, created_at)
         VALUES (?1, ?2, ?3, ?4, datetime('now'))",
        error_code, provider_id, context, raw_error
    )
    .execute(db.pool())
    .await?;

    Ok(())
}

// 90일 초과 로그 자동 삭제 (앱 시작 시 실행)
pub async fn apply_retention(db: &Database) -> Result<()> {
    sqlx::query!(
        "DELETE FROM error_log WHERE created_at < datetime('now', '-90 days')"
    )
    .execute(db.pool())
    .await?;
    Ok(())
}
```

### 배포 후 모니터링 체크리스트

```markdown
## 릴리즈 후 24시간 모니터링

- [ ] Sentry — 새 에러 급증 없음 (임계값: 릴리즈 전 대비 200% 이상 시 Rollback)
- [ ] GitHub Issues — 사용자 버그 리포트 모니터링
- [ ] GitHub Discussions — 업데이트 관련 피드백
- [ ] Update Server — 업데이트 요청 정상 처리 확인
- [ ] GitHub Actions — 배포 워크플로우 성공 확인
```

---

## 확정된 DevOps 결정사항

| # | 항목 | 확정값 |
|---|------|--------|
| 1 | 버전 관리 | SemVer 2.0, Conventional Commits |
| 2 | 브랜치 전략 | Git Flow 단순화 (main/develop/feature/release) |
| 3 | CI 플랫폼 | GitHub Actions |
| 4 | 빌드 대상 | Windows x64 (Win10 21H2+, Win11) |
| 5 | 코드서명 | Azure Key Vault + Windows Authenticode (SHA-256) |
| 6 | 타임스탬프 서버 | http://timestamp.digicert.com |
| 7 | 업데이터 | Tauri updater plugin + Cloudflare Workers |
| 8 | 배포 채널 | stable / beta / nightly |
| 9 | 인스톨러 형식 | NSIS (.exe) + MSI (.msi) |
| 10 | 에러 수집 | Sentry (PII 필터링 필수) |
| 11 | 릴리즈 자동화 | GitHub Actions + release-changelog-builder |
| 12 | macOS/Linux | Phase 2 이후 검토 |
| 13 | SBOM | CycloneDX (Rust + npm) — 모든 PR·릴리즈 자동 생성 |
| 14 | SBOM 취약점 스캔 | Grype (high 이상 발견 시 CI 실패) |
| 15 | SBOM 보존 | GitHub Artifacts 90일 보존 |
