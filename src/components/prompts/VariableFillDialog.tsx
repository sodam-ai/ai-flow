import { useState } from "react";
import { useTranslation } from "react-i18next";
import { usePromptStore } from "@/stores/promptStore";
import type { PromptTemplate } from "@/types";

interface Props {
  prompt: PromptTemplate;
  onApply: (content: string) => void;
  onCancel: () => void;
}

export default function VariableFillDialog({ prompt, onApply, onCancel }: Props) {
  const { t } = useTranslation();
  const { usePrompt } = usePromptStore();

  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(prompt.variables.map((v) => [v, ""])),
  );
  const [applying, setApplying] = useState(false);

  const allFilled = prompt.variables.every((v) => values[v]?.trim());

  const handleApply = async () => {
    setApplying(true);
    const result = await usePrompt(prompt.id, values);
    setApplying(false);
    if (result) {
      onApply(result);
    }
  };

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-[400px]">
      <div className="px-4 py-3 border-b border-zinc-800">
        <h3 className="text-sm font-semibold">{t("prompt.fillVariables")}</h3>
        <p className="text-[10px] text-zinc-500 mt-0.5">{prompt.title}</p>
      </div>

      <div className="p-4 space-y-3">
        {prompt.variables.map((variable) => (
          <div key={variable}>
            <label className="text-[10px] text-zinc-500 uppercase tracking-wider font-mono">
              {`{{${variable}}}`}
            </label>
            <input
              value={values[variable] ?? ""}
              onChange={(e) =>
                setValues((prev) => ({ ...prev, [variable]: e.target.value }))
              }
              placeholder={`Enter ${variable}...`}
              className="w-full mt-1 px-3 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded-lg focus:border-zinc-500 focus:outline-none"
              autoFocus={prompt.variables[0] === variable}
            />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-zinc-800">
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleApply}
          disabled={applying || !allFilled}
          className="px-4 py-1.5 text-xs bg-zinc-100 text-zinc-900 rounded-md hover:bg-zinc-200 disabled:opacity-30 transition-colors"
        >
          {applying ? "Applying..." : t("prompt.apply")}
        </button>
      </div>
    </div>
  );
}
