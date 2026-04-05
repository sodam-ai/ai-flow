import { useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Send, Square, BookOpen, Zap, Clipboard, CheckCheck } from "lucide-react";
import FileDropZone from "./FileDropZone";
import RoutingBadge from "./RoutingBadge";
import VoiceRecordButton from "./VoiceRecordButton";
import PiiPreview from "@/components/privacy/PiiPreview";
import { usePromptStore } from "@/stores/promptStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useChatStore } from "@/stores/chatStore";
import { detectPii, type PiiMatch } from "@/lib/privacy/pii-detector";
import { logPiiDetection, readClipboardContent } from "@/lib/ipc/invoke";
import type { FileContent } from "@/types";

interface Props {
  isStreaming: boolean;
  onSubmit: (content: string, options?: { hasFile?: boolean; hasCode?: boolean }) => void;
  onCancel: () => void;
}

export default function ChatInput({ isStreaming, onSubmit, onCancel }: Props) {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<FileContent[]>([]);
  const [clipboardAdded, setClipboardAdded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const clipboardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { t } = useTranslation();
  const { setModalOpen } = usePromptStore();
  const routingMode = useSettingsStore((s) => s.routingMode);
  const setRoutingMode = useSettingsStore((s) => s.setRoutingMode);
  const privacyMode = useSettingsStore((s) => s.privacyMode);
  const lastRoutingInfo = useChatStore((s) => s.lastRoutingInfo);
  const activeConversationId = useChatStore((s) => s.activeConversationId);

  // PII preview state
  const [piiMatches, setPiiMatches] = useState<PiiMatch[]>([]);
  const [pendingContent, setPendingContent] = useState<string>("");
  const [showPiiPreview, setShowPiiPreview] = useState(false);

  const handleAttachmentsChange = useCallback((files: FileContent[]) => {
    setAttachments(files);
  }, []);

  const buildFullContent = () => {
    const trimmed = input.trim();
    let fullContent = "";
    for (const file of attachments) {
      if (file.content_type === "text") {
        fullContent += `[File: ${file.info.name}]\n\`\`\`\n${file.content}\n\`\`\`\n\n`;
      } else {
        fullContent += `[Image: ${file.info.name} (${(file.info.size / 1024).toFixed(0)}KB)]\n\n`;
      }
    }
    fullContent += trimmed;
    return fullContent;
  };

  const doSend = (content: string, wasMasked: boolean) => {
    onSubmit(content, { hasFile: attachments.length > 0 });
    setInput("");
    setAttachments([]);
    setShowPiiPreview(false);
    setPiiMatches([]);
    setPendingContent("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    // Log PII detection to backend (fire-and-forget)
    if (piiMatches.length > 0 && activeConversationId) {
      const typeGroups: Record<string, number> = {};
      for (const m of piiMatches) {
        typeGroups[m.type] = (typeGroups[m.type] ?? 0) + 1;
      }
      for (const [piiType, count] of Object.entries(typeGroups)) {
        logPiiDetection(activeConversationId, null, piiType, count, wasMasked).catch(() => {});
      }
    }
  };

  const handleSubmit = () => {
    const trimmed = input.trim();
    if ((!trimmed && attachments.length === 0) || isStreaming) return;

    const fullContent = buildFullContent();

    // Privacy mode: scan for PII before sending
    if (privacyMode) {
      const matches = detectPii(fullContent);
      if (matches.length > 0) {
        setPiiMatches(matches);
        setPendingContent(fullContent);
        setShowPiiPreview(true);
        return;
      }
    }

    doSend(fullContent, false);
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

  /** Insert voice transcript at end of current input */
  const handleVoiceTranscript = useCallback((text: string) => {
    setInput((prev) => {
      const trimmed = prev.trimEnd();
      return trimmed ? `${trimmed} ${text}` : text;
    });
    // Auto-resize textarea after insertion
    setTimeout(() => {
      const el = textareaRef.current;
      if (el) {
        el.style.height = "auto";
        el.style.height = Math.min(el.scrollHeight, 200) + "px";
        el.focus();
      }
    }, 0);
  }, []);

  /** Inject clipboard content as a context block at the start of input */
  const handleClipboardInject = useCallback(async () => {
    try {
      const text = await readClipboardContent();
      if (!text?.trim()) return;

      // Wrap as a labelled context block, prepend to input
      const block = `[Clipboard context]\n${text.trim()}\n\n`;
      setInput((prev) => block + prev);

      // Brief ✓ feedback
      setClipboardAdded(true);
      if (clipboardTimerRef.current) clearTimeout(clipboardTimerRef.current);
      clipboardTimerRef.current = setTimeout(() => setClipboardAdded(false), 2000);

      textareaRef.current?.focus();
    } catch {
      // Silently ignore — clipboard may be empty or access denied
    }
  }, []);

  return (
    <>
      {showPiiPreview && (
        <PiiPreview
          originalText={pendingContent}
          matches={piiMatches}
          onSendMasked={(masked) => doSend(masked, true)}
          onSendOriginal={() => doSend(pendingContent, false)}
          onCancel={() => {
            setShowPiiPreview(false);
            setPiiMatches([]);
          }}
        />
      )}
      <FileDropZone attachments={attachments} onAttachmentsChange={handleAttachmentsChange}>
        <div className="border-t border-zinc-800 p-3">
          {/* Routing info bar */}
          <div className="flex items-center gap-2 max-w-3xl mx-auto mb-1.5 min-h-[20px]">
            <button
              onClick={() => setRoutingMode(!routingMode)}
              className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] rounded border transition-colors ${
                routingMode
                  ? "text-amber-400 bg-amber-950/40 border-amber-800/50"
                  : "text-zinc-500 bg-zinc-900 border-zinc-800 hover:border-zinc-700"
              }`}
              title={
                routingMode
                  ? "Smart Routing: ON — AI auto-selected by complexity"
                  : "Smart Routing: OFF"
              }
            >
              <Zap className="w-2.5 h-2.5" />
              {routingMode ? "Auto" : "Manual"}
            </button>
            {routingMode && input.length >= 5 && (
              <RoutingBadge prompt={input} hasFile={attachments.length > 0} />
            )}
            {lastRoutingInfo && lastRoutingInfo.potentialSavings > 0.0001 && (
              <span className="text-[10px] text-green-400">
                Saved ${lastRoutingInfo.potentialSavings.toFixed(4)} via routing
              </span>
            )}
          </div>

          {/* Input row */}
          <div className="flex items-end gap-1.5 max-w-3xl mx-auto">
            {/* Prompt library */}
            <button
              onClick={() => setModalOpen(true)}
              className="p-2.5 rounded-xl text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors flex-shrink-0"
              title={t("prompt.title")}
              aria-label="Open prompt library"
            >
              <BookOpen className="w-4 h-4" />
            </button>

            {/* Voice input */}
            <VoiceRecordButton
              onTranscript={handleVoiceTranscript}
              disabled={isStreaming}
            />

            {/* Clipboard inject */}
            <button
              onClick={handleClipboardInject}
              disabled={isStreaming}
              className={`p-2.5 rounded-xl transition-colors flex-shrink-0 ${
                clipboardAdded
                  ? "text-green-400 bg-green-950/30"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed"
              }`}
              title="Inject clipboard as context"
              aria-label="Inject clipboard content as context"
            >
              {clipboardAdded ? (
                <CheckCheck className="w-4 h-4" />
              ) : (
                <Clipboard className="w-4 h-4" />
              )}
            </button>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onInput={handleInput}
              placeholder={t("chat.placeholder")}
              rows={1}
              className="flex-1 resize-none bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:border-zinc-500 focus:outline-none transition-colors min-w-0"
              disabled={isStreaming}
            />

            {/* Send / Stop */}
            {isStreaming ? (
              <button
                onClick={onCancel}
                className="p-2.5 rounded-xl bg-red-900/50 text-red-400 hover:bg-red-900/80 transition-colors flex-shrink-0"
                title={t("chat.stop")}
                aria-label="Stop generation"
              >
                <Square className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={!input.trim() && attachments.length === 0}
                className="p-2.5 rounded-xl bg-zinc-100 text-zinc-900 hover:bg-zinc-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex-shrink-0"
                title={t("chat.send")}
                aria-label="Send message"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </FileDropZone>
    </>
  );
}
