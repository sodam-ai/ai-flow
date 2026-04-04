import { useState, useRef, useEffect, useCallback } from "react";
import { X, Download, CheckCircle2, Loader2, AlertTriangle, Send } from "lucide-react";
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
}

// Column accent colors for visual distinction
const COLUMN_ACCENTS = [
  { border: "border-violet-500/40", header: "bg-violet-950/30", badge: "bg-violet-900/40 text-violet-400" },
  { border: "border-sky-500/40",    header: "bg-sky-950/30",    badge: "bg-sky-900/40 text-sky-400" },
  { border: "border-amber-500/40",  header: "bg-amber-950/30",  badge: "bg-amber-900/40 text-amber-400" },
];

const PROVIDER_NAMES: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  ollama: "Ollama",
};

function providerLabel(providerId: string, modelId: string): string {
  const provider = PROVIDER_NAMES[providerId] ?? providerId;
  const short = modelId.split("-").slice(-2).join("-");
  return `${provider} · ${short}`;
}

export default function MultiStreamView({ targets, onClose }: MultiStreamViewProps) {
  const { activeConversationId, loadMessages, loadConversations } = useChatStore();
  const activePersonaId = usePersonaStore((s) => s.activePersonaId);

  const [columns, setColumns] = useState<StreamColumn[]>(
    targets.map((t) => ({ providerId: t.providerId, modelId: t.modelId, content: "", isDone: false })),
  );
  const [isStreaming, setIsStreaming] = useState(false);
  const [adopted, setAdopted] = useState<number | null>(null);
  const [inputText, setInputText] = useState("");
  const [lastPrompt, setLastPrompt] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const endRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    endRefs.current.forEach((el) => el?.scrollIntoView({ behavior: "smooth" }));
  }, [columns]);

  const handleSend = useCallback(async () => {
    if (!activeConversationId || !inputText.trim() || isStreaming) return;

    const prompt = inputText.trim();
    setLastPrompt(prompt);
    setInputText("");
    setIsStreaming(true);
    setAdopted(null);

    setColumns(
      targets.map((t) => ({ providerId: t.providerId, modelId: t.modelId, content: "", isDone: false })),
    );

    const { promise } = streamMultiAi(
      activeConversationId,
      prompt,
      targets,
      activePersonaId,
      (chunk: StreamChunk) => {
        const idx = chunk.streamIndex ?? 0;

        if (chunk.type === "token" && chunk.token != null) {
          setColumns((prev) =>
            prev.map((col, i) => (i === idx ? { ...col, content: col.content + chunk.token! } : col)),
          );
        } else if (chunk.type === "stream_done") {
          setColumns((prev) =>
            prev.map((col, i) =>
              i === idx
                ? { ...col, isDone: true, inputTokens: chunk.inputTokens, outputTokens: chunk.outputTokens, costUsd: chunk.costUsd }
                : col,
            ),
          );
        } else if (chunk.type === "stream_error") {
          setColumns((prev) =>
            prev.map((col, i) => (i === idx ? { ...col, isDone: true, error: chunk.error } : col)),
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
  }, [activeConversationId, inputText, isStreaming, targets, activePersonaId, loadMessages, loadConversations]);

  const handleAdopt = (index: number) => {
    setAdopted(index);
    const col = columns[index];
    useToastStore.getState().addToast(
      "success",
      `${providerLabel(col.providerId, col.modelId)} 응답이 채택되었습니다`,
    );
  };

  const handleExport = () => {
    const lines: string[] = [
      `# AI 모델 비교 결과`,
      ``,
      `**질문:** ${lastPrompt}`,
      ``,
      `---`,
      ``,
    ];

    columns.forEach((col, i) => {
      lines.push(`## ${i + 1}. ${providerLabel(col.providerId, col.modelId)}`);
      if (col.error) {
        lines.push(``, `> 오류: ${col.error}`, ``);
      } else {
        lines.push(``, col.content, ``);
      }
      if (col.costUsd != null) {
        lines.push(`*비용: $${col.costUsd.toFixed(5)} · ${col.outputTokens ?? 0} tokens*`, ``);
      }
      lines.push(`---`, ``);
    });

    if (adopted !== null) {
      lines.push(`**채택된 응답:** ${providerLabel(columns[adopted].providerId, columns[adopted].modelId)}`);
    }

    const blob = new Blob([lines.join("\n")], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `compare-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    useToastStore.getState().addToast("success", "비교 결과가 저장되었습니다");
  };

  const allDone = columns.length > 0 && columns.every((c) => c.isDone);

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-semibold text-zinc-100">
            AI 비교 ({targets.length}개 모델)
          </span>
          {isStreaming && (
            <span className="flex items-center gap-1 text-xs text-sky-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              스트리밍...
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {allDone && lastPrompt && (
            <button
              onClick={handleExport}
              aria-label="결과 내보내기"
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              내보내기
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="비교 닫기"
            className="p-1.5 text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 rounded-md transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Columns */}
      <div className="flex-1 flex overflow-hidden">
        {columns.map((col, idx) => {
          const accent = COLUMN_ACCENTS[idx % COLUMN_ACCENTS.length];
          const isAdopted = adopted === idx;
          return (
            <div
              key={idx}
              className={`flex-1 flex flex-col min-w-0 border-r border-zinc-800 last:border-r-0 ${isAdopted ? `ring-1 ring-inset ${accent.border}` : ""}`}
            >
              {/* Column header */}
              <div className={`px-3 py-2 border-b border-zinc-800 flex items-center justify-between shrink-0 ${accent.header}`}>
                <div className="min-w-0">
                  <span className="text-xs font-medium text-zinc-300 truncate block">
                    {providerLabel(col.providerId, col.modelId)}
                  </span>
                  {col.isDone && !col.error && col.costUsd != null && (
                    <span className="text-[10px] text-zinc-600">
                      ${col.costUsd.toFixed(5)} · {col.outputTokens ?? 0} tok
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                  {col.isDone && col.error && (
                    <span className="text-[10px] text-red-400 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      오류
                    </span>
                  )}
                  {col.isDone && !col.error && (
                    <button
                      onClick={() => handleAdopt(idx)}
                      disabled={adopted !== null}
                      aria-pressed={isAdopted}
                      aria-label={`${providerLabel(col.providerId, col.modelId)} 응답 채택`}
                      className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-colors cursor-pointer ${
                        isAdopted
                          ? `${accent.badge} border border-current`
                          : adopted !== null
                            ? "opacity-30 cursor-not-allowed bg-zinc-800 text-zinc-600"
                            : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700"
                      }`}
                    >
                      {isAdopted && <CheckCircle2 className="w-3 h-3" />}
                      {isAdopted ? "채택됨" : "채택"}
                    </button>
                  )}
                  {!col.isDone && isStreaming && (
                    <Loader2 className="w-3 h-3 animate-spin text-zinc-600" />
                  )}
                </div>
              </div>

              {/* Column content */}
              <div className="flex-1 overflow-y-auto p-3">
                {col.error ? (
                  <div className="text-xs text-red-400 bg-red-950/30 border border-red-900/30 rounded-lg p-3">
                    <AlertTriangle className="w-3.5 h-3.5 mb-1" />
                    {col.error}
                  </div>
                ) : col.content ? (
                  <div className="text-sm">
                    <MarkdownContent content={col.content} />
                  </div>
                ) : isStreaming ? (
                  <div className="flex items-center gap-2 text-xs text-zinc-600 pt-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    응답 대기 중...
                  </div>
                ) : null}
                <div ref={(el) => { endRefs.current[idx] = el; }} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Input */}
      <div className="px-3 py-2.5 border-t border-zinc-800 shrink-0">
        {lastPrompt && (
          <div className="text-[10px] text-zinc-600 mb-1.5 truncate">
            이전 질문: {lastPrompt}
          </div>
        )}
        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder={`${targets.length}개 모델에 동시에 질문하세요...`}
            disabled={isStreaming}
            aria-label="비교 질문 입력"
            className="flex-1 px-3 py-2 text-sm bg-zinc-900 border border-zinc-700 rounded-lg focus:outline-none focus:border-zinc-500 disabled:opacity-50 placeholder:text-zinc-600"
          />
          <button
            onClick={handleSend}
            disabled={isStreaming || !inputText.trim()}
            aria-label="비교 전송"
            className="px-3 py-2 bg-zinc-100 text-zinc-900 rounded-lg hover:bg-zinc-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
