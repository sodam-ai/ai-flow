import { useState } from "react";
import { useTranslation } from "react-i18next";
import { usePromptStore } from "@/stores/promptStore";
import type { PromptTemplate } from "@/types";
import { X } from "lucide-react";

interface Props {
  prompt: PromptTemplate | null; // null = creating new
  onClose: () => void;
}

export default function PromptEditor({ prompt, onClose }: Props) {
  const { t } = useTranslation();
  const { createPrompt, updatePrompt } = usePromptStore();

  const [title, setTitle] = useState(prompt?.title ?? "");
  const [content, setContent] = useState(prompt?.content ?? "");
  const [description, setDescription] = useState(prompt?.description ?? "");
  const [tagInput, setTagInput] = useState(prompt?.tags.join(", ") ?? "");
  const [saving, setSaving] = useState(false);

  // Extract variables from content for live preview
  const variables = extractVariables(content);

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) return;
    setSaving(true);

    const tags = tagInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    if (prompt) {
      await updatePrompt(prompt.id, { title, content, description, tags });
    } else {
      await createPrompt({ title, content, description, tags });
    }

    setSaving(false);
    onClose();
  };

  return (
    <div className="flex flex-col max-h-[80vh]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <h3 className="text-sm font-semibold">
          {prompt ? t("prompt.edit") : t("prompt.create")}
        </h3>
        <button onClick={onClose} className="p-1 hover:bg-zinc-800 rounded">
          <X className="w-4 h-4 text-zinc-400" />
        </button>
      </div>

      {/* Form */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        <div>
          <label className="text-[10px] text-zinc-500 uppercase tracking-wider">
            Title
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Prompt title..."
            className="w-full mt-1 px-3 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded-lg focus:border-zinc-500 focus:outline-none"
            autoFocus
          />
        </div>

        <div>
          <label className="text-[10px] text-zinc-500 uppercase tracking-wider">
            Content
          </label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={"Use {{variable}} for dynamic slots...\n\nExample: Translate the following to {{language}}:\n{{text}}"}
            rows={8}
            className="w-full mt-1 px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg focus:border-zinc-500 focus:outline-none resize-none font-mono"
          />
          {variables.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              <span className="text-[9px] text-zinc-600">{t("prompt.variables")}:</span>
              {variables.map((v) => (
                <span
                  key={v}
                  className="text-[9px] px-1.5 py-0.5 bg-indigo-900/30 text-indigo-400 rounded font-mono"
                >
                  {`{{${v}}}`}
                </span>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="text-[10px] text-zinc-500 uppercase tracking-wider">
            Description
          </label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description..."
            className="w-full mt-1 px-3 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded-lg focus:border-zinc-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="text-[10px] text-zinc-500 uppercase tracking-wider">
            {t("prompt.tags")} (comma separated)
          </label>
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            placeholder="coding, translation, writing..."
            className="w-full mt-1 px-3 py-1.5 text-sm bg-zinc-800 border border-zinc-700 rounded-lg focus:border-zinc-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-zinc-800">
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving || !title.trim() || !content.trim()}
          className="px-4 py-1.5 text-xs bg-zinc-100 text-zinc-900 rounded-md hover:bg-zinc-200 disabled:opacity-30 transition-colors"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}

/** Extract {{variable}} names from content (client-side mirror of Rust logic) */
function extractVariables(content: string): string[] {
  const vars: string[] = [];
  const seen = new Set<string>();
  const regex = /\{\{(\w+)\}\}/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    if (!seen.has(match[1])) {
      seen.add(match[1]);
      vars.push(match[1]);
    }
  }
  return vars;
}
