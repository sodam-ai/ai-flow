import { useState } from "react";
import type { Message, MessageVersion } from "@/types";
import { useTranslation } from "react-i18next";
import { useChatStore } from "@/stores/chatStore";
import { getMessageVersions } from "@/lib/ipc/invoke";
import { useTts } from "@/hooks/useTts";
import { useSettingsStore } from "@/stores/settingsStore";
import { Copy, RefreshCw, ChevronLeft, ChevronRight, Volume2, VolumeX } from "lucide-react";
import MarkdownContent from "@/components/shared/MarkdownContent";

interface Props {
  message: Message;
  messageIndex?: number;
  exchangeRate?: number;
  onBranch?: (messageId: string, messageIndex: number) => void;
}

export default function MessageBubble({
  message,
  messageIndex = 0,
  exchangeRate = 1380,
  onBranch,
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

  const displayContent = viewingVersion?.content ?? message.content;

  const handleCopy = () => {
    navigator.clipboard.writeText(displayContent);
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
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} group/msg`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
          isUser ? "bg-zinc-100 text-zinc-900" : "bg-zinc-800/50 text-zinc-100"
        }`}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{displayContent}</p>
        ) : (
          <MarkdownContent content={displayContent} />
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
                    <ChevronLeft className="w-3 h-3 text-zinc-500" />
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
                    <ChevronRight className="w-3 h-3 text-zinc-500" />
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
                    <VolumeX className="w-3 h-3 text-violet-400" />
                  ) : (
                    <Volume2 className="w-3 h-3 text-zinc-500" />
                  )}
                </button>
              )}

              {/* Regenerate button */}
              <button
                onClick={handleRegenerate}
                disabled={isStreaming}
                className="p-0.5 rounded hover:bg-zinc-700/50 disabled:opacity-30"
                title={t("chat.regenerate")}
                aria-label="Regenerate response"
              >
                <RefreshCw className="w-3 h-3 text-zinc-500" />
              </button>

              {/* Copy button */}
              <button
                onClick={handleCopy}
                className="p-0.5 rounded hover:bg-zinc-700/50"
                title={t("chat.copy")}
                aria-label="Copy message"
              >
                <Copy className="w-3 h-3 text-zinc-500" />
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
              className="p-0.5 rounded hover:bg-zinc-200"
              title={t("chat.copy")}
              aria-label="Copy message"
            >
              <Copy className="w-3 h-3 text-zinc-400" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
