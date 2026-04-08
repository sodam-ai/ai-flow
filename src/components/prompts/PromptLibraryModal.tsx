import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { usePromptStore } from "@/stores/promptStore";
import type { PromptTemplate } from "@/types";
import PromptEditor from "./PromptEditor";
import VariableFillDialog from "./VariableFillDialog";
import { X, Plus, Star, StarOff, Trash2, Pencil, AlertTriangle, Check } from "lucide-react";

interface Props {
  onUsePrompt: (content: string) => void;
}

export default function PromptLibraryModal({ onUsePrompt }: Props) {
  const { t } = useTranslation();
  const {
    prompts,
    isModalOpen,
    fetchPrompts,
    deletePrompt,
    updatePrompt,
    setModalOpen,
    getAllTags,
  } = usePromptStore();

  const [showEditor, setShowEditor] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<PromptTemplate | null>(null);
  const [fillPrompt, setFillPrompt] = useState<PromptTemplate | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  // Inline delete confirm — id of prompt pending confirmation, null = none
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (isModalOpen) fetchPrompts();
  }, [isModalOpen, fetchPrompts]);

  if (!isModalOpen) return null;

  const tags = getAllTags();
  const filtered = selectedTag
    ? prompts.filter((p) => p.tags.includes(selectedTag))
    : prompts;

  const handleUsePrompt = (prompt: PromptTemplate) => {
    if (prompt.variables.length > 0) {
      setFillPrompt(prompt);
    } else {
      onUsePrompt(prompt.content);
      setModalOpen(false);
    }
  };

  if (showEditor || editingPrompt) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-[520px] max-h-[80vh] overflow-hidden">
          <PromptEditor
            prompt={editingPrompt}
            onClose={() => {
              setShowEditor(false);
              setEditingPrompt(null);
            }}
          />
        </div>
      </div>
    );
  }

  if (fillPrompt) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <VariableFillDialog
          prompt={fillPrompt}
          onApply={(content) => {
            onUsePrompt(content);
            setFillPrompt(null);
            setModalOpen(false);
          }}
          onCancel={() => setFillPrompt(null)}
        />
      </div>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="prompt-lib-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
    >
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-[600px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <h2 id="prompt-lib-title" className="text-sm font-semibold">{t("prompt.title")}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEditor(true)}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700
                         rounded transition-colors
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-600/50"
            >
              <Plus className="w-3 h-3" aria-hidden="true" />
              {t("prompt.create")}
            </button>
            <button
              onClick={() => setModalOpen(false)}
              aria-label="프롬프트 라이브러리 닫기"
              className="p-1 hover:bg-zinc-800 rounded transition-colors
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-600/50"
            >
              <X className="w-4 h-4 text-zinc-400" />
            </button>
          </div>
        </div>

        {/* Tags filter */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 px-4 py-2 border-b border-zinc-800" role="group" aria-label="태그 필터">
            <button
              onClick={() => setSelectedTag(null)}
              aria-pressed={!selectedTag}
              className={`px-2 py-0.5 text-[10px] rounded-full transition-colors
                          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-600/50
                          ${!selectedTag ? "bg-zinc-100 text-zinc-900" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}
            >
              All
            </button>
            {tags.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                aria-pressed={tag === selectedTag}
                className={`px-2 py-0.5 text-[10px] rounded-full transition-colors
                            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-600/50
                            ${tag === selectedTag ? "bg-zinc-100 text-zinc-900" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {/* Prompt list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1" role="list" aria-label="프롬프트 목록">
          {filtered.length === 0 ? (
            <p className="text-xs text-zinc-500 text-center py-8">
              {t("prompt.noResults")}
            </p>
          ) : (
            filtered.map((prompt) => (
              <div
                key={prompt.id}
                role="listitem"
                className="group p-3 rounded-lg hover:bg-zinc-800/50 cursor-pointer transition-colors"
              >
                {/* Main row — click to use */}
                <div
                  className="flex items-start justify-between gap-2"
                  onClick={() => {
                    if (confirmDeleteId !== prompt.id) handleUsePrompt(prompt);
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-zinc-200 truncate">
                      {prompt.title}
                    </div>
                    {prompt.description && (
                      <div className="text-[10px] text-zinc-500 mt-0.5 line-clamp-2">
                        {prompt.description}
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      {prompt.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[9px] px-1.5 py-0.5 bg-zinc-800 text-zinc-500 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                      {prompt.variables.length > 0 && (
                        <span className="text-[9px] text-indigo-400">
                          {prompt.variables.length} {t("prompt.variables")}
                        </span>
                      )}
                      {prompt.use_count > 0 && (
                        <span className="text-[9px] text-zinc-600">×{prompt.use_count}</span>
                      )}
                    </div>
                  </div>

                  {/* Actions — visible on hover or focus-within; hidden when confirm is open */}
                  {confirmDeleteId !== prompt.id && (
                    <div className="hidden group-hover:flex group-focus-within:flex items-center gap-0.5 shrink-0">
                      {/* Favorite toggle */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updatePrompt(prompt.id, { is_favorite: !prompt.is_favorite });
                        }}
                        aria-label={prompt.is_favorite ? "즐겨찾기 해제" : "즐겨찾기 추가"}
                        aria-pressed={prompt.is_favorite}
                        className="p-1 rounded hover:bg-zinc-700 transition-colors
                                   focus-visible:outline-none focus-visible:ring-1
                                   focus-visible:ring-zinc-500/50"
                      >
                        {prompt.is_favorite ? (
                          <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                        ) : (
                          <StarOff className="w-3 h-3 text-zinc-500" />
                        )}
                      </button>
                      {/* Edit */}
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingPrompt(prompt); }}
                        aria-label={`${prompt.title} 편집`}
                        className="p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-300
                                   transition-colors
                                   focus-visible:outline-none focus-visible:ring-1
                                   focus-visible:ring-zinc-500/50"
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      {/* Delete — triggers inline confirm */}
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(prompt.id); }}
                        aria-label={`${prompt.title} 삭제`}
                        className="p-1 rounded hover:bg-zinc-700 transition-colors
                                   focus-visible:outline-none focus-visible:ring-1
                                   focus-visible:ring-red-500/50"
                      >
                        <Trash2 className="w-3 h-3 text-red-400" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Inline delete confirm */}
                {confirmDeleteId === prompt.id && (
                  <div
                    role="alert"
                    className="mt-2 flex items-center gap-2 px-2.5 py-1.5
                               bg-red-950/40 border border-red-800/40 rounded-lg"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" aria-hidden="true" />
                    <p className="text-[10px] text-red-300 flex-1 leading-tight">
                      "{prompt.title}" 삭제. 복구 불가.
                    </p>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                        aria-label="삭제 취소"
                        className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700
                                   transition-colors
                                   focus-visible:outline-none focus-visible:ring-1
                                   focus-visible:ring-zinc-500/50"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deletePrompt(prompt.id);
                          setConfirmDeleteId(null);
                        }}
                        aria-label="삭제 확인"
                        className="p-1 rounded bg-red-600 hover:bg-red-500 text-white
                                   transition-colors
                                   focus-visible:outline-none focus-visible:ring-1
                                   focus-visible:ring-red-400/50"
                      >
                        <Check className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
