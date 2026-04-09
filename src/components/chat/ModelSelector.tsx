import { useEffect, useRef, useState } from "react";
import { useSettingsStore } from "@/stores/settingsStore";
import { PROVIDERS } from "@/lib/providers";
import { getModelCatalog, detectLocalLlms } from "@/lib/ipc/invoke";
import type { ModelInfo, LocalLlmDetectionResult } from "@/types";
import { ChevronDown, Cpu, RefreshCw, Loader2, Wifi } from "lucide-react";

// ─── Session-level cache for local LLM detection results ─────────────────
// Persists across dropdown open/close to avoid repeated port scans
let _localLlmCache: LocalLlmDetectionResult[] | null = null;
let _localLlmCacheTs = 0;
const LOCAL_LLM_CACHE_TTL_MS = 30_000; // re-scan after 30s

export default function ModelSelector() {
  const { activeProviderId, activeModelId, setActiveProvider, keyStatuses } =
    useSettingsStore();
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [open, setOpen] = useState(false);
  const [localLlms, setLocalLlms] = useState<LocalLlmDetectionResult[]>(_localLlmCache ?? []);
  const [scanningLocal, setScanningLocal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Load models for the active provider
  useEffect(() => {
    getModelCatalog(activeProviderId)
      .then(setModels)
      .catch(() => setModels([]));
  }, [activeProviderId]);

  // Scan for local LLMs when dropdown opens (cached)
  useEffect(() => {
    if (!open) return;
    const now = Date.now();
    if (_localLlmCache !== null && now - _localLlmCacheTs < LOCAL_LLM_CACHE_TTL_MS) {
      setLocalLlms(_localLlmCache);
      return;
    }
    runLocalScan();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function runLocalScan() {
    setScanningLocal(true);
    try {
      const results = await detectLocalLlms();
      _localLlmCache = results;
      _localLlmCacheTs = Date.now();
      setLocalLlms(results);
    } catch {
      setLocalLlms([]);
    } finally {
      setScanningLocal(false);
    }
  }

  const activeProvider = PROVIDERS.find((p) => p.id === activeProviderId);
  const activeModel = models.find((m) => m.id === activeModelId);
  const isConnected = activeProviderId === "ollama"
    ? localLlms.some((r) => r.isRunning)
    : (keyStatuses[activeProviderId]?.isSet ?? false);

  const cloudProviders = PROVIDERS.filter(
    (p) => p.id !== "ollama" && keyStatuses[p.id]?.isSet
  );
  const runningLocalEndpoints = localLlms.filter((r) => r.isRunning && r.models.length > 0);

  const hasAnySource = cloudProviders.length > 0 || runningLocalEndpoints.length > 0;

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800" ref={dropdownRef}>
      {/* Trigger button */}
      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-sm transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label="AI 모델 선택"
        >
          {activeProviderId === "ollama" ? (
            <Cpu className="w-3 h-3 text-emerald-400 flex-shrink-0" />
          ) : (
            <span
              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                isConnected ? "bg-emerald-400" : "bg-zinc-600"
              }`}
            />
          )}
          <span className="font-medium text-zinc-200 text-xs">
            {activeProvider?.name ?? activeProviderId}
          </span>
          <span className="text-zinc-500 text-xs truncate max-w-[120px]">
            {activeModel?.name ?? activeModelId}
          </span>
          <ChevronDown className={`w-3.5 h-3.5 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>

        {/* Dropdown */}
        {open && (
          <div
            role="listbox"
            aria-label="모델 선택"
            className="absolute top-full left-0 mt-1.5 w-80 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-40 overflow-hidden"
          >
            <div className="max-h-[70vh] overflow-y-auto">
              {!hasAnySource && !scanningLocal ? (
                <div className="px-4 py-6 text-center">
                  <Wifi className="w-6 h-6 text-zinc-700 mx-auto mb-2" aria-hidden="true" />
                  <p className="text-xs text-zinc-500 font-medium">사용 가능한 모델 없음</p>
                  <p className="text-[10px] text-zinc-600 mt-1">
                    설정에서 API 키를 추가하거나<br />Ollama를 실행하세요
                  </p>
                </div>
              ) : (
                <>
                  {/* Cloud providers */}
                  {cloudProviders.length > 0 && (
                    <div className="py-1">
                      <div className="px-3 pt-2 pb-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                        <Wifi className="w-3 h-3" aria-hidden="true" />
                        Cloud AI
                      </div>
                      {cloudProviders.map((provider) => (
                        <ProviderSection
                          key={provider.id}
                          providerName={provider.name}
                          providerId={provider.id}
                          activeProviderId={activeProviderId}
                          activeModelId={activeModelId}
                          onSelect={(modelId) => {
                            setActiveProvider(provider.id, modelId);
                            setOpen(false);
                          }}
                        />
                      ))}
                    </div>
                  )}

                  {/* Divider */}
                  {cloudProviders.length > 0 && (runningLocalEndpoints.length > 0 || scanningLocal) && (
                    <div className="mx-3 border-t border-zinc-800/80" />
                  )}

                  {/* Local AI section */}
                  <div className="py-1">
                    <div className="px-3 pt-2 pb-1 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Cpu className="w-3 h-3" aria-hidden="true" />
                        로컬 AI
                        {runningLocalEndpoints.length > 0 && (
                          <span className="px-1.5 py-px rounded-full bg-emerald-900/40 text-emerald-400 text-[9px] font-medium">
                            {runningLocalEndpoints.reduce((n, r) => n + r.models.length, 0)}개 모델
                          </span>
                        )}
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          _localLlmCache = null; // invalidate cache
                          runLocalScan();
                        }}
                        disabled={scanningLocal}
                        className="p-1 rounded-md text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800 transition-colors cursor-pointer disabled:opacity-30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500/50"
                        aria-label="로컬 AI 재스캔"
                      >
                        {scanningLocal ? (
                          <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" />
                        ) : (
                          <RefreshCw className="w-3 h-3" aria-hidden="true" />
                        )}
                      </button>
                    </div>

                    {scanningLocal && runningLocalEndpoints.length === 0 ? (
                      <div className="px-3 py-2 space-y-1.5">
                        {[1, 2].map((i) => (
                          <div key={i} className="h-9 rounded-lg bg-zinc-800/50 animate-pulse" />
                        ))}
                      </div>
                    ) : runningLocalEndpoints.length === 0 ? (
                      <div className="px-4 py-3 text-[11px] text-zinc-600 text-center">
                        실행 중인 로컬 AI 없음<br />
                        <span className="text-[10px]">Ollama 또는 LM Studio를 시작하세요</span>
                      </div>
                    ) : (
                      runningLocalEndpoints.map((endpoint) => (
                        <div key={endpoint.baseUrl}>
                          {/* Endpoint header */}
                          <div className="px-3 py-1 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" aria-hidden="true" />
                            <span className="text-[10px] text-zinc-500">
                              {endpoint.endpointName}
                            </span>
                            <span className="text-[10px] text-zinc-700 font-mono">
                              {endpoint.baseUrl}
                            </span>
                          </div>
                          {/* Model list */}
                          {endpoint.models.map((model) => {
                            const isActive =
                              activeProviderId === "ollama" &&
                              activeModelId === model.modelName;
                            return (
                              <button
                                key={model.id}
                                role="option"
                                aria-selected={isActive}
                                onClick={() => {
                                  setActiveProvider("ollama", model.modelName);
                                  setOpen(false);
                                }}
                                className={`w-full flex items-center justify-between px-3 py-2 text-left transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-violet-500/50 ${
                                  isActive
                                    ? "bg-emerald-900/20 text-emerald-300"
                                    : "text-zinc-300 hover:bg-zinc-800/50"
                                }`}
                              >
                                <div className="min-w-0">
                                  <div className="text-xs font-medium font-mono truncate">
                                    {model.modelName}
                                  </div>
                                  {(model.modelSize || model.parameterCount) && (
                                    <div className="text-[10px] text-zinc-600 mt-0.5">
                                      {[model.modelSize, model.parameterCount]
                                        .filter(Boolean)
                                        .join(" · ")}
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-400 font-medium">
                                    무료
                                  </span>
                                  {isActive && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Price / cost hint */}
      {activeProviderId === "ollama" ? (
        <span className="text-[10px] text-emerald-700">로컬 실행 · 무료</span>
      ) : (
        activeModel && (
          <span className="text-[10px] text-zinc-600">
            ${activeModel.inputPricePerM}/{activeModel.outputPricePerM} per 1M tokens
          </span>
        )
      )}
    </div>
  );
}

// ─── Cloud provider model section ────────────────────────────────────────

function ProviderSection({
  providerName,
  providerId,
  activeProviderId,
  activeModelId,
  onSelect,
}: {
  providerName: string;
  providerId: string;
  activeProviderId: string;
  activeModelId: string;
  onSelect: (modelId: string) => void;
}) {
  const [models, setModels] = useState<ModelInfo[]>([]);

  useEffect(() => {
    getModelCatalog(providerId)
      .then(setModels)
      .catch(() => setModels([]));
  }, [providerId]);

  if (models.length === 0) return null;

  return (
    <div>
      <div className="px-3 py-1 text-[10px] font-medium text-zinc-600 flex items-center gap-1">
        <span className="w-1 h-1 rounded-full bg-zinc-600" aria-hidden="true" />
        {providerName}
      </div>
      {models.map((model) => {
        const isActive = activeProviderId === providerId && model.id === activeModelId;
        return (
          <button
            key={model.id}
            role="option"
            aria-selected={isActive}
            onClick={() => onSelect(model.id)}
            className={`w-full flex items-center justify-between px-3 py-2 text-left text-sm transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-violet-500/50 ${
              isActive
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-300 hover:bg-zinc-800/50"
            }`}
          >
            <div className="min-w-0">
              <div className="text-xs font-medium truncate">{model.name}</div>
              <div className="text-[10px] text-zinc-600 mt-0.5">
                {model.maxContext.toLocaleString()} ctx
              </div>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
              <span className="text-[10px] text-zinc-600">
                ${model.inputPricePerM}/{model.outputPricePerM}
              </span>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-300" aria-hidden="true" />
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}
