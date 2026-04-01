import { useEffect, useState } from "react";
import { Crown, Check, ExternalLink, Key, Globe, RefreshCw, Monitor, Loader2 } from "lucide-react";
const openUrl = (url: string) => window.open(url, "_blank");
import type { LicenseInfo, ProFeatures } from "@/types";
import {
  getLicenseStatus, getProFeatures,
  createLemonsqueezyCheckout, createTossCheckout, createNaverpayCheckout,
  activateLicense,
  getBrowserExtStatus, registerNativeHost,
} from "@/lib/ipc/invoke";

const PRO_FEATURE_LIST = [
  { key: "mcp_plugins",      icon: "🔌", label: "MCP 플러그인 마켓",      desc: "파일·Git·브라우저 AI 도구 연결" },
  { key: "workflow_builder", icon: "🔀", label: "워크플로우 빌더",        desc: "멀티단계 AI 자동화 파이프라인" },
  { key: "batch_processing", icon: "📦", label: "배치 처리 큐",          desc: "수백 개 항목 자동 일괄 처리" },
  { key: "browser_extension",icon: "🌐", label: "브라우저 확장",          desc: "현재 페이지 → AIFlow 원클릭 전송" },
  { key: "smart_routing",    icon: "⚡", label: "스마트 AI 라우팅",       desc: "질문 복잡도 기반 자동 모델 선택" },
  { key: "unlimited_history",icon: "♾️", label: "무제한 대화 이력",       desc: "삭제 제한 없이 모든 대화 보관" },
];

export default function ProUpgradeView() {
  const [license, setLicense] = useState<LicenseInfo | null>(null);
  const [_features, setFeatures] = useState<ProFeatures | null>(null);
  const [extStatus, setExtStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [licenseKey, setLicenseKey] = useState("");
  const [licenseProvider, setLicenseProvider] = useState("lemonsqueezy");
  const [registering, setRegistering] = useState(false);
  const [registerMsg, setRegisterMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
      if (provider === "lemonsqueezy") resp = await createLemonsqueezyCheckout();
      else if (provider === "toss") resp = await createTossCheckout();
      else resp = await createNaverpayCheckout();

      await openUrl(resp.url);
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleActivate() {
    if (!licenseKey.trim()) return;
    setActivating(true);
    setError(null);
    try {
      const updated = await activateLicense(licenseKey.trim(), licenseProvider);
      setLicense(updated);
      setFeatures(await getProFeatures());
      setSuccess("🎉 Pro 라이선스가 활성화되었습니다!");
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

  if (loading) return <div className="flex-1 flex items-center justify-center text-zinc-500">로딩 중...</div>;

  const isPro = license?.tier === "pro";

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-8">

        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-950/50 border border-amber-800/50 text-amber-400 text-sm font-medium mb-2">
            <Crown size={14} /> {isPro ? "Pro 활성화됨" : "Pro 플랜"}
          </div>
          <h1 className="text-2xl font-bold text-zinc-100">
            {isPro ? "Pro 플랜 사용 중 ✨" : "AIFlow Pro로 업그레이드"}
          </h1>
          <p className="text-zinc-400">
            {isPro
              ? `결제 수단: ${license?.payment_provider ?? "-"} · 활성화: ${license?.activated_at?.split("T")[0] ?? "-"}`
              : "AI 자동화의 모든 기능을 잠금 해제하세요."}
          </p>
        </div>

        {/* Feature List */}
        <div className="grid grid-cols-2 gap-3">
          {PRO_FEATURE_LIST.map((f) => {
            const enabled = isPro || f.key === "smart_routing";
            return (
              <div
                key={f.key}
                className={`rounded-xl border p-4 ${
                  enabled
                    ? "bg-zinc-900 border-zinc-700"
                    : "bg-zinc-950 border-zinc-800 opacity-50"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="text-xl">{f.icon}</span>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-zinc-100">{f.label}</span>
                      {enabled && <Check size={13} className="text-green-400" />}
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5">{f.desc}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Checkout Buttons (Free only) */}
        {!isPro && (
          <div className="space-y-4">
            <h2 className="text-base font-semibold text-zinc-100">결제 방법 선택</h2>
            <div className="space-y-3">
              {/* LemonSqueezy (Global) */}
              <button
                onClick={() => handleCheckout("lemonsqueezy")}
                className="w-full flex items-center justify-between px-5 py-4 rounded-xl bg-zinc-900 border border-zinc-700 hover:border-violet-600 hover:bg-zinc-900/80 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🍋</span>
                  <div className="text-left">
                    <p className="font-medium text-zinc-100">LemonSqueezy (글로벌)</p>
                    <p className="text-xs text-zinc-500">신용카드 · PayPal · 해외 결제</p>
                  </div>
                </div>
                <ExternalLink size={16} className="text-zinc-500 group-hover:text-violet-400 transition-colors" />
              </button>

              {/* 토스페이먼츠 (Korea) */}
              <button
                onClick={() => handleCheckout("toss")}
                className="w-full flex items-center justify-between px-5 py-4 rounded-xl bg-zinc-900 border border-zinc-700 hover:border-blue-600 hover:bg-zinc-900/80 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">💳</span>
                  <div className="text-left">
                    <p className="font-medium text-zinc-100">토스페이먼츠 (한국)</p>
                    <p className="text-xs text-zinc-500">카카오페이 · 신용카드 · 무통장입금</p>
                  </div>
                </div>
                <ExternalLink size={16} className="text-zinc-500 group-hover:text-blue-400 transition-colors" />
              </button>

              {/* 네이버페이 (Korea) */}
              <button
                onClick={() => handleCheckout("naverpay")}
                className="w-full flex items-center justify-between px-5 py-4 rounded-xl bg-zinc-900 border border-zinc-700 hover:border-green-600 hover:bg-zinc-900/80 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🟢</span>
                  <div className="text-left">
                    <p className="font-medium text-zinc-100">네이버페이 (한국)</p>
                    <p className="text-xs text-zinc-500">네이버 포인트 · 머니 · 카드</p>
                  </div>
                </div>
                <ExternalLink size={16} className="text-zinc-500 group-hover:text-green-400 transition-colors" />
              </button>
            </div>
          </div>
        )}

        {/* License Key Activation */}
        {!isPro && (
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-zinc-100">라이선스 키 입력</h2>
            <p className="text-sm text-zinc-500">결제 완료 후 받은 라이선스 키를 아래에 입력하세요.</p>
            <div className="flex gap-2">
              <select
                value={licenseProvider}
                onChange={(e) => setLicenseProvider(e.target.value)}
                className="px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-sm text-zinc-300 focus:border-violet-500 focus:outline-none"
              >
                <option value="lemonsqueezy">LemonSqueezy</option>
                <option value="toss">토스</option>
                <option value="naverpay">네이버페이</option>
              </select>
              <input
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                placeholder="XXXX-XXXX-XXXX-XXXX"
                className="flex-1 px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-sm font-mono text-zinc-100 placeholder-zinc-600 focus:border-violet-500 focus:outline-none"
              />
              <button
                onClick={handleActivate}
                disabled={activating || !licenseKey.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
              >
                {activating ? <Loader2 size={14} className="animate-spin" /> : <Key size={14} />}
                활성화
              </button>
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            {success && <p className="text-sm text-green-400">{success}</p>}
          </div>
        )}

        {/* Browser Extension Setup */}
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
            <Globe size={16} className="text-blue-400" /> 브라우저 확장 설정
          </h2>
          <div className={`rounded-xl border p-4 ${extStatus?.registered ? "border-green-800 bg-green-950/20" : "border-zinc-700 bg-zinc-900"}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-zinc-100 flex items-center gap-2">
                  {extStatus?.registered ? (
                    <><Check size={14} className="text-green-400" /> Chrome Native Messaging 등록됨</>
                  ) : (
                    <><Monitor size={14} className="text-zinc-400" /> Chrome Native Messaging 미등록</>
                  )}
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {extStatus?.registered
                    ? `manifest: ${extStatus.manifest_path}`
                    : "등록하면 Chrome에서 AIFlow로 페이지 내용을 보낼 수 있습니다."}
                </p>
              </div>
              <button
                onClick={handleRegisterExtension}
                disabled={registering}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-zinc-100 text-sm transition-colors"
              >
                {registering ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                {extStatus?.registered ? "재등록" : "등록"}
              </button>
            </div>
            {registerMsg && (
              <p className="mt-3 text-xs text-zinc-400 bg-zinc-950 rounded-lg p-3 whitespace-pre-wrap font-mono">{registerMsg}</p>
            )}
          </div>
          <p className="text-xs text-zinc-600">
            브라우저 확장 파일 위치: <code className="text-zinc-500">browser-extension/</code> 폴더를 Chrome에서 &quot;개발자 모드 &gt; 압축해제된 확장 프로그램 로드&quot;로 설치하세요.
          </p>
        </div>

      </div>
    </div>
  );
}
