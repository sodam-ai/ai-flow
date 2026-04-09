import { useEffect, useState } from "react";
import {
  Crown, Check, ExternalLink, Key, Globe,
  RefreshCw, Monitor, Loader2, AlertCircle,
} from "lucide-react";
import type { LicenseInfo, ProFeatures } from "@/types";
import {
  getLicenseStatus, getProFeatures,
  createLemonsqueezyCheckout, createTossCheckout, createNaverpayCheckout,
  activateLicense,
  getBrowserExtStatus, registerNativeHost,
} from "@/lib/ipc/invoke";

// Opens an external URL safely — prevents reverse-tabnapping (OWASP A05:2021)
function openUrl(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

const PRO_FEATURE_LIST = [
  { key: "mcp_plugins",       icon: "🔌", label: "MCP 플러그인 마켓",    desc: "파일·Git·브라우저 AI 도구 연결" },
  { key: "workflow_builder",  icon: "🔀", label: "워크플로우 빌더",      desc: "멀티단계 AI 자동화 파이프라인" },
  { key: "batch_processing",  icon: "📦", label: "배치 처리 큐",         desc: "수백 개 항목 자동 일괄 처리" },
  { key: "browser_extension", icon: "🌐", label: "브라우저 확장",         desc: "현재 페이지 → AIFlow 원클릭 전송" },
  { key: "smart_routing",     icon: "⚡", label: "스마트 AI 라우팅",      desc: "질문 복잡도 기반 자동 모델 선택" },
  { key: "unlimited_history", icon: "♾️", label: "무제한 대화 이력",      desc: "삭제 제한 없이 모든 대화 보관" },
];

export default function ProUpgradeView() {
  const [license, setLicense]           = useState<LicenseInfo | null>(null);
  const [_features, setFeatures]        = useState<ProFeatures | null>(null);
  const [extStatus, setExtStatus]       = useState<{ registered: boolean; manifest_path?: string } | null>(null);
  const [loading, setLoading]           = useState(true);
  const [activating, setActivating]     = useState(false);
  const [licenseKey, setLicenseKey]     = useState("");
  const [licenseProvider, setLicenseProvider] = useState("lemonsqueezy");
  const [registering, setRegistering]   = useState(false);
  const [registerMsg, setRegisterMsg]   = useState<string | null>(null);
  const [error, setError]               = useState<string | null>(null);
  const [success, setSuccess]           = useState<string | null>(null);

  async function load() {
    try {
      const [lic, feat, ext] = await Promise.all([
        getLicenseStatus(),
        getProFeatures(),
        getBrowserExtStatus(),
      ]);
      setLicense(lic);
      setFeatures(feat);
      setExtStatus(ext);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleCheckout(provider: "lemonsqueezy" | "toss" | "naverpay") {
    try {
      setError(null);
      let resp;
      if (provider === "lemonsqueezy")  resp = await createLemonsqueezyCheckout();
      else if (provider === "toss")     resp = await createTossCheckout();
      else                              resp = await createNaverpayCheckout();
      openUrl(resp.url);
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleActivate() {
    if (!licenseKey.trim()) return;
    setActivating(true);
    setError(null);
    setSuccess(null);
    try {
      const updated = await activateLicense(licenseKey.trim(), licenseProvider);
      setLicense(updated);
      setFeatures(await getProFeatures());
      setSuccess("Pro 라이선스가 활성화되었습니다!");
      setLicenseKey("");
    } catch (e) {
      setError(String(e));
    } finally {
      setActivating(false);
    }
  }

  async function handleRegisterExtension() {
    setRegistering(true);
    setRegisterMsg(null);
    setError(null);
    try {
      const msg = await registerNativeHost();
      setRegisterMsg(msg);
      setExtStatus(await getBrowserExtStatus());
    } catch (e) {
      setError(String(e));
    } finally {
      setRegistering(false);
    }
  }

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex-1 flex items-center justify-center gap-2 text-zinc-500 text-sm"
      >
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        로딩 중...
      </div>
    );
  }

  const isPro = license?.tier === "pro";

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-8">

        {/* Global error banner — role=alert for assertive announcement */}
        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="flex items-start gap-2 p-3 bg-red-950/50 border border-red-800 rounded-lg text-red-400 text-sm"
          >
            <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-950/50 border border-amber-800/50 text-amber-400 text-sm font-medium mb-2">
            <Crown size={14} aria-hidden="true" />
            {isPro ? "Pro 활성화됨" : "Pro 플랜"}
          </div>
          <h1 className="text-2xl font-bold text-zinc-100">
            {isPro ? "Pro 플랜 사용 중" : "AIFlow Pro로 업그레이드"}
          </h1>
          <p className="text-zinc-400">
            {isPro
              ? `결제 수단: ${license?.payment_provider ?? "-"} · 활성화: ${license?.activated_at?.split("T")[0] ?? "-"}`
              : "AI 자동화의 모든 기능을 잠금 해제하세요."}
          </p>
        </div>

        {/* Feature List */}
        <ul role="list" aria-label="Pro 기능 목록" className="grid grid-cols-2 gap-3">
          {PRO_FEATURE_LIST.map((f) => {
            const enabled = isPro || f.key === "smart_routing";
            return (
              <li key={f.key}>
                <div
                  className={`rounded-xl border p-4 ${
                    enabled
                      ? "bg-zinc-900 border-zinc-700"
                      : "bg-zinc-950 border-zinc-800 opacity-50"
                  }`}
                  aria-label={`${f.label}: ${enabled ? "사용 가능" : "잠금"}`}
                >
                  <div className="flex items-start gap-3">
                    {/* Decorative emoji — hidden from screen readers; label above provides context */}
                    <span className="text-xl" aria-hidden="true">{f.icon}</span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-zinc-100">{f.label}</span>
                        {enabled && (
                          <Check size={13} className="text-green-400" aria-hidden="true" />
                        )}
                      </div>
                      <p className="text-xs text-zinc-500 mt-0.5">{f.desc}</p>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        {/* Checkout Buttons (Free only) */}
        {!isPro && (
          <section aria-labelledby="checkout-heading" className="space-y-4">
            <h2 id="checkout-heading" className="text-base font-semibold text-zinc-100">
              결제 방법 선택
            </h2>
            <div className="space-y-3">
              {/* LemonSqueezy (Global) */}
              <button
                onClick={() => handleCheckout("lemonsqueezy")}
                aria-label="LemonSqueezy로 결제 (글로벌 — 신용카드, PayPal)"
                className="w-full flex items-center justify-between px-5 py-4 rounded-xl bg-zinc-900 border border-zinc-700 hover:border-violet-600 hover:bg-zinc-900/80 transition-all group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl" aria-hidden="true">🍋</span>
                  <div className="text-left">
                    <p className="font-medium text-zinc-100">LemonSqueezy (글로벌)</p>
                    <p className="text-xs text-zinc-500">신용카드 · PayPal · 해외 결제</p>
                  </div>
                </div>
                <ExternalLink size={16} className="text-zinc-500 group-hover:text-violet-400 transition-colors" aria-hidden="true" />
              </button>

              {/* 토스페이먼츠 (Korea) */}
              <button
                onClick={() => handleCheckout("toss")}
                aria-label="토스페이먼츠로 결제 (한국 — 카카오페이, 신용카드)"
                className="w-full flex items-center justify-between px-5 py-4 rounded-xl bg-zinc-900 border border-zinc-700 hover:border-blue-600 hover:bg-zinc-900/80 transition-all group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl" aria-hidden="true">💳</span>
                  <div className="text-left">
                    <p className="font-medium text-zinc-100">토스페이먼츠 (한국)</p>
                    <p className="text-xs text-zinc-500">카카오페이 · 신용카드 · 무통장입금</p>
                  </div>
                </div>
                <ExternalLink size={16} className="text-zinc-500 group-hover:text-blue-400 transition-colors" aria-hidden="true" />
              </button>

              {/* 네이버페이 (Korea) */}
              <button
                onClick={() => handleCheckout("naverpay")}
                aria-label="네이버페이로 결제 (한국 — 네이버 포인트, 머니)"
                className="w-full flex items-center justify-between px-5 py-4 rounded-xl bg-zinc-900 border border-zinc-700 hover:border-green-600 hover:bg-zinc-900/80 transition-all group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500/50"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl" aria-hidden="true">🟢</span>
                  <div className="text-left">
                    <p className="font-medium text-zinc-100">네이버페이 (한국)</p>
                    <p className="text-xs text-zinc-500">네이버 포인트 · 머니 · 카드</p>
                  </div>
                </div>
                <ExternalLink size={16} className="text-zinc-500 group-hover:text-green-400 transition-colors" aria-hidden="true" />
              </button>
            </div>
          </section>
        )}

        {/* License Key Activation */}
        {!isPro && (
          <section aria-labelledby="license-heading" className="space-y-3">
            <h2 id="license-heading" className="text-base font-semibold text-zinc-100">
              라이선스 키 입력
            </h2>
            <p className="text-sm text-zinc-500">결제 완료 후 받은 라이선스 키를 아래에 입력하세요.</p>

            <div className="flex gap-2">
              <div>
                <label htmlFor="license-provider-select" className="sr-only">
                  결제 수단 선택
                </label>
                <select
                  id="license-provider-select"
                  value={licenseProvider}
                  onChange={(e) => setLicenseProvider(e.target.value)}
                  className="px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-sm text-zinc-300 focus:border-violet-500 focus:outline-none focus-visible:ring-1 focus-visible:ring-violet-500/50"
                >
                  <option value="lemonsqueezy">LemonSqueezy</option>
                  <option value="toss">토스</option>
                  <option value="naverpay">네이버페이</option>
                </select>
              </div>

              <div className="flex-1">
                <label htmlFor="license-key-input" className="sr-only">
                  라이선스 키
                </label>
                <input
                  id="license-key-input"
                  value={licenseKey}
                  onChange={(e) => setLicenseKey(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleActivate()}
                  placeholder="XXXX-XXXX-XXXX-XXXX"
                  maxLength={50}
                  autoComplete="off"
                  spellCheck={false}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-sm font-mono text-zinc-100 placeholder-zinc-600 focus:border-violet-500 focus:outline-none focus-visible:ring-1 focus-visible:ring-violet-500/50"
                />
              </div>

              <button
                onClick={handleActivate}
                disabled={activating || !licenseKey.trim()}
                aria-label={activating ? "라이선스 활성화 중..." : "라이선스 키 활성화"}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70"
              >
                {activating
                  ? <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                  : <Key size={14} aria-hidden="true" />}
                활성화
              </button>
            </div>

            {/* Success — polite live region (non-urgent) */}
            {success && (
              <p
                role="status"
                aria-live="polite"
                className="flex items-center gap-1.5 text-sm text-green-400"
              >
                <Check size={14} aria-hidden="true" />
                {success}
              </p>
            )}
          </section>
        )}

        {/* Browser Extension Setup */}
        <section aria-labelledby="ext-heading" className="space-y-3">
          <h2 id="ext-heading" className="text-base font-semibold text-zinc-100 flex items-center gap-2">
            <Globe size={16} className="text-blue-400" aria-hidden="true" />
            브라우저 확장 설정
          </h2>

          <div
            className={`rounded-xl border p-4 ${
              extStatus?.registered
                ? "border-green-800 bg-green-950/20"
                : "border-zinc-700 bg-zinc-900"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-zinc-100 flex items-center gap-2">
                  {extStatus?.registered ? (
                    <>
                      <Check size={14} className="text-green-400" aria-hidden="true" />
                      Chrome Native Messaging 등록됨
                    </>
                  ) : (
                    <>
                      <Monitor size={14} className="text-zinc-400" aria-hidden="true" />
                      Chrome Native Messaging 미등록
                    </>
                  )}
                </p>
                <p className="text-xs text-zinc-500 mt-0.5 truncate">
                  {extStatus?.registered
                    ? `manifest: ${extStatus.manifest_path}`
                    : "등록하면 Chrome에서 AIFlow로 페이지 내용을 보낼 수 있습니다."}
                </p>
              </div>

              <button
                onClick={handleRegisterExtension}
                disabled={registering}
                aria-label={
                  registering
                    ? "Native Host 등록 중..."
                    : extStatus?.registered
                      ? "Native Host 재등록"
                      : "Native Host 등록"
                }
                className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-100 text-sm transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/50"
              >
                {registering
                  ? <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                  : <RefreshCw size={13} aria-hidden="true" />}
                {extStatus?.registered ? "재등록" : "등록"}
              </button>
            </div>

            {/* Register result — polite live region */}
            {registerMsg && (
              <p
                role="status"
                aria-live="polite"
                className="mt-3 text-xs text-zinc-400 bg-zinc-950 rounded-lg p-3 whitespace-pre-wrap font-mono"
              >
                {registerMsg}
              </p>
            )}
          </div>

          <p className="text-xs text-zinc-600">
            브라우저 확장 파일 위치:{" "}
            <code className="text-zinc-500">browser-extension/</code> 폴더를 Chrome에서
            &ldquo;개발자 모드 &gt; 압축해제된 확장 프로그램 로드&rdquo;로 설치하세요.
          </p>
        </section>

      </div>
    </div>
  );
}
