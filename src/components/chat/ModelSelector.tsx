import { useEffect, useState } from "react";
import { useSettingsStore } from "@/stores/settingsStore";
import { PROVIDERS } from "@/lib/providers";
import { getModelCatalog } from "@/lib/ipc/invoke";
import type { ModelInfo } from "@/types";
import { ChevronDown } from "lucide-react";

export default function ModelSelector() {
  const { activeProviderId, activeModelId, setActiveProvider, keyStatuses } =
    useSettingsStore();
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [open, setOpen] = useState(false);

  // Load models when provider changes
  useEffect(() => {
    getModelCatalog(activeProviderId)
      .then(setModels)
      .catch(() => setModels([]));
  }, [activeProviderId]);

  const activeProvider = PROVIDERS.find((p) => p.id === activeProviderId);
  const activeModel = models.find((m) => m.id === activeModelId);
  const isConnected = keyStatuses[activeProviderId]?.isSet ?? false;

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b border-zinc-800">
      {/* Provider selector */}
      <div className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-sm transition-colors"
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-emerald-400" : "bg-zinc-600"}`}
          />
          <span className="font-medium text-zinc-200">
            {activeProvider?.name ?? activeProviderId}
          </span>
          <span className="text-zinc-500 text-xs">
            {activeModel?.name ?? activeModelId}
          </span>
          <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
        </button>

        {open && (
          <div className="absolute top-full left-0 mt-1 w-72 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl z-40 max-h-80 overflow-y-auto">
            {PROVIDERS.filter((p) => keyStatuses[p.id]?.isSet).map((provider) => (
              <ProviderSection
                key={provider.id}
                providerName={provider.name}
                providerId={provider.id}
                activeModelId={activeModelId}
                onSelect={(modelId) => {
                  setActiveProvider(provider.id, modelId);
                  setOpen(false);
                }}
              />
            ))}
            {PROVIDERS.filter((p) => keyStatuses[p.id]?.isSet).length === 0 && (
              <p className="px-3 py-4 text-xs text-zinc-500 text-center">
                No API keys configured. Go to Settings to add one.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Price hint */}
      {activeModel && (
        <span className="text-[10px] text-zinc-600">
          ${activeModel.inputPricePerM}/{activeModel.outputPricePerM} per 1M tokens
        </span>
      )}
    </div>
  );
}

function ProviderSection({
  providerName,
  providerId,
  activeModelId,
  onSelect,
}: {
  providerName: string;
  providerId: string;
  activeModelId: string;
  onSelect: (modelId: string) => void;
}) {
  const [models, setModels] = useState<ModelInfo[]>([]);

  useEffect(() => {
    getModelCatalog(providerId)
      .then(setModels)
      .catch(() => setModels([]));
  }, [providerId]);

  return (
    <div>
      <div className="px-3 py-1.5 text-[10px] font-medium text-zinc-500 uppercase tracking-wider">
        {providerName}
      </div>
      {models.map((model) => (
        <button
          key={model.id}
          onClick={() => onSelect(model.id)}
          className={`w-full text-left px-3 py-2 text-sm hover:bg-zinc-800/50 transition-colors ${
            model.id === activeModelId ? "bg-zinc-800 text-zinc-100" : "text-zinc-300"
          }`}
        >
          <div className="flex items-center justify-between">
            <span>{model.name}</span>
            <span className="text-[10px] text-zinc-600">
              ${model.inputPricePerM}/{model.outputPricePerM}
            </span>
          </div>
        </button>
      ))}
    </div>
  );
}
