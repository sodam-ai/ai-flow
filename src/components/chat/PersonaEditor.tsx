import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { usePersonaStore } from "@/stores/personaStore";
import type { Persona } from "@/types";
import { X } from "lucide-react";

const PERSONA_COLORS = [
  "#6366f1", "#ec4899", "#14b8a6", "#f59e0b",
  "#8b5cf6", "#06b6d4", "#ef4444", "#22c55e",
  "#f97316", "#3b82f6", "#a855f7", "#64748b",
];

const PERSONA_COLOR_NAMES: Record<string, string> = {
  "#6366f1": "인디고",
  "#ec4899": "핑크",
  "#14b8a6": "청록",
  "#f59e0b": "황금",
  "#8b5cf6": "보라",
  "#06b6d4": "하늘",
  "#ef4444": "빨강",
  "#22c55e": "초록",
  "#f97316": "주황",
  "#3b82f6": "파랑",
  "#a855f7": "자주",
  "#64748b": "회색",
};

interface Props {
  persona: Persona | null; // null = creating new
  onClose: () => void;
}

export default function PersonaEditor({ persona, onClose }: Props) {
  const { t } = useTranslation();
  const { createPersona, updatePersona } = usePersonaStore();
  const isEditing = persona !== null;

  const [name, setName] = useState(persona?.name ?? "");
  const [description, setDescription] = useState(persona?.description ?? "");
  const [systemPrompt, setSystemPrompt] = useState(persona?.system_prompt ?? "");
  const [color, setColor] = useState(persona?.color ?? "#6366f1");
  const [saving, setSaving] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const canSave = name.trim().length > 0 && systemPrompt.trim().length > 0;

  // Focus close button on mount
  useEffect(() => {
    requestAnimationFrame(() => closeButtonRef.current?.focus());
  }, []);

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); onClose(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);

    if (isEditing) {
      await updatePersona(persona.id, {
        name: name.trim(),
        description: description.trim(),
        system_prompt: systemPrompt.trim(),
        color,
      });
    } else {
      await createPersona({
        name: name.trim(),
        description: description.trim() || undefined,
        system_prompt: systemPrompt.trim(),
        color,
      });
    }

    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="persona-editor-title"
        className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-[480px] max-h-[80vh] flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <h2 id="persona-editor-title" className="text-sm font-semibold">
            {isEditing ? t("persona.edit") : t("persona.create")}
          </h2>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="페르소나 편집기 닫기"
            className="p-1 hover:bg-zinc-800 rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-600/50"
          >
            <X className="w-4 h-4 text-zinc-400" aria-hidden="true" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Name */}
          <div>
            <label htmlFor="pe-name" className="text-[10px] text-zinc-500 uppercase tracking-wider">
              Name
            </label>
            <input
              id="pe-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Python Expert"
              maxLength={100}
              className="w-full mt-1 px-3 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded-lg focus:border-zinc-500 focus:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500/50"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="pe-desc" className="text-[10px] text-zinc-500 uppercase tracking-wider">
              Description
            </label>
            <input
              id="pe-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description of this persona's specialty..."
              maxLength={500}
              className="w-full mt-1 px-3 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded-lg focus:border-zinc-500 focus:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500/50"
            />
          </div>

          {/* System Prompt */}
          <div>
            <label htmlFor="pe-system-prompt" className="text-[10px] text-zinc-500 uppercase tracking-wider">
              System Prompt
            </label>
            <textarea
              id="pe-system-prompt"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="You are an expert in... You always... When asked about..."
              rows={6}
              maxLength={10000}
              aria-describedby="pe-system-prompt-count"
              className="w-full mt-1 px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg focus:border-zinc-500 focus:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500/50 resize-none font-mono"
            />
            <div
              id="pe-system-prompt-count"
              aria-live="polite"
              aria-atomic="true"
              className="text-[9px] text-zinc-600 mt-1 text-right"
            >
              {systemPrompt.length}/10,000
            </div>
          </div>

          {/* Color */}
          <div>
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider" id="pe-color-label">
              Color
            </span>
            <div
              role="group"
              aria-labelledby="pe-color-label"
              className="flex flex-wrap gap-2 mt-1.5"
            >
              {PERSONA_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  aria-label={`${PERSONA_COLOR_NAMES[c] ?? c} 색상 선택`}
                  aria-pressed={color === c}
                  className={`w-6 h-6 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-zinc-900 focus-visible:ring-white ${
                    color === c
                      ? "ring-2 ring-offset-2 ring-offset-zinc-900 ring-white scale-110"
                      : "hover:scale-110"
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-zinc-800">
          <button
            onClick={onClose}
            aria-label="편집 취소"
            className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors rounded
                       focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-600/50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !canSave}
            aria-label={saving ? "저장 중" : isEditing ? "페르소나 업데이트" : "페르소나 생성"}
            className="px-4 py-1.5 text-xs bg-zinc-100 text-zinc-900 rounded-md hover:bg-zinc-200 disabled:opacity-30 transition-colors
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/50"
          >
            {saving ? "Saving..." : isEditing ? "Update" : "Create"}
          </button>
        </div>
      </div>
    </div>
  );
}
