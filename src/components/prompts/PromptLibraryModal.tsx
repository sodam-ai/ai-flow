import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { usePromptStore } from "@/stores/promptStore";
import type { PromptTemplate } from "@/types";
import PromptEditor from "./PromptEditor";
import VariableFillDialog from "./VariableFillDialog";
import { X, Plus, Star, StarOff, Trash2 } from "lucide-react";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl w-[600px] max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <h2 className="text-sm font-semibold">{t("prompt.title")}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEditor(true)}
              className="flex items-center gap-1 px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 rounded transition-colors"
            >
              <Plus className="w-3 h-3" />
              {t("prompt.create")}
            </button>
            <button
              onClick={() => setModalOpen(false)}
              className="p-1 hover:bg-zinc-800 rounded"
            >
              <X className="w-4 h-4 text-zinc-400" />
            </button>
          </div>
        </div>

        {/* Tags filter */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 px-4 py-2 border-b border-zinc-800">
            <button
              onClick={() => setSelectedTag(null)}
              className={`px-2 py-0.5 text-[10px] rounded-full transition-colors ${
                !selectedTag
                  ? "bg-zinc-100 text-zinc-900"
                  : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
              }`}
            >
              All
            </button>
            {tags.map((tag) => (
              <button
                key={tag}
                onClick={() => setSelectedTag(tag === selectedTag ? null : tag)}
                className={`px-2 py-0.5 text-[10px] rounded-full transition-colors ${
                  tag === selectedTag
                    ? "bg-zinc-100 text-zinc-900"
                    : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {/* Prompt list */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filtered.length === 0 ? (
            <p className="text-xs text-zinc-500 text-center py-8">
              {t("prompt.noResults")}
            </p>
          ) : (
            filtered.map((prompt) => (
              <div
                key={prompt.id}
                onClick={() => handleUsePrompt(prompt)}
                className="group p-3 rounded-lg hover:bg-zinc-800/50 cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
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
                        <span className="text-[9px] text-zinc-600">
                          ×{prompt.use_count}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions (hover only) */}
                  <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updatePrompt(prompt.id, {
                          is_favorite: !prompt.is_favorite,
                        });
                      }}
                      className="p-1 rounded hover:bg-zinc-700"
                    >
                      {prompt.is_favorite ? (
                        <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                      ) : (
                        <StarOff className="w-3 h-3 text-zinc-500" />
                      )}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingPrompt(prompt);
                      }}
                      className="p-1 rounded hover:bg-zinc-700 text-zinc-500 text-[10px]"
                    >
                      Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deletePrompt(prompt.id);
                      }}
                      className="p-1 rounded hover:bg-zinc-700"
                    >
                      <Trash2 className="w-3 h-3 text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
