import { useState, useEffect } from "react";
import { CheckCircle2, X } from "lucide-react";
import type { ModelInfo, StreamTarget } from "@/types";
import { getModelCatalog } from "@/lib/ipc/invoke";
import { useSettingsStore } from "@/stores/settingsStore";
import { PROVIDERS } from "@/lib/providers";

interface ModelPickerProps {
  onConfirm: (targets: StreamTarget[]) => void;
  onCancel: () => void;
}

const PROVIDER_NAMES: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  ollama: "Ollama (로컬)",
};

/** Select 2~3 models for multi-AI comparison */
export default function ModelPicker({ onConfirm, onCancel }: ModelPickerProps) {
  const { keyStatuses } = useSettingsStore();
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    getModelCatalog().then(setModels).catch(() => setModels([]));
  }, []);

  const toggleModel = (model: ModelInfo) => {
    const key = `${model.providerId}::${model.id}`;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else if (next.size < 3) {
        next.add(key);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    const targets: StreamTarget[] = Array.from(selected).map((key) => {
      const [providerId, modelId] = key.split("::");
      return { providerId, modelId };
    });
    onConfirm(targets);
  };

  // Only show providers with API key configured
  const availableProviders = PROVIDERS.filter((p) => keyStatuses[p.id]?.isSet);

  const providerGroups = models
    .filter((m) => availableProviders.some((p) => p.id === m.providerId))
    .reduce<Record<string, ModelInfo[]>>((acc, m) => {
      (acc[m.providerId] ??= []).push(m);
      return acc;
    }, {});

  const hasNoProviders = availableProviders.length === 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="AI 모델 비교 선택"
    >
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-[520px] max-h-[75vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-zinc-100">AI 모델 비교</h3>
            <p className="text-[10px] text-zinc-500 mt-0.5">
              2~3개 모델을 선택하면 동시에 응답을 비교합니다 · {selected.size}/3 선택됨
            </p>
          </div>
          <button
            onClick={onCancel}
            aria-label="닫기"
            className="p-1.5 rounded-md text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          {hasNoProviders ? (
            <div className="py-8 text-center">
              <p className="text-sm text-zinc-400 font-medium">API 키 없음</p>
              <p className="text-xs text-zinc-600 mt-1">
                설정에서 API 키를 추가하면 모델 비교를 사용할 수 있습니다
              </p>
            </div>
          ) : (
            Object.entries(providerGroups).map(([providerId, providerModels]) => (
              <div key={providerId}>
                <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2 px-1 font-semibold">
                  {PROVIDER_NAMES[providerId] ?? providerId}
                </div>
                <div className="space-y-1">
                  {providerModels.map((model) => {
                    const key = `${model.providerId}::${model.id}`;
                    const isSelected = selected.has(key);
                    const isDisabled = !isSelected && selected.size >= 3;

                    return (
                      <button
                        key={key}
                        onClick={() => toggleModel(model)}
                        disabled={isDisabled}
                        aria-pressed={isSelected}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-zinc-800 border border-zinc-600 ring-1 ring-zinc-600/50"
                            : isDisabled
                              ? "opacity-30 cursor-not-allowed border border-transparent"
                              : "hover:bg-zinc-800/50 border border-zinc-800 hover:border-zinc-700"
                        }`}
                      >
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                          isSelected ? "border-zinc-400 bg-zinc-400" : "border-zinc-600"
                        }`}>
                          {isSelected && <CheckCircle2 className="w-3 h-3 text-zinc-900" aria-hidden="true" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium text-zinc-200 truncate">{model.name}</div>
                          <div className="text-[10px] text-zinc-500 mt-0.5">
                            {model.maxContext.toLocaleString()} ctx
                          </div>
                        </div>
                        <div className="text-[10px] text-zinc-600 flex-shrink-0">
                          ${model.inputPricePerM}/{model.outputPricePerM}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-zinc-800 flex items-center justify-between">
          <p className="text-[10px] text-zinc-600">
            {selected.size < 2 ? `최소 ${2 - selected.size}개 더 선택하세요` : "비교 준비 완료"}
          </p>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
            >
              취소
            </button>
            <button
              onClick={handleConfirm}
              disabled={selected.size < 2 || hasNoProviders}
              className="px-4 py-1.5 text-xs bg-zinc-100 text-zinc-900 rounded-lg hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              비교 시작 ({selected.size})
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
