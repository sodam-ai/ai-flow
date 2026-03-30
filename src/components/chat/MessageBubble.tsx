import { useState } from "react";
import type { Message, MessageVersion } from "@/types";
import { useTranslation } from "react-i18next";
import { useChatStore } from "@/stores/chatStore";
import { getMessageVersions } from "@/lib/ipc/invoke";
import { Copy, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import MarkdownContent from "@/components/shared/MarkdownContent";

interface Props {
  message: Message;
  exchangeRate?: number;
}

export default function MessageBubble({ message, exchangeRate = 1380 }: Props) {
  const { t } = useTranslation();
  const { regenerateMessage, isStreaming } = useChatStore();
  const isUser = message.role === "user";
  const hasVersions = !isUser && message.versionCount > 1;

  const [viewingVersion, setViewingVersion] = useState<MessageVersion | null>(null);
  const [versions, setVersions] = useState<MessageVersion[]>([]);
  const [loadingVersions, setLoadingVersions] = useState(false);

  const handleCopy = () => {
    const content = viewingVersion?.content ?? message.content;
    navigator.clipboard.writeText(content);
  };

  const handleRegenerate = () => {
    if (isStreaming) return;
    regenerateMessage(message.id);
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
      // Currently viewing latest (active) — go to previous version
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
          setViewingVersion(null); // back to current/latest
        }
      }
    }
  };

  const displayContent = viewingVersion?.content ?? message.content;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
          isUser
            ? "bg-zinc-100 text-zinc-900"
            : "bg-zinc-800/50 text-zinc-100"
        }`}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap leading-relaxed">
            {displayContent}
          </p>
        ) : (
          <MarkdownContent content={displayContent} />
        )}

        {/* Assistant message footer: cost + actions */}
        {!isUser && (
          <div className="flex items-center gap-2 mt-2 pt-1.5 border-t border-zinc-700/50">
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
                  >
                    <ChevronRight className="w-3 h-3 text-zinc-500" />
                  </button>
                </div>
              )}

              {/* Regenerate button */}
              <button
                onClick={handleRegenerate}
                disabled={isStreaming}
                className="p-0.5 rounded hover:bg-zinc-700/50 disabled:opacity-30"
                title={t("chat.regenerate")}
              >
                <RefreshCw className="w-3 h-3 text-zinc-500" />
              </button>

              {/* Copy button */}
              <button
                onClick={handleCopy}
                className="p-0.5 rounded hover:bg-zinc-700/50"
                title={t("chat.copy")}
              >
                <Copy className="w-3 h-3 text-zinc-500" />
              </button>
            </div>
          </div>
        )}

        {/* User message copy */}
        {isUser && (
          <div className="flex justify-end mt-1">
            <button
              onClick={handleCopy}
              className="p-0.5 rounded hover:bg-zinc-200"
              title={t("chat.copy")}
            >
              <Copy className="w-3 h-3 text-zinc-400" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
