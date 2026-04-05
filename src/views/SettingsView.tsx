import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "@/stores/settingsStore";
import { usePersonaStore } from "@/stores/personaStore";
import { useToastStore } from "@/stores/toastStore";
import { PROVIDERS } from "@/lib/providers";
import PersonaEditor from "@/components/chat/PersonaEditor";
import type { Persona, LocalLlmDetectionResult } from "@/types";
import { detectLocalLlms, getRoutingRules } from "@/lib/ipc/invoke";
import type { RoutingRule } from "@/types";
import { Eye, EyeOff, Trash2, Check, Loader2, Plus, Pencil, Keyboard, Cpu, Zap, Shield, Mic, Volume2 } from "lucide-react";

export default function SettingsView() {
  const { t, i18n } = useTranslation();
  const { keyStatuses, loadAllKeyStatuses, saveKey, removeKey, setActiveProvider, voiceLang, setVoiceLang, ttsRate, setTtsRate } =
    useSettingsStore();
  const { personas, fetchPersonas, deletePersona } = usePersonaStore();
  const [editorPersona, setEditorPersona] = useState<Persona | null | "new">(null);

  useEffect(() => {
    loadAllKeyStatuses();
    fetchPersonas();
  }, [loadAllKeyStatuses, fetchPersonas]);

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-2xl">
      <h2 className="text-xl font-bold mb-6">{t("settings.title")}</h2>

      {/* Language */}
      <section className="mb-8">
        <h3 className="text-sm font-medium text-zinc-400 mb-3">
          {t("settings.language")}
        </h3>
        <div className="flex gap-2">
          {(["ko", "en"] as const).map((lang) => (
            <button
              key={lang}
              onClick={() => i18n.changeLanguage(lang)}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${
                i18n.language === lang
                  ? "bg-zinc-100 text-zinc-900"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              {lang === "ko" ? "한국어" : "English"}
            </button>
          ))}
        </div>
      </section>

      {/* Voice Language (Phase 5) */}
      <section className="mb-8">
        <h3 className="text-sm font-medium text-zinc-400 mb-1 flex items-center gap-2">
          <Mic className="w-3.5 h-3.5" />
          Voice Input Language
        </h3>
        <p className="text-[11px] text-zinc-600 mb-3">
          Whisper STT language hint — improves transcription accuracy
        </p>
        <div className="flex flex-wrap gap-2">
          {([
            { code: "ko", label: "한국어", flag: "🇰🇷" },
            { code: "en", label: "English", flag: "🇺🇸" },
            { code: "ja", label: "日本語", flag: "🇯🇵" },
            { code: "zh", label: "中文", flag: "🇨🇳" },
            { code: "",   label: "Auto",   flag: "🌐" },
          ] as const).map(({ code, label, flag }) => (
            <button
              key={code}
              onClick={() => setVoiceLang(code)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                voiceLang === code
                  ? "bg-violet-950/50 border-violet-700/60 text-violet-300"
                  : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-300"
              }`}
            >
              <span>{flag}</span>
              <span>{label}</span>
              {voiceLang === code && (
                <Check className="w-3 h-3 ml-0.5 text-violet-400" />
              )}
            </button>
          ))}
        </div>
      </section>

      {/* TTS Speed (Phase 5) */}
      <section className="mb-8">
        <h3 className="text-sm font-medium text-zinc-400 mb-1 flex items-center gap-2">
          <Volume2 className="w-3.5 h-3.5" />
          Read Aloud Speed
        </h3>
        <p className="text-[11px] text-zinc-600 mb-3">
          Controls how fast AI responses are read aloud
        </p>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-zinc-500 w-8">0.5×</span>
          <input
            type="range"
            min={0.5}
            max={2.0}
            step={0.1}
            value={ttsRate}
            onChange={(e) => setTtsRate(parseFloat(e.target.value))}
            className="flex-1 accent-violet-500 h-1.5 rounded-full cursor-pointer"
            aria-label="TTS playback speed"
          />
          <span className="text-[11px] text-zinc-500 w-8 text-right">2×</span>
          <span className="text-xs font-mono text-violet-400 w-8 text-right">
            {ttsRate.toFixed(1)}×
          </span>
        </div>
        <div className="flex justify-between mt-1.5">
          {[0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0].map((v) => (
            <button
              key={v}
              onClick={() => setTtsRate(v)}
              className={`text-[10px] px-1.5 py-0.5 rounded transition-colors ${
                Math.abs(ttsRate - v) < 0.05
                  ? "text-violet-300 bg-violet-950/50"
                  : "text-zinc-600 hover:text-zinc-400"
              }`}
            >
              {v}×
            </button>
          ))}
        </div>
      </section>

      {/* API Keys */}
      <section className="mb-8">
        <h3 className="text-sm font-medium text-zinc-400 mb-3">
          {t("settings.apiKeys")}
        </h3>
        <div className="space-y-3">
          {PROVIDERS.map((provider) => (
            <ProviderKeyRow
              key={provider.id}
              providerName={provider.name}
              defaultModel={provider.defaultModel}
              status={keyStatuses[provider.id]}
              onSave={(key) => saveKey(provider.id, key)}
              onDelete={() => removeKey(provider.id)}
              onSelect={() =>
                setActiveProvider(provider.id, provider.defaultModel)
              }
            />
          ))}
        </div>
      </section>

      {/* Personas */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-zinc-400">
            {t("persona.select")}
          </h3>
          <button
            onClick={() => setEditorPersona("new")}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 rounded transition-colors"
          >
            <Plus className="w-3 h-3" />
            {t("persona.create")}
          </button>
        </div>
        <div className="space-y-2">
          {personas.map((persona) => (
            <div
              key={persona.id}
              className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900 border border-zinc-800"
            >
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: persona.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{persona.name}</span>
                  {persona.is_builtin && (
                    <span className="text-[9px] px-1.5 py-0.5 bg-zinc-800 text-zinc-500 rounded">
                      built-in
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-zinc-500 mt-0.5 truncate">
                  {persona.description}
                </p>
              </div>
              {!persona.is_builtin && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditorPersona(persona)}
                    className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => deletePersona(persona.id)}
                    className="p-1.5 rounded hover:bg-zinc-800 text-red-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Local LLM Detection (Phase 2) */}
      <LocalLlmSection />

      {/* Smart Routing Rules (Phase 2) */}
      <RoutingRulesSection />

      {/* Keyboard Shortcuts */}
      <section className="mb-8">
        <h3 className="text-sm font-medium text-zinc-400 mb-3 flex items-center gap-2">
          <Keyboard className="w-4 h-4" />
          Shortcuts
        </h3>
        <div className="space-y-2">
          {[
            { keys: "Alt+Space", desc: "Open/close overlay window" },
            { keys: "Alt+Shift+A", desc: "Send clipboard to AI" },
            { keys: "Ctrl+K", desc: "Command palette" },
            { keys: "Enter", desc: "Send message" },
            { keys: "Shift+Enter", desc: "New line" },
            { keys: "Escape", desc: "Close modal / overlay" },
          ].map(({ keys, desc }) => (
            <div
              key={keys}
              className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900 border border-zinc-800"
            >
              <span className="text-xs text-zinc-400">{desc}</span>
              <kbd className="px-2 py-0.5 text-[10px] font-mono bg-zinc-800 text-zinc-300 rounded border border-zinc-700">
                {keys}
              </kbd>
            </div>
          ))}
        </div>
      </section>

      {/* Persona editor modal */}
      {editorPersona !== null && (
        <PersonaEditor
          persona={editorPersona === "new" ? null : editorPersona}
          onClose={() => {
            setEditorPersona(null);
            fetchPersonas();
          }}
        />
      )}
    </div>
  );
}

function ProviderKeyRow({
  providerName,
  defaultModel,
  status,
  onSave,
  onDelete,
  onSelect,
}: {
  providerName: string;
  defaultModel: string;
  status?: { isSet: boolean; maskedPreview: string | null };
  onSave: (key: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  const [inputKey, setInputKey] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [saving, setSaving] = useState(false);
  const isSet = status?.isSet ?? false;

  const handleSave = async () => {
    if (!inputKey.trim()) return;
    setSaving(true);
    try {
      await onSave(inputKey);
      setInputKey("");
      setShowInput(false);
      onSelect();
      useToastStore.getState().addToast("success", `${providerName} API key saved`);
    } catch (err) {
      const message = typeof err === "string" ? err : String(err);
      useToastStore.getState().addToast("error", message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900 border border-zinc-800">
      {/* Provider info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{providerName}</span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded ${
              isSet
                ? "bg-emerald-900/50 text-emerald-400"
                : "bg-zinc-800 text-zinc-500"
            }`}
          >
            {isSet ? t("settings.connected") : t("settings.notConnected")}
          </span>
        </div>
        {isSet && status?.maskedPreview && (
          <p className="text-xs text-zinc-500 font-mono mt-0.5">
            {status.maskedPreview}
          </p>
        )}
        <p className="text-[10px] text-zinc-600 mt-0.5">{defaultModel}</p>
      </div>

      {/* Actions */}
      {showInput ? (
        <div className="flex items-center gap-2">
          <input
            type="password"
            value={inputKey}
            onChange={(e) => setInputKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            placeholder={t("settings.enterKey")}
            className="w-48 px-2 py-1 text-xs bg-zinc-800 border border-zinc-700 rounded focus:border-zinc-500 focus:outline-none"
            autoFocus
          />
          <button
            onClick={handleSave}
            disabled={saving || !inputKey.trim()}
            className="p-1 rounded hover:bg-zinc-700 text-emerald-400 disabled:opacity-30"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={() => {
              setShowInput(false);
              setInputKey("");
            }}
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowInput(true)}
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400"
            title={isSet ? "Change key" : "Add key"}
          >
            {isSet ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
          {isSet && (
            <button
              onClick={onDelete}
              className="p-1.5 rounded hover:bg-zinc-800 text-red-400"
              title="Delete key"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Local LLM Detection Section */
function LocalLlmSection() {
  const [results, setResults] = useState<LocalLlmDetectionResult[]>([]);
  const [scanning, setScanning] = useState(false);

  const handleScan = async () => {
    setScanning(true);
    try {
      const detected = await detectLocalLlms();
      setResults(detected);
      const running = detected.filter((r) => r.isRunning);
      if (running.length > 0) {
        const totalModels = running.reduce((sum, r) => sum + r.models.length, 0);
        useToastStore.getState().addToast("success", `Found ${totalModels} local model(s)`);
      } else {
        useToastStore.getState().addToast("info", "No local AI servers detected");
      }
    } catch (err) {
      useToastStore.getState().addToast("error", String(err));
    } finally {
      setScanning(false);
    }
  };

  return (
    <section className="mb-8">
      <h3 className="text-sm font-medium text-zinc-400 mb-3 flex items-center gap-2">
        <Cpu className="w-4 h-4" />
        Local AI (Ollama / LM Studio)
      </h3>
      <div className="space-y-2">
        <button
          onClick={handleScan}
          disabled={scanning}
          className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
        >
          {scanning ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Cpu className="w-3 h-3" />
          )}
          {scanning ? "Scanning..." : "Scan for Local AI"}
        </button>

        {results.map((r) => (
          <div
            key={r.baseUrl}
            className="p-3 rounded-lg bg-zinc-900 border border-zinc-800"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-medium">{r.endpointName}</span>
              <span className="text-[10px] text-zinc-500">{r.baseUrl}</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded ${
                  r.isRunning
                    ? "bg-emerald-900/50 text-emerald-400"
                    : "bg-red-900/50 text-red-400"
                }`}
              >
                {r.isRunning ? "Running" : "Offline"}
              </span>
            </div>
            {r.isRunning && r.models.length > 0 && (
              <div className="space-y-1 mt-2">
                {r.models.map((m) => (
                  <div key={m.id} className="flex items-center justify-between text-xs px-2 py-1 rounded bg-zinc-950">
                    <span className="text-zinc-300 font-mono">{m.modelName}</span>
                    <div className="flex items-center gap-2 text-[10px] text-zinc-500">
                      {m.modelSize && <span>{m.modelSize}</span>}
                      {m.parameterCount && <span>{m.parameterCount}</span>}
                      <span className="text-green-400">Free</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

/** Routing Rules + Privacy Toggle Section */
function RoutingRulesSection() {
  const [rules, setRules] = useState<RoutingRule[]>([]);
  const routingMode = useSettingsStore((s) => s.routingMode);
  const setRoutingMode = useSettingsStore((s) => s.setRoutingMode);
  const privacyMode = useSettingsStore((s) => s.privacyMode);
  const setPrivacyMode = useSettingsStore((s) => s.setPrivacyMode);

  useEffect(() => {
    getRoutingRules().then(setRules).catch(() => {});
  }, []);

  const complexityColor = (min: number) => {
    if (min <= 30) return "text-green-400";
    if (min <= 60) return "text-yellow-400";
    return "text-red-400";
  };

  return (
    <section className="mb-8">
      <h3 className="text-sm font-medium text-zinc-400 mb-3 flex items-center gap-2">
        <Zap className="w-4 h-4" />
        Smart Features
      </h3>
      <div className="space-y-3">
        {/* Toggle: Smart Routing */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-900 border border-zinc-800">
          <div>
            <div className="text-xs font-medium flex items-center gap-1.5">
              <Zap className="w-3 h-3 text-amber-400" />
              Smart Routing
            </div>
            <p className="text-[10px] text-zinc-500 mt-0.5">
              Auto-select the best AI based on prompt complexity
            </p>
          </div>
          <button
            onClick={() => setRoutingMode(!routingMode)}
            className={`w-10 h-5 rounded-full transition-colors ${
              routingMode ? "bg-amber-500" : "bg-zinc-700"
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform ${
                routingMode ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        {/* Toggle: Privacy Mode */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-900 border border-zinc-800">
          <div>
            <div className="text-xs font-medium flex items-center gap-1.5">
              <Shield className="w-3 h-3 text-blue-400" />
              Privacy Mode
            </div>
            <p className="text-[10px] text-zinc-500 mt-0.5">
              Scan for personal info (PII) before sending to AI
            </p>
          </div>
          <button
            onClick={() => setPrivacyMode(!privacyMode)}
            className={`w-10 h-5 rounded-full transition-colors ${
              privacyMode ? "bg-blue-500" : "bg-zinc-700"
            }`}
          >
            <div
              className={`w-4 h-4 rounded-full bg-white transition-transform ${
                privacyMode ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        </div>

        {/* Routing rules detail */}
        {routingMode && rules.length > 0 && (
          <div className="mt-2">
            <div className="text-[10px] text-zinc-500 mb-1.5">Active Routing Rules</div>
            <div className="space-y-1">
              {rules.filter((r) => r.isActive).map((rule) => (
                <div key={rule.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-zinc-950 border border-zinc-800/50 text-xs">
                  <div className="flex items-center gap-2">
                    <span className={`font-mono ${complexityColor(rule.minComplexity)}`}>
                      {rule.minComplexity}~{rule.maxComplexity}
                    </span>
                    <span className="text-zinc-400">{rule.name}</span>
                  </div>
                  <span className="text-zinc-500 text-[10px]">
                    {rule.providerId}:{rule.modelId.slice(-12)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
