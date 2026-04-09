import { useSettingsStore } from "@/stores/settingsStore";

/** Privacy mode toggle — when ON, scans for PII before sending to AI */
export default function PrivacyToggle() {
  const privacyMode = useSettingsStore((s) => s.privacyMode);
  const setPrivacyMode = useSettingsStore((s) => s.setPrivacyMode);

  return (
    <button
      onClick={() => setPrivacyMode(!privacyMode)}
      role="switch"
      aria-checked={privacyMode}
      aria-label={privacyMode ? "개인정보 보호 모드 켜짐 — 끄려면 클릭" : "개인정보 보호 모드 꺼짐 — 켜려면 클릭"}
      className={`inline-flex items-center gap-1.5 px-2 py-1 text-[10px] rounded border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 ${
        privacyMode
          ? "text-blue-400 bg-blue-950/40 border-blue-800/50"
          : "text-zinc-500 bg-zinc-900 border-zinc-800 hover:border-zinc-700"
      }`}
    >
      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
        {privacyMode ? (
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        ) : (
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 11V7a4 4 0 118 0m-4 8v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2z" />
        )}
      </svg>
      PII {privacyMode ? "ON" : "OFF"}
    </button>
  );
}
