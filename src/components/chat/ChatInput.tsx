import { useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Send, Square, BookOpen } from "lucide-react";
import FileDropZone from "./FileDropZone";
import { usePromptStore } from "@/stores/promptStore";
import type { FileContent } from "@/types";

interface Props {
  isStreaming: boolean;
  onSubmit: (content: string) => void;
  onCancel: () => void;
}

export default function ChatInput({ isStreaming, onSubmit, onCancel }: Props) {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<FileContent[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { t } = useTranslation();
  const { setModalOpen } = usePromptStore();

  const handleAttachmentsChange = useCallback((files: FileContent[]) => {
    setAttachments(files);
  }, []);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if ((!trimmed && attachments.length === 0) || isStreaming) return;

    // Build message with file attachments prepended
    let fullContent = "";
    for (const file of attachments) {
      if (file.content_type === "text") {
        fullContent += `[File: ${file.info.name}]\n\`\`\`\n${file.content}\n\`\`\`\n\n`;
      } else {
        fullContent += `[Image: ${file.info.name} (${(file.info.size / 1024).toFixed(0)}KB)]\n\n`;
      }
    }
    fullContent += trimmed;

    onSubmit(fullContent);
    setInput("");
    setAttachments([]);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 200) + "px";
    }
  };

  return (
    <FileDropZone attachments={attachments} onAttachmentsChange={handleAttachmentsChange}>
      <div className="border-t border-zinc-800 p-3">
        <div className="flex items-end gap-2 max-w-3xl mx-auto">
          {/* Prompt library button */}
          <button
            onClick={() => setModalOpen(true)}
            className="p-2.5 rounded-xl text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
            title={t("prompt.title")}
          >
            <BookOpen className="w-4 h-4" />
          </button>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder={t("chat.placeholder")}
            rows={1}
            className="flex-1 resize-none bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
            disabled={isStreaming}
          />
          {isStreaming ? (
            <button
              onClick={onCancel}
              className="p-2.5 rounded-xl bg-red-900/50 text-red-400 hover:bg-red-900/80 transition-colors"
              title={t("chat.stop")}
            >
              <Square className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!input.trim() && attachments.length === 0}
              className="p-2.5 rounded-xl bg-zinc-100 text-zinc-900 hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title={t("chat.send")}
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </FileDropZone>
  );
}
