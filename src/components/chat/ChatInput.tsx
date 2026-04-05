import { useState, useRef, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Send, Square, BookOpen, Zap, Clipboard, CheckCheck,
  Camera, X, Loader2,
} from "lucide-react";
import FileDropZone from "./FileDropZone";
import RoutingBadge from "./RoutingBadge";
import VoiceRecordButton from "./VoiceRecordButton";
import PiiPreview from "@/components/privacy/PiiPreview";
import { usePromptStore } from "@/stores/promptStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useChatStore } from "@/stores/chatStore";
import { detectPii, type PiiMatch } from "@/lib/privacy/pii-detector";
import { logPiiDetection, readClipboardContent, captureScreen } from "@/lib/ipc/invoke";
import type { FileContent } from "@/types";

interface Props {
  isStreaming: boolean;
  onSubmit: (
    content: string,
    options?: { hasFile?: boolean; hasCode?: boolean; imageData?: string | null }
  ) => void;
  onCancel: () => void;
}

export default function ChatInput({ isStreaming, onSubmit, onCancel }: Props) {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<FileContent[]>([]);
  const [clipboardAdded, setClipboardAdded] = useState(false);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [screenshotLoading, setScreenshotLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const clipboardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { t } = useTranslation();
  const { setModalOpen } = usePromptStore();
  const routingMode = useSettingsStore((s) => s.routingMode);
  const setRoutingMode = useSettingsStore((s) => s.setRoutingMode);
  const privacyMode = useSettingsStore((s) => s.privacyMode);
  const voiceLang = useSettingsStore((s) => s.voiceLang);
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
    onSubmit(content, {
      hasFile: attachments.length > 0,
      imageData: pendingImage,
    });
    setInput("");
    setAttachments([]);
    setPendingImage(null);
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
    const hasContent = trimmed || attachments.length > 0 || pendingImage;
    if (!hasContent || isStreaming) return;

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
      const block = `[Clipboard context]\n${text.trim()}\n\n`;
      setInput((prev) => block + prev);
      setClipboardAdded(true);
      if (clipboardTimerRef.current) clearTimeout(clipboardTimerRef.current);
      clipboardTimerRef.current = setTimeout(() => setClipboardAdded(false), 2000);
      textareaRef.current?.focus();
    } catch {
      // Silently ignore — clipboard may be empty or access denied
    }
  }, []);

  /** Capture screen and attach as Vision AI image */
  const handleScreenshot = useCallback(async () => {
    if (screenshotLoading || isStreaming) return;
    setScreenshotLoading(true);
    try {
      const base64 = await captureScreen();
      setPendingImage(base64);
      textareaRef.current?.focus();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Minimal error display — SCREEN_ prefix errors surfaced briefly
      console.warn("Screenshot failed:", msg);
    } finally {
      setScreenshotLoading(false);
    }
  }, [screenshotLoading, isStreaming]);

  /** Global keyboard shortcut (Ctrl+Shift+S) → take screenshot */
  useEffect(() => {
    const handler = () => { handleScreenshot(); };
    window.addEventListener("aiflow:screenshot", handler);
    return () => window.removeEventListener("aiflow:screenshot", handler);
  }, [handleScreenshot]);

  const canSend = (input.trim() || attachments.length > 0 || !!pendingImage) && !isStreaming;

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

          {/* Screenshot preview */}
          {pendingImage && (
            <div className="max-w-3xl mx-auto mb-2">
              <div className="relative inline-block">
                <img
                  src={`data:image/png;base64,${pendingImage}`}
                  alt="Screenshot preview"
                  className="h-20 w-auto rounded-lg border border-zinc-700 object-cover shadow-md"
                />
                <button
                  onClick={() => setPendingImage(null)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-zinc-800 border border-zinc-600 flex items-center justify-center hover:bg-zinc-700 transition-colors"
                  title="Remove screenshot"
                  aria-label="Remove screenshot"
                >
                  <X className="w-3 h-3 text-zinc-300" />
                </button>
                <span className="absolute bottom-1 left-1.5 text-[9px] text-zinc-300 bg-zinc-900/80 px-1 rounded leading-4">
                  Vision
                </span>
              </div>
            </div>
          )}

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
              language={voiceLang}
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
              title="Inject clipboard as context (Alt+Shift+A)"
              aria-label="Inject clipboard content as context"
            >
              {clipboardAdded ? (
                <CheckCheck className="w-4 h-4" />
              ) : (
                <Clipboard className="w-4 h-4" />
              )}
            </button>

            {/* Screenshot button */}
            <button
              onClick={handleScreenshot}
              disabled={isStreaming || screenshotLoading}
              className={`p-2.5 rounded-xl transition-colors flex-shrink-0 ${
                pendingImage
                  ? "text-violet-400 bg-violet-950/30"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed"
              }`}
              title="Capture screen for Vision AI (Ctrl+Shift+S)"
              aria-label="Capture screenshot for Vision AI"
            >
              {screenshotLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Camera className="w-4 h-4" />
              )}
            </button>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onInput={handleInput}
              placeholder={
                pendingImage
                  ? t("chat.placeholder_vision") || "Describe what you want to know about this screenshot…"
                  : t("chat.placeholder")
              }
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
                disabled={!canSend}
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
