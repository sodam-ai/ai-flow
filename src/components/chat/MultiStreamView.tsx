import { useState, useRef, useEffect, useCallback } from "react";
import { X, Download, CheckCircle2, Loader2, AlertTriangle, Send } from "lucide-react";
import MarkdownContent from "@/components/shared/MarkdownContent";
import type { StreamTarget, StreamChunk } from "@/types";
import { streamMultiAi } from "@/lib/ipc/invoke";
import { useChatStore } from "@/stores/chatStore";
import { usePersonaStore } from "@/stores/personaStore";
import { useToastStore } from "@/stores/toastStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { toUserMessage } from "@/lib/errors";

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
  { border: "border-violet-500/40", header: "bg-violet-950/30", badge: "bg-violet-900/40 text-violet-400", ring: "ring-violet-500/50" },
  { border: "border-sky-500/40",    header: "bg-sky-950/30",    badge: "bg-sky-900/40 text-sky-400",       ring: "ring-sky-500/50" },
  { border: "border-amber-500/40",  header: "bg-amber-950/30",  badge: "bg-amber-900/40 text-amber-400",   ring: "ring-amber-500/50" },
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
  const temperature = useSettingsStore((s) => s.temperature);

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
      temperature,
    );

    try {
      await promise;
    } catch (err) {
      setIsStreaming(false);
      useToastStore.getState().addToast("error", toUserMessage(err));
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
            AI 비교 <span className="text-zinc-500 font-normal">({targets.length}개 모델)</span>
          </span>

          {/* Persistent live region — announces streaming state to screen readers */}
          <span role="status" aria-live="polite" className="flex items-center">
            {isStreaming ? (
              <span
                aria-label="AI 응답 스트리밍 중"
                className="flex items-center gap-1.5 text-xs text-sky-400"
              >
                {/* Pulsing dot — Apple HIG live indicator pattern */}
                <span className="relative flex h-2 w-2" aria-hidden="true">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-60" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500" />
                </span>
                스트리밍 중
              </span>
            ) : null}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {allDone && lastPrompt && (
            <button
              onClick={handleExport}
              aria-label="비교 결과 마크다운으로 내보내기"
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"
            >
              <Download className="w-3.5 h-3.5" aria-hidden="true" />
              내보내기
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="비교 모드 닫기"
            className="p-1.5 text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/50"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Columns — each is a labelled region for screen readers */}
      <div className="flex-1 flex overflow-hidden">
        {columns.map((col, idx) => {
          const accent = COLUMN_ACCENTS[idx % COLUMN_ACCENTS.length];
          const isAdopted = adopted === idx;
          const headerId = `multi-col-header-${idx}`;

          return (
            <section
              key={idx}
              aria-labelledby={headerId}
              className={`flex-1 flex flex-col min-w-0 border-r border-zinc-800 last:border-r-0 transition-shadow ${
                isAdopted ? `ring-1 ring-inset ${accent.border}` : ""
              }`}
            >
              {/* Column header */}
              <div className={`px-3 py-2 border-b border-zinc-800 flex items-center justify-between shrink-0 ${accent.header}`}>
                <div className="min-w-0">
                  <span id={headerId} className="text-xs font-medium text-zinc-300 truncate block">
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
                      <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                      오류
                    </span>
                  )}
                  {col.isDone && !col.error && (
                    <button
                      onClick={() => handleAdopt(idx)}
                      disabled={adopted !== null}
                      aria-pressed={isAdopted}
                      aria-label={`${providerLabel(col.providerId, col.modelId)} 응답 채택`}
                      className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all cursor-pointer
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-current/50 ${
                        isAdopted
                          ? `${accent.badge} border border-current`
                          : adopted !== null
                            ? "opacity-30 cursor-not-allowed bg-zinc-800 text-zinc-600"
                            : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600"
                      }`}
                    >
                      {isAdopted && <CheckCircle2 className="w-3 h-3" aria-hidden="true" />}
                      {isAdopted ? "채택됨" : "채택"}
                    </button>
                  )}
                  {!col.isDone && isStreaming && (
                    <Loader2 className="w-3 h-3 animate-spin text-zinc-600" aria-hidden="true" />
                  )}
                </div>
              </div>

              {/* Column content */}
              <div className="flex-1 overflow-y-auto p-3">
                {col.error ? (
                  <div role="alert" className="text-xs text-red-400 bg-red-950/30 border border-red-900/30 rounded-lg p-3 flex gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" aria-hidden="true" />
                    <span>{col.error}</span>
                  </div>
                ) : col.content ? (
                  <div className="text-sm">
                    <MarkdownContent content={col.content} />
                  </div>
                ) : isStreaming ? (
                  /* Skeleton shimmer — more informative than spinner */
                  <div role="status" aria-label="응답 생성 중" className="pt-2 space-y-2">
                    <div className="h-3 rounded-full bg-zinc-800/80 animate-pulse w-5/6" />
                    <div className="h-3 rounded-full bg-zinc-800/80 animate-pulse w-4/5" />
                    <div className="h-3 rounded-full bg-zinc-800/60 animate-pulse w-3/4" />
                    <div className="h-3 rounded-full bg-zinc-800/40 animate-pulse w-1/2" />
                  </div>
                ) : null}
                <div ref={(el) => { endRefs.current[idx] = el; }} />
              </div>
            </section>
          );
        })}
      </div>

      {/* Input */}
      <div className="px-3 py-2.5 border-t border-zinc-800 shrink-0">
        {lastPrompt && (
          <div className="flex items-center gap-2 mb-1.5 overflow-hidden">
            <span className="text-[10px] text-zinc-600 uppercase tracking-wider font-semibold shrink-0">이전</span>
            <p className="text-[10px] text-zinc-500 truncate">{lastPrompt}</p>
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
            maxLength={4000}
            className="flex-1 px-3 py-2 text-sm bg-zinc-900 border border-zinc-700 rounded-lg
                       focus:outline-none focus:border-zinc-500 disabled:opacity-50 placeholder:text-zinc-600
                       focus-visible:ring-1 focus-visible:ring-violet-500/50"
          />
          <button
            onClick={handleSend}
            disabled={isStreaming || !inputText.trim()}
            aria-label="비교 질문 전송"
            className="px-3 py-2 bg-zinc-100 text-zinc-900 rounded-lg hover:bg-zinc-200 disabled:opacity-40
                       disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center
                       focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300/50"
          >
            <Send className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
}
