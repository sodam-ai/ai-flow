import { useState } from "react";
import { useTranslation } from "react-i18next";
import { usePromptStore } from "@/stores/promptStore";
import type { PromptTemplate } from "@/types";
import { X, History, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import { getPromptVersions, restorePromptVersion } from "@/lib/ipc/invoke";
import type { PromptVersionEntry } from "@/lib/ipc/invoke";

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

  // Version history state
  const [showHistory, setShowHistory] = useState(false);
  const [versions, setVersions] = useState<PromptVersionEntry[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);

  // Extract variables from content for live preview
  const variables = extractVariables(content);

  const handleToggleHistory = async () => {
    if (!prompt) return;
    const next = !showHistory;
    setShowHistory(next);
    if (next && versions.length === 0) {
      setLoadingVersions(true);
      try {
        const v = await getPromptVersions(prompt.id);
        setVersions(v);
      } catch {
        // silently ignore
      } finally {
        setLoadingVersions(false);
      }
    }
  };

  const handleRestoreVersion = async (version: PromptVersionEntry) => {
    if (!prompt) return;
    const confirmed = window.confirm(
      `버전 ${version.versionNumber}을 복원하시겠습니까?\n현재 편집 중인 내용이 저장되지 않은 경우 사라집니다.`
    );
    if (!confirmed) return;
    setRestoringId(version.id);
    try {
      await restorePromptVersion(prompt.id, version.id);
      // Reload content into editor
      setContent(version.content);
      setShowHistory(false);
    } catch (e) {
      alert(`복원 실패: ${e}`);
    } finally {
      setRestoringId(null);
    }
  };

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

        {/* Version history — only shown when editing an existing prompt */}
        {prompt && (
          <div className="border border-zinc-800 rounded-lg overflow-hidden">
            <button
              onClick={handleToggleHistory}
              className="w-full flex items-center justify-between px-3 py-2.5 text-left hover:bg-zinc-800/40 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <History className="w-3.5 h-3.5 text-zinc-500" />
                <span className="text-xs font-medium text-zinc-400">버전 기록</span>
                {versions.length > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-800 text-zinc-500">
                    {versions.length}
                  </span>
                )}
              </div>
              {showHistory ? (
                <ChevronUp className="w-3.5 h-3.5 text-zinc-600" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-zinc-600" />
              )}
            </button>

            {showHistory && (
              <div className="border-t border-zinc-800">
                {loadingVersions ? (
                  <div className="px-3 py-4 text-xs text-zinc-600 text-center">로딩 중…</div>
                ) : versions.length === 0 ? (
                  <div className="px-3 py-4 text-xs text-zinc-600 text-center">
                    저장된 버전이 없습니다
                  </div>
                ) : (
                  <div className="max-h-48 overflow-y-auto divide-y divide-zinc-800/60">
                    {versions.map((ver) => (
                      <div key={ver.id} className="flex items-start gap-3 px-3 py-2.5 hover:bg-zinc-800/30 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-medium text-zinc-300">
                              v{ver.versionNumber}
                            </span>
                            <span className="text-[10px] text-zinc-600">
                              {new Date(ver.createdAt).toLocaleString("ko-KR", {
                                month: "short", day: "numeric",
                                hour: "2-digit", minute: "2-digit",
                              })}
                            </span>
                          </div>
                          <p className="text-[10px] text-zinc-500 mt-0.5 line-clamp-2 font-mono leading-relaxed">
                            {ver.content.slice(0, 100)}{ver.content.length > 100 ? "…" : ""}
                          </p>
                        </div>
                        <button
                          onClick={() => handleRestoreVersion(ver)}
                          disabled={restoringId === ver.id}
                          title={`v${ver.versionNumber} 복원`}
                          className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 border border-zinc-700 disabled:opacity-40 transition-colors cursor-pointer flex-shrink-0"
                        >
                          <RotateCcw className="w-3 h-3" />
                          복원
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
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
