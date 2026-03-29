import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Send, Square } from "lucide-react";

interface Props {
  isStreaming: boolean;
  onSubmit: (content: string) => void;
  onCancel: () => void;
}

export default function ChatInput({ isStreaming, onSubmit, onCancel }: Props) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { t } = useTranslation();

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    onSubmit(trimmed);
    setInput("");
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
    <div className="border-t border-zinc-800 p-3">
      <div className="flex items-end gap-2 max-w-3xl mx-auto">
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
            disabled={!input.trim()}
            className="p-2.5 rounded-xl bg-zinc-100 text-zinc-900 hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title={t("chat.send")}
          >
            <Send className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
