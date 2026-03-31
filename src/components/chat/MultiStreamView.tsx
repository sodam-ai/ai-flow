import { useState, useRef, useEffect } from "react";
import MarkdownContent from "@/components/shared/MarkdownContent";
import type { StreamTarget, StreamChunk } from "@/types";
import { streamMultiAi } from "@/lib/ipc/invoke";
import { useChatStore } from "@/stores/chatStore";
import { usePersonaStore } from "@/stores/personaStore";
import { useToastStore } from "@/stores/toastStore";

interface MultiStreamViewProps {
  targets: StreamTarget[];
  onClose: () => void;
}

interface StreamColumn {
  providerId: string;
  modelId: string;
  content: string;
  isDone: boolean;
  error?: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  costKrw?: number;
}

export default function MultiStreamView({ targets, onClose }: MultiStreamViewProps) {
  const { activeConversationId, loadMessages, loadConversations } = useChatStore();
  const activePersonaId = usePersonaStore((s) => s.activePersonaId);

  const [columns, setColumns] = useState<StreamColumn[]>(
    targets.map((t) => ({
      providerId: t.providerId,
      modelId: t.modelId,
      content: "",
      isDone: false,
    })),
  );
  const [isStreaming, setIsStreaming] = useState(false);
  const [adopted, setAdopted] = useState<number | null>(null);
  const [inputText, setInputText] = useState("");
  const endRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Auto-scroll each column
  useEffect(() => {
    endRefs.current.forEach((ref) => ref?.scrollIntoView({ behavior: "smooth" }));
  }, [columns]);

  const handleSend = async () => {
    if (!activeConversationId || !inputText.trim() || isStreaming) return;

    setIsStreaming(true);
    setAdopted(null);

    // Reset columns
    setColumns(
      targets.map((t) => ({
        providerId: t.providerId,
        modelId: t.modelId,
        content: "",
        isDone: false,
      })),
    );

    const { promise } = streamMultiAi(
      activeConversationId,
      inputText.trim(),
      targets,
      activePersonaId,
      (chunk: StreamChunk) => {
        const idx = chunk.streamIndex ?? 0;

        if (chunk.type === "token" && chunk.token != null) {
          setColumns((prev) =>
            prev.map((col, i) =>
              i === idx ? { ...col, content: col.content + chunk.token! } : col,
            ),
          );
        } else if (chunk.type === "stream_done") {
          setColumns((prev) =>
            prev.map((col, i) =>
              i === idx
                ? {
                    ...col,
                    isDone: true,
                    inputTokens: chunk.inputTokens,
                    outputTokens: chunk.outputTokens,
                    costUsd: chunk.costUsd,
                    costKrw: chunk.costKrw,
                  }
                : col,
            ),
          );
        } else if (chunk.type === "stream_error") {
          setColumns((prev) =>
            prev.map((col, i) =>
              i === idx ? { ...col, isDone: true, error: chunk.error } : col,
            ),
          );
        } else if (chunk.type === "multi_done") {
          setIsStreaming(false);
          loadMessages(activeConversationId);
          loadConversations();
        }
      },
    );

    try {
      await promise;
    } catch (err) {
      setIsStreaming(false);
      useToastStore.getState().addToast("error", String(err));
    }

    setInputText("");
  };

  const handleAdopt = async (index: number) => {
    // In a real scenario, we'd need the message ID from the DB.
    // For now, mark the column as adopted in UI.
    setAdopted(index);
    useToastStore.getState().addToast(
      "success",
      `${columns[index].providerId}:${columns[index].modelId} response adopted`,
    );
  };

  const providerLabel = (pid: string, mid: string) => {
    const names: Record<string, string> = {
      openai: "OpenAI",
      anthropic: "Anthropic",
      google: "Google",
      ollama: "Ollama",
    };
    return `${names[pid] ?? pid} · ${mid.split("-").slice(-1)[0] || mid}`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-300">
            Multi-AI Compare ({targets.length})
          </span>
          {isStreaming && (
            <span className="text-xs text-blue-400 animate-pulse">Streaming...</span>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-1"
        >
          Close
        </button>
      </div>

      {/* Columns */}
      <div className="flex-1 flex divide-x divide-zinc-800 overflow-hidden">
        {columns.map((col, idx) => (
          <div key={idx} className="flex-1 flex flex-col min-w-0">
            {/* Column header */}
            <div className="px-3 py-2 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-400 truncate">
                {providerLabel(col.providerId, col.modelId)}
              </span>
              {col.isDone && !col.error && (
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-500">
                    ${col.costUsd?.toFixed(4)} · {col.outputTokens} tok
                  </span>
                  <button
                    onClick={() => handleAdopt(idx)}
                    disabled={adopted !== null}
                    className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
                      adopted === idx
                        ? "bg-green-600/30 text-green-400 border border-green-600/50"
                        : adopted !== null
                          ? "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                          : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                    }`}
                  >
                    {adopted === idx ? "Adopted" : "Adopt"}
                  </button>
                </div>
              )}
            </div>

            {/* Column content */}
            <div className="flex-1 overflow-y-auto p-3">
              {col.error ? (
                <div className="text-xs text-red-400 bg-red-950/30 rounded p-2">
                  {col.error}
                </div>
              ) : col.content ? (
                <div className="text-sm">
                  <MarkdownContent content={col.content} />
                </div>
              ) : isStreaming ? (
                <div className="text-xs text-zinc-500 animate-pulse">Waiting...</div>
              ) : null}
              <div ref={(el) => { endRefs.current[idx] = el; }} />
            </div>
          </div>
        ))}
      </div>

      {/* Input */}
      <div className="p-3 border-t border-zinc-800">
        <div className="flex gap-2">
          <input
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Compare across AI models..."
            disabled={isStreaming}
            className="flex-1 px-3 py-2 text-sm bg-zinc-900 border border-zinc-700 rounded-lg focus:outline-none focus:border-zinc-500 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={isStreaming || !inputText.trim()}
            className="px-4 py-2 text-sm bg-zinc-100 text-zinc-900 rounded-lg hover:bg-zinc-200 disabled:opacity-50 transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
