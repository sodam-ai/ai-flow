import { useState, useEffect } from "react";
import type { ModelInfo, StreamTarget } from "@/types";
import { getModelCatalog } from "@/lib/ipc/invoke";

interface ModelPickerProps {
  onConfirm: (targets: StreamTarget[]) => void;
  onCancel: () => void;
}

/** Select 2~3 models for multi-AI comparison */
export default function ModelPicker({ onConfirm, onCancel }: ModelPickerProps) {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    getModelCatalog().then(setModels);
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

  const providerGroups = models.reduce<Record<string, ModelInfo[]>>((acc, m) => {
    (acc[m.providerId] ??= []).push(m);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl w-[480px] max-h-[70vh] flex flex-col shadow-2xl">
        <div className="px-4 py-3 border-b border-zinc-800">
          <h3 className="text-sm font-semibold">Select 2~3 Models to Compare</h3>
          <p className="text-[10px] text-zinc-500 mt-0.5">
            Selected: {selected.size}/3
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {Object.entries(providerGroups).map(([providerId, providerModels]) => (
            <div key={providerId}>
              <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5 px-1">
                {providerId}
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
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                        isSelected
                          ? "bg-zinc-800 border border-zinc-600"
                          : isDisabled
                            ? "opacity-30 cursor-not-allowed"
                            : "hover:bg-zinc-800/50 border border-transparent"
                      }`}
                    >
                      <div>
                        <div className="font-medium text-xs">{model.name}</div>
                        <div className="text-[10px] text-zinc-500">
                          {model.maxContext.toLocaleString()} ctx
                        </div>
                      </div>
                      <div className="text-[10px] text-zinc-400">
                        ${model.inputPricePerM}/{model.outputPricePerM} per M
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="px-4 py-3 border-t border-zinc-800 flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={selected.size < 2}
            className="px-4 py-1.5 text-xs bg-zinc-100 text-zinc-900 rounded-lg hover:bg-zinc-200 disabled:opacity-50 transition-colors"
          >
            Compare ({selected.size})
          </button>
        </div>
      </div>
    </div>
  );
}
