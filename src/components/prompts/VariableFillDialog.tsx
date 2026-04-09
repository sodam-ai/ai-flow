import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useFocusReturn } from "@/hooks/useFocusReturn";
import { usePromptStore } from "@/stores/promptStore";
import type { PromptTemplate } from "@/types";

interface Props {
  prompt: PromptTemplate;
  onApply: (content: string) => void;
  onCancel: () => void;
}

/**
 * VariableFillDialog — fill template variables before applying a prompt.
 *
 * Security (ASVS 5.1.1):
 *   - maxLength={500} on all variable inputs — prevents oversized values
 *   - No innerHTML, no dangerouslySetInnerHTML
 *
 * Accessibility (WCAG 2.1 AA):
 *   - role="dialog" + aria-modal + aria-labelledby
 *   - Each <label> explicitly bound to input via htmlFor/id
 *   - Escape key closes the dialog
 *   - focus-visible rings on all interactive elements
 */
export default function VariableFillDialog({ prompt, onApply, onCancel }: Props) {
  const { t } = useTranslation();
  const { usePrompt } = usePromptStore();

  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(prompt.variables.map((v) => [v, ""])),
  );
  const [applying, setApplying] = useState(false);

  const allFilled = prompt.variables.every((v) => values[v]?.trim());

  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef);
  useFocusReturn();

  // Escape closes the dialog
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onCancel(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onCancel]);

  const handleApply = async () => {
    setApplying(true);
    const result = await usePrompt(prompt.id, values);
    setApplying(false);
    if (result) {
      onApply(result);
    }
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="var-fill-title"
      className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-[400px]"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-zinc-800">
        <h2
          id="var-fill-title"
          className="text-sm font-semibold text-zinc-100"
        >
          {t("prompt.fillVariables")}
        </h2>
        <p className="text-[10px] text-zinc-500 mt-0.5">{prompt.title}</p>
      </div>

      {/* Variable fields */}
      <div className="p-4 space-y-3.5">
        {prompt.variables.map((variable, idx) => {
          const fieldId = `var-fill-${variable.replace(/\s+/g, "-")}`;
          return (
            <div key={variable}>
              <label
                htmlFor={fieldId}
                className="block text-[10px] text-zinc-400 uppercase tracking-wider font-mono mb-1.5"
              >
                {`{{${variable}}}`}
              </label>
              <input
                id={fieldId}
                value={values[variable] ?? ""}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [variable]: e.target.value }))
                }
                placeholder={`${variable} 값 입력…`}
                maxLength={500}
                autoFocus={idx === 0}
                className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700
                           rounded-lg text-zinc-100 placeholder-zinc-600
                           focus:border-violet-500 focus:outline-none focus:ring-1
                           focus:ring-violet-500/30
                           focus-visible:outline-none focus-visible:ring-2
                           focus-visible:ring-violet-500/50
                           transition-colors"
              />
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-zinc-800">
        <button
          onClick={onCancel}
          aria-label="변수 입력 취소"
          className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors
                     rounded-md focus-visible:outline-none focus-visible:ring-2
                     focus-visible:ring-zinc-600/50"
        >
          취소
        </button>
        <button
          onClick={handleApply}
          disabled={applying || !allFilled}
          aria-label={applying ? "프롬프트 적용 중…" : "프롬프트 적용"}
          className="px-4 py-1.5 text-xs font-medium bg-zinc-100 text-zinc-900 rounded-md
                     hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed
                     transition-colors
                     focus-visible:outline-none focus-visible:ring-2
                     focus-visible:ring-zinc-400/50"
        >
          {applying ? "적용 중…" : t("prompt.apply")}
        </button>
      </div>
    </div>
  );
}
