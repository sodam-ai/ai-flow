import { useState, useRef, useEffect } from "react";
import type { Message, MessageVersion } from "@/types";
import { useTranslation } from "react-i18next";
import { useChatStore } from "@/stores/chatStore";
import { useToastStore } from "@/stores/toastStore";
import { getMessageVersions } from "@/lib/ipc/invoke";
import { useTts } from "@/hooks/useTts";
import { useSettingsStore } from "@/stores/settingsStore";
import { Copy, Check, RefreshCw, ChevronLeft, ChevronRight, Volume2, VolumeX } from "lucide-react";
import MarkdownContent from "@/components/shared/MarkdownContent";

interface Props {
  message: Message;
  messageIndex?: number;
  exchangeRate?: number;
  onBranch?: (messageId: string, messageIndex: number) => void;
  /** Search highlight props (from Ctrl+F chat search) */
  isSearchMatch?: boolean;
  isCurrentMatch?: boolean;
  searchQuery?: string;
}

/**
 * SearchExcerpt — safely renders a context snippet with the matched term highlighted.
 * Pure React text splitting — no dangerouslySetInnerHTML (ASVS 5.3.3).
 */
function SearchExcerpt({
  content,
  query,
  isUser,
}: {
  content: string;
  query: string;
  isUser: boolean;
}) {
  const lc = content.toLowerCase();
  const lq = query.toLowerCase();
  const idx = lc.indexOf(lq);
  if (idx === -1) return null;

  const CONTEXT = 45;
  const start = Math.max(0, idx - CONTEXT);
  const end = Math.min(content.length, idx + query.length + CONTEXT);
  const before = content.slice(start, idx);
  const matchText = content.slice(idx, idx + query.length);
  const after = content.slice(idx + query.length, end);

  return (
    <div
      className={`mt-1.5 px-2.5 py-1.5 rounded-lg text-[11px] leading-relaxed select-text ${
        isUser
          ? "bg-zinc-200/60 border border-zinc-300/50 text-zinc-700"
          : "bg-violet-950/40 border border-violet-800/30 text-zinc-400"
      }`}
      aria-label="검색 일치 발췌"
    >
      {start > 0 && (
        <span className={isUser ? "text-zinc-400" : "text-zinc-600"}>…</span>
      )}
      <span>{before}</span>
      <mark
        className={`rounded px-0.5 not-italic font-medium ${
          isUser
            ? "bg-violet-200 text-violet-900"
            : "bg-violet-500/30 text-violet-200"
        }`}
      >
        {matchText}
      </mark>
      <span>{after}</span>
      {end < content.length && (
        <span className={isUser ? "text-zinc-400" : "text-zinc-600"}>…</span>
      )}
    </div>
  );
}

export default function MessageBubble({
  message,
  messageIndex = 0,
  exchangeRate = 1380,
  onBranch,
  isSearchMatch = false,
  isCurrentMatch = false,
  searchQuery = "",
}: Props) {
  const { t } = useTranslation();
  const { regenerateMessage, isStreaming } = useChatStore();
  const ttsRate = useSettingsStore((s) => s.ttsRate);
  const { speak, stop, isSpeaking, isSupported: ttsSupported } = useTts({ rate: ttsRate });
  const isUser = message.role === "user";
  const hasVersions = !isUser && message.versionCount > 1;

  const [viewingVersion, setViewingVersion] = useState<MessageVersion | null>(null);
  const [versions, setVersions] = useState<MessageVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  // Copy feedback state — shows a Check icon for 1.5s after clicking Copy.
  // Timer ref prevents memory leaks if the component unmounts mid-feedback.
  const [copied, setCopied] = useState(false);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  const displayContent = viewingVersion?.content ?? message.content;

  const formattedTime = new Date(message.createdAt).toLocaleTimeString("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  /**
   * Copy message content to clipboard with visual + toast feedback.
   *
   * Uses the modern Clipboard API (HTTPS/Tauri webview only; no legacy
   * document.execCommand fallback needed in this environment).
   *
   * Error handling: a failed write is rare (permission denied) but we still
   * surface it via the error toast so the user isn't left wondering why the
   * Check icon didn't appear.
   */
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayContent);
      setCopied(true);
      useToastStore.getState().addToast("success", "메시지가 클립보드에 복사되었습니다");
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      useToastStore.getState().addToast("error", "복사 실패 — 클립보드 권한을 확인하세요");
    }
  };

  const handleRegenerate = () => {
    if (isStreaming) return;
    regenerateMessage(message.id);
  };

  const handleTts = () => {
    if (isSpeaking) {
      stop();
    } else {
      // Strip markdown syntax before speaking for cleaner audio
      const plain = displayContent
        .replace(/```[\s\S]*?```/g, "code block")
        .replace(/`[^`]+`/g, "")
        .replace(/#{1,6}\s+/g, "")
        .replace(/\*\*([^*]+)\*\*/g, "$1")
        .replace(/\*([^*]+)\*/g, "$1")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .replace(/>\s+/g, "")
        .trim();
      speak(plain);
    }
  };

  const loadVersions = async () => {
    if (versions.length > 0) return versions;
    setLoadingVersions(true);
    try {
      const v = await getMessageVersions(message.id);
      setVersions(v);
      return v;
    } finally {
      setLoadingVersions(false);
    }
  };

  const navigateVersion = async (direction: "prev" | "next") => {
    const v = await loadVersions();
    if (!v.length) return;

    if (!viewingVersion) {
      if (direction === "prev" && v.length > 0) {
        setViewingVersion(v[v.length - 1]);
      }
    } else {
      const idx = v.findIndex((ver) => ver.id === viewingVersion.id);
      if (direction === "prev" && idx > 0) {
        setViewingVersion(v[idx - 1]);
      } else if (direction === "next") {
        if (idx < v.length - 1) {
          setViewingVersion(v[idx + 1]);
        } else {
          setViewingVersion(null);
        }
      }
    }
  };

  return (
    <div
      className={`flex ${isUser ? "justify-end" : "justify-start"} group/msg`}
      data-message-id={message.id}
    >
      {/* Timestamp — visible on hover, outside the bubble */}
      <span
        className={`self-end mb-1 text-[10px] text-zinc-600 opacity-0 group-hover/msg:opacity-100 transition-opacity duration-150 ${
          isUser ? "mr-2 order-first" : "ml-2 order-last"
        }`}
        aria-label={`Sent at ${formattedTime}`}
      >
        {formattedTime}
      </span>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 transition-shadow duration-200 ${
          isUser ? "bg-zinc-100 text-zinc-900" : "bg-zinc-800/50 text-zinc-100"
        } ${
          isCurrentMatch
            ? "ring-2 ring-violet-500/70 ring-offset-2 ring-offset-zinc-950"
            : isSearchMatch
            ? "ring-1 ring-violet-700/40"
            : ""
        }`}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{displayContent}</p>
        ) : (
          <MarkdownContent content={displayContent} />
        )}

        {/* Search excerpt — only shown when this bubble matches a search query */}
        {isSearchMatch && searchQuery.trim() && (
          <SearchExcerpt
            content={message.content}
            query={searchQuery}
            isUser={isUser}
          />
        )}

        {/* ── Assistant message footer ───────────────────────────────── */}
        {!isUser && (
          <div className="flex items-center gap-2 mt-2 pt-1.5 border-t border-zinc-700/50">
            {/* Cost info */}
            {message.costUsd != null && message.costUsd > 0 && (
              <>
                <span className="text-[10px] text-zinc-500">
                  {message.inputTokens ?? 0}+{message.outputTokens ?? 0}{" "}
                  {t("chat.tokens")}
                </span>
                <span className="text-[10px] text-zinc-500">
                  ${message.costUsd.toFixed(4)}
                </span>
                <span className="text-[10px] text-zinc-500">
                  ₩{Math.round(message.costUsd * exchangeRate).toLocaleString()}
                </span>
              </>
            )}

            <div className="ml-auto flex items-center gap-0.5">
              {/* Version navigation */}
              {hasVersions && (
                <div className="flex items-center gap-0.5 mr-1">
                  <button
                    onClick={() => navigateVersion("prev")}
                    disabled={loadingVersions}
                    className="p-0.5 rounded hover:bg-zinc-700/50 disabled:opacity-30"
                    aria-label="Previous version"
                  >
                    <ChevronLeft className="w-3 h-3 text-zinc-500" aria-hidden="true" />
                  </button>
                  <span className="text-[9px] text-zinc-600 min-w-[24px] text-center">
                    {viewingVersion
                      ? `${viewingVersion.versionNumber}/${message.versionCount}`
                      : `${message.versionCount}/${message.versionCount}`}
                  </span>
                  <button
                    onClick={() => navigateVersion("next")}
                    disabled={loadingVersions || !viewingVersion}
                    className="p-0.5 rounded hover:bg-zinc-700/50 disabled:opacity-30"
                    aria-label="Next version"
                  >
                    <ChevronRight className="w-3 h-3 text-zinc-500" aria-hidden="true" />
                  </button>
                </div>
              )}

              {/* TTS button — only if Web Speech API supported */}
              {ttsSupported && (
                <button
                  onClick={handleTts}
                  className={`p-0.5 rounded transition-colors ${
                    isSpeaking
                      ? "text-violet-400 hover:bg-zinc-700/50"
                      : "hover:bg-zinc-700/50"
                  }`}
                  title={isSpeaking ? "Stop reading" : "Read aloud"}
                  aria-label={isSpeaking ? "Stop reading" : "Read aloud"}
                >
                  {isSpeaking ? (
                    <VolumeX className="w-3 h-3 text-violet-400" aria-hidden="true" />
                  ) : (
                    <Volume2 className="w-3 h-3 text-zinc-500" aria-hidden="true" />
                  )}
                </button>
              )}

              {/* Regenerate button */}
              <button
                onClick={handleRegenerate}
                disabled={isStreaming}
                className="p-0.5 rounded hover:bg-zinc-700/50 disabled:opacity-30"
                aria-label="Regenerate response"
              >
                <RefreshCw className="w-3 h-3 text-zinc-500" aria-hidden="true" />
              </button>

              {/* Copy button with visual feedback */}
              <button
                onClick={handleCopy}
                className="p-0.5 rounded hover:bg-zinc-700/50 transition-colors
                           focus-visible:outline-none focus-visible:ring-2
                           focus-visible:ring-violet-500/50"
                aria-label={copied ? "메시지 복사 완료" : "Copy message"}
              >
                {copied ? (
                  <Check className="w-3 h-3 text-emerald-400" aria-hidden="true" />
                ) : (
                  <Copy className="w-3 h-3 text-zinc-500" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── User message footer ────────────────────────────────────── */}
        {isUser && (
          <div className="flex items-center justify-end gap-0.5 mt-1">
            {onBranch && (
              <button
                onClick={() => onBranch(message.id, messageIndex)}
                className="p-0.5 rounded hover:bg-zinc-200 opacity-0 group-hover/msg:opacity-100 transition-opacity"
                title="이 시점에서 대화 분기"
                aria-label="이 시점에서 대화 분기"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  className="w-3 h-3 text-zinc-400"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5"
                  />
                </svg>
              </button>
            )}
            <button
              onClick={handleCopy}
              className="p-0.5 rounded hover:bg-zinc-200 transition-colors
                         focus-visible:outline-none focus-visible:ring-2
                         focus-visible:ring-violet-500/50"
              aria-label={copied ? "메시지 복사 완료" : "Copy message"}
            >
              {copied ? (
                <Check className="w-3 h-3 text-emerald-600" aria-hidden="true" />
              ) : (
                <Copy className="w-3 h-3 text-zinc-400" aria-hidden="true" />
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
