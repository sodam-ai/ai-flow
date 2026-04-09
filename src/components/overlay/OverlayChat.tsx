import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { closeOverlay } from "@/lib/ipc/invoke";
import { invoke, Channel } from "@tauri-apps/api/core";
import { usePersonaStore } from "@/stores/personaStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { Send, Square, X } from "lucide-react";
import MarkdownContent from "@/components/shared/MarkdownContent";
import type { StreamChunk } from "@/types";

export default function OverlayChat() {
  const { t } = useTranslation();
  const [input, setInput] = useState("");
  const [response, setResponse] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamId, setStreamId] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const responseRef = useRef<HTMLDivElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeOverlay();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Auto-scroll response
  useEffect(() => {
    responseRef.current?.scrollTo(0, responseRef.current.scrollHeight);
  }, [response]);

  const handleSubmit = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    setInput("");
    setResponse("");
    setIsStreaming(true);

    const newStreamId = crypto.randomUUID();
    setStreamId(newStreamId);

    let accumulated = "";
    const channel = new Channel<StreamChunk>();
    channel.onmessage = (chunk) => {
      if (chunk.type === "token" && chunk.token) {
        accumulated += chunk.token;
        setResponse(accumulated);
      } else if (chunk.type === "done") {
        setIsStreaming(false);
        setStreamId(null);
      } else if (chunk.type === "error") {
        setIsStreaming(false);
        setStreamId(null);
        setResponse(`Error: ${chunk.error ?? "Unknown error"}`);
      }
    };

    const { activeProviderId, activeModelId } = useSettingsStore.getState();
    const personaId = usePersonaStore.getState().activePersonaId;

    try {
      // Create a temporary conversation for overlay
      const conv = await invoke<{ id: string }>("create_conversation", {
        providerId: activeProviderId,
        modelId: activeModelId,
      });

      await invoke("stream_ai_message", {
        conversationId: conv.id,
        content: text,
        providerId: activeProviderId,
        modelId: activeModelId,
        streamId: newStreamId,
        personaId,
        channel,
      });
    } catch (err) {
      setIsStreaming(false);
      setStreamId(null);
      const msg = err instanceof Error ? err.message : String(err);
      setResponse(`Error: ${msg}`);
    }
  };

  const handleCancel = async () => {
    if (streamId) {
      await invoke("cancel_stream", { streamId });
      setIsStreaming(false);
      setStreamId(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div
      className="h-screen flex flex-col bg-zinc-900/95 backdrop-blur-xl rounded-xl overflow-hidden select-none"
      data-tauri-drag-region
    >
      {/* Header bar (draggable) */}
      <div
        className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800/50"
        data-tauri-drag-region
      >
        <span className="text-[10px] text-zinc-600" data-tauri-drag-region>
          AIFlow
        </span>
        <div className="flex items-center gap-1">
          <span className="text-[9px] text-zinc-700" aria-hidden="true">
            {t("overlay.close")}
          </span>
          <button
            onClick={() => closeOverlay()}
            aria-label="오버레이 닫기 (Esc)"
            className="p-0.5 hover:bg-zinc-800 rounded focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-600/50"
          >
            <X className="w-3 h-3 text-zinc-500" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Response area — role="log" announces new streaming tokens to AT */}
      <div
        ref={responseRef}
        role="log"
        aria-live="polite"
        aria-label="AI 응답"
        className="flex-1 overflow-y-auto px-4 py-3 min-h-0"
      >
        {response && <MarkdownContent content={response} />}
      </div>

      {/* Input */}
      <div className="border-t border-zinc-800/50 p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("overlay.placeholder")}
            disabled={isStreaming}
            rows={1}
            aria-label="메시지 입력"
            className="flex-1 resize-none bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 disabled:opacity-50 focus-visible:ring-1 focus-visible:ring-violet-500/40"
            data-testid="overlay-input"
          />
          {isStreaming ? (
            <button
              onClick={handleCancel}
              aria-label="AI 응답 중단"
              className="p-2 rounded-lg bg-red-900/30 hover:bg-red-900/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
            >
              <Square className="w-4 h-4 text-red-400" aria-hidden="true" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!input.trim()}
              aria-label="메시지 전송"
              className="p-2 rounded-lg bg-zinc-100 hover:bg-zinc-200 disabled:opacity-30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/50"
            >
              <Send className="w-4 h-4 text-zinc-900" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
