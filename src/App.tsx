import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";
import { Download, FileText, FileCode, ChevronDown } from "lucide-react";
import { useChatStore } from "@/stores/chatStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { usePersonaStore } from "@/stores/personaStore";
import { usePromptStore } from "@/stores/promptStore";
import { useCommandPaletteStore, type PaletteCommand } from "@/stores/commandPaletteStore";
import { useGlobalKeyboard } from "@/hooks/useGlobalKeyboard";
import SettingsView from "@/views/SettingsView";
import ConversationItem from "@/components/sidebar/ConversationItem";
import MessageBubble from "@/components/chat/MessageBubble";
import StreamingBubble from "@/components/chat/StreamingBubble";
import ChatInput from "@/components/chat/ChatInput";
import ModelSelector from "@/components/chat/ModelSelector";
import PersonaSelector from "@/components/chat/PersonaSelector";
import ModelPicker from "@/components/chat/ModelPicker";
import MultiStreamView from "@/components/chat/MultiStreamView";
import PrivacyToggle from "@/components/privacy/PrivacyToggle";
import CommandPalette from "@/components/palette/CommandPalette";
import PromptLibraryModal from "@/components/prompts/PromptLibraryModal";
import ToastContainer from "@/components/shared/ToastContainer";
import KeyboardShortcutsModal from "@/components/shared/KeyboardShortcutsModal";
import OverlayChat from "@/components/overlay/OverlayChat";
import KbContextBar from "@/components/chat/KbContextBar";
import ChatSearchBar from "@/components/chat/ChatSearchBar";
import BranchPanel from "@/components/chat/BranchPanel";
import BranchDialog from "@/components/chat/BranchDialog";
import {
  exportConversation,
  createConversationBranch,
  getConversationKbIds,
  saveConversationKbIds,
} from "@/lib/ipc/invoke";
import CostReportView from "@/views/CostReportView";
import MCPMarketView from "@/views/MCPMarketView";
import WorkflowBuilderView from "@/views/WorkflowBuilderView";
import BatchQueueView from "@/views/BatchQueueView";
import ProUpgradeView from "@/views/ProUpgradeView";
import KnowledgeBaseView from "@/views/KnowledgeBaseView";
import AgentView from "@/views/AgentView";
import PrivacyAuditView from "@/views/PrivacyAuditView";
import UpdateBanner from "@/components/updater/UpdateBanner";
import type { StreamTarget } from "@/types";

type AppView = "chat" | "settings" | "compare" | "costs" | "mcp" | "workflow" | "batch" | "pro" | "kb" | "agent" | "privacy";

export default function App() {
  // Overlay route: if opened as /overlay, render minimal chat only
  if (window.location.pathname === "/overlay") {
    return <OverlayChat />;
  }

  return <MainApp />;
}

function MainApp() {
  const [currentView, setCurrentView] = useState<AppView>("chat");
  const { t } = useTranslation();

  const {
    conversations,
    activeConversationId,
    messages,
    streamingContent,
    isStreaming,
    loadConversations,
    createChat,
    setActive,
    pin,
    remove,
    rename,
    sendMessage,
    cancelCurrentStream,
  } = useChatStore();

  const { activeProviderId, activeModelId, loadAllKeyStatuses, loadPersistedSettings } =
    useSettingsStore();

  const { fetchPersonas, personas } = usePersonaStore();
  const { setModalOpen: setPromptModalOpen } = usePromptStore();
  const { registerCommands } = useCommandPaletteStore();

  // Global keyboard shortcuts (Ctrl+K, Escape)
  useGlobalKeyboard();

  useEffect(() => {
    loadPersistedSettings();
    loadConversations();
    loadAllKeyStatuses();
    fetchPersonas();
  }, [loadPersistedSettings, loadConversations, loadAllKeyStatuses, fetchPersonas]);

  // Register command palette commands
  const registerPaletteCommands = useCallback(() => {
    const cmds: PaletteCommand[] = [
      {
        id: "new-chat",
        label: "New Chat",
        labelKo: "새 대화",
        keywords: ["chat", "conversation", "대화"],
        icon: "plus",
        category: "chat",
        action: () => handleNewChat(),
      },
      {
        id: "settings",
        label: "Settings",
        labelKo: "설정",
        keywords: ["config", "preferences", "설정"],
        icon: "settings",
        category: "settings",
        action: () => setCurrentView("settings"),
      },
      {
        id: "prompt-library",
        label: "Prompt Library",
        labelKo: "프롬프트 저장소",
        keywords: ["template", "prompt", "프롬프트"],
        icon: "book-open",
        category: "prompt",
        action: () => setPromptModalOpen(true),
      },
      {
        id: "keyboard-shortcuts",
        label: "Keyboard Shortcuts",
        labelKo: "키보드 단축키",
        keywords: ["keyboard", "shortcuts", "help", "단축키", "키보드", "도움말", "?"],
        icon: "keyboard",
        category: "settings",
        action: () => setShowKbdHelp(true),
      },
      {
        id: "cost-report",
        label: "Cost Report",
        labelKo: "비용 리포트",
        keywords: ["cost", "budget", "money", "비용", "예산", "리포트"],
        icon: "dollar-sign",
        category: "settings",
        action: () => setCurrentView("costs"),
      },
      {
        id: "compare-ai",
        label: "Compare AI Models",
        labelKo: "AI 모델 비교",
        keywords: ["compare", "multi", "side-by-side", "비교", "멀티"],
        icon: "columns",
        category: "chat",
        action: () => setShowModelPicker(true),
      },
      // Add persona switch commands dynamically
      ...personas.map((p) => ({
        id: `persona-${p.id}`,
        label: `Switch to ${p.name}`,
        labelKo: `${p.name} 페르소나`,
        keywords: [p.name.toLowerCase(), p.slug, "persona", "페르소나"],
        icon: p.icon,
        category: "persona" as const,
        action: () => usePersonaStore.getState().setActivePersona(p.id),
      })),
      {
        id: "persona-none",
        label: "Clear Persona",
        labelKo: "페르소나 해제",
        keywords: ["none", "clear", "해제"],
        icon: "x",
        category: "persona",
        action: () => usePersonaStore.getState().setActivePersona(null),
      },
    ];
    registerCommands(cmds);
  }, [personas, registerCommands, setPromptModalOpen]);

  useEffect(() => {
    registerPaletteCommands();
  }, [registerPaletteCommands]);

  // Listen for tray events
  useEffect(() => {
    const unsubNewChat = listen("aiflow://tray-new-chat", () => {
      handleNewChat();
    });
    const unsubSettings = listen("aiflow://tray-settings", () => {
      setCurrentView("settings");
    });
    const unsubClipboard = listen("aiflow://clipboard-to-ai", async () => {
      // Read clipboard and send as message
      try {
        const { readClipboardContent } = await import("@/lib/ipc/invoke");
        const content = await readClipboardContent();
        if (content) {
          if (!activeConversationId) {
            await createChat(activeProviderId, activeModelId);
          }
          sendMessage(content);
        }
      } catch {
        // Clipboard might be empty — silently ignore
      }
    });
    const unsubVoice = listen("aiflow://voice-start", () => {
      // Bridge Tauri IPC event → DOM CustomEvent for VoiceRecordButton
      window.dispatchEvent(new CustomEvent("aiflow:voice-start"));
    });
    const unsubScreenshot = listen("aiflow://screenshot-to-ai", () => {
      // Bridge Tauri IPC event → DOM CustomEvent for ChatInput
      window.dispatchEvent(new CustomEvent("aiflow:screenshot"));
    });

    return () => {
      unsubNewChat.then((fn) => fn());
      unsubSettings.then((fn) => fn());
      unsubClipboard.then((fn) => fn());
      unsubVoice.then((fn) => fn());
      unsubScreenshot.then((fn) => fn());
    };
  }, [activeConversationId, activeProviderId, activeModelId, createChat, sendMessage]);

  const [sidebarSearch, setSidebarSearch] = useState("");
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [compareTargets, setCompareTargets] = useState<StreamTarget[] | null>(null);

  const handleNewChat = async () => {
    await createChat(activeProviderId, activeModelId);
    setCurrentView("chat");
  };

  // ── Keyboard shortcuts help modal (? / Ctrl+/) ──────────────────────────
  const [showKbdHelp, setShowKbdHelp] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore if the user is typing in an input/textarea/contenteditable
      const target = e.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      const isTyping =
        tagName === "input" ||
        tagName === "textarea" ||
        target?.isContentEditable === true;

      // `?` key (Shift+/) — only when NOT typing
      if (e.key === "?" && !isTyping) {
        e.preventDefault();
        setShowKbdHelp((p) => !p);
        return;
      }
      // Ctrl+/ — works everywhere, including in inputs
      if ((e.ctrlKey || e.metaKey) && e.key === "/") {
        e.preventDefault();
        setShowKbdHelp((p) => !p);
        return;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── Conversation export menu (click-toggle, accessible) ────────────────
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Close export menu on outside click (mousedown for earlier dismissal)
  useEffect(() => {
    if (!showExportMenu) return;
    const handler = (e: MouseEvent) => {
      if (
        exportMenuRef.current &&
        !exportMenuRef.current.contains(e.target as Node)
      ) {
        setShowExportMenu(false);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [showExportMenu]);

  // Close on Escape (only when menu is open)
  useEffect(() => {
    if (!showExportMenu) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.stopPropagation(); setShowExportMenu(false); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showExportMenu]);

  const handleExportConversation = async (format: "markdown" | "json") => {
    setShowExportMenu(false);
    if (!activeConversationId) return;
    try {
      const content = await exportConversation(activeConversationId, format);
      const ext = format === "json" ? "json" : "md";
      const title = (activeConv?.title.replace(/[^\w가-힣]/g, "_") ?? "conversation").slice(0, 100);
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      const { useToastStore } = await import("@/stores/toastStore");
      useToastStore.getState().addToast(
        "success",
        `대화를 ${format === "json" ? "JSON" : "Markdown"}으로 내보냈습니다`,
      );
    } catch (e) {
      const { useToastStore } = await import("@/stores/toastStore");
      useToastStore.getState().addToast("error", String(e));
    }
  };

  // Filter conversations by search query
  const filteredConversations = useMemo(() => {
    if (!sidebarSearch.trim()) return conversations;
    const q = sidebarSearch.toLowerCase();
    return conversations.filter((c) => c.title.toLowerCase().includes(q));
  }, [conversations, sidebarSearch]);

  // Group filtered conversations: Pinned → 오늘 → 어제 → 이번 주 → 이전
  const groupedConversations = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfYesterday = startOfToday - 86_400_000;
    const startOfWeek = startOfToday - 6 * 86_400_000;

    const pinned: typeof filteredConversations = [];
    const today: typeof filteredConversations = [];
    const yesterday: typeof filteredConversations = [];
    const thisWeek: typeof filteredConversations = [];
    const older: typeof filteredConversations = [];

    for (const c of filteredConversations) {
      if (c.isPinned) { pinned.push(c); continue; }
      const t = new Date(c.updatedAt).getTime();
      if (t >= startOfToday) today.push(c);
      else if (t >= startOfYesterday) yesterday.push(c);
      else if (t >= startOfWeek) thisWeek.push(c);
      else older.push(c);
    }

    return [
      { label: "고정됨", items: pinned },
      { label: "오늘", items: today },
      { label: "어제", items: yesterday },
      { label: "이번 주", items: thisWeek },
      { label: "이전", items: older },
    ].filter((g) => g.items.length > 0);
  }, [filteredConversations]);

  const conversationMessages = activeConversationId
    ? (messages[activeConversationId] ?? [])
    : [];

  // Auto-scroll to bottom on new messages or streaming
  const chatEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversationMessages.length, streamingContent]);

  // Handle prompt use: insert into chat input
  const handleUsePrompt = (content: string) => {
    if (activeConversationId) {
      sendMessage(content);
    }
  };

  const [activeKbIds, setActiveKbIds] = useState<number[]>([]);

  // ── Per-conversation KB persistence (Phase 10) ───────────────────────────
  // Track which conversation the current activeKbIds belong to, so a
  // race between loader and toggle cannot save IDs to the wrong conversation.
  const activeKbConvIdRef = useRef<string | null>(null);

  // Load persisted KB IDs whenever the active conversation changes.
  // The AbortController prevents stale writes if the user switches fast.
  useEffect(() => {
    if (!activeConversationId) {
      setActiveKbIds([]);
      activeKbConvIdRef.current = null;
      return;
    }
    let cancelled = false;
    const targetConvId = activeConversationId;
    (async () => {
      try {
        const ids = await getConversationKbIds(targetConvId);
        if (!cancelled) {
          setActiveKbIds(ids);
          activeKbConvIdRef.current = targetConvId;
        }
      } catch {
        if (!cancelled) {
          setActiveKbIds([]);
          activeKbConvIdRef.current = targetConvId;
        }
      }
    })();
    return () => { cancelled = true; };
  }, [activeConversationId]);

  /**
   * Persist KB IDs — silently swallows errors to avoid disrupting the UI for
   * what is a non-critical convenience feature. If the save fails the UI
   * state is still correct; it just won't survive a restart.
   * The convId check prevents writes to a stale conversation (race on switch).
   */
  const persistKbIds = useCallback((convId: string | null, ids: number[]) => {
    if (!convId) return;
    if (activeKbConvIdRef.current !== convId) return;
    saveConversationKbIds(convId, ids).catch((err) => {
      // Log but don't surface — KB context persistence is best-effort
      console.warn("Failed to persist KB IDs:", err);
    });
  }, []);

  // Toggle a KB in the active context set (with persistence)
  const toggleKb = useCallback(
    (id: number) => {
      setActiveKbIds((prev) => {
        const next = prev.includes(id) ? prev.filter((k) => k !== id) : [...prev, id];
        persistKbIds(activeConversationId, next);
        return next;
      });
    },
    [activeConversationId, persistKbIds],
  );

  // Atomically clear all active KBs — avoids stale-closure issues with forEach(toggle)
  const clearKbs = useCallback(() => {
    setActiveKbIds([]);
    persistKbIds(activeConversationId, []);
  }, [activeConversationId, persistKbIds]);

  // ── Chat search (Ctrl+F) ─────────────────────────────────────────────────
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchCurrentIdx, setSearchCurrentIdx] = useState(0);

  // Ref for stale-closure-safe access inside keyboard event listener
  const isSearchOpenRef = useRef(false);
  useEffect(() => { isSearchOpenRef.current = isSearchOpen; }, [isSearchOpen]);

  // Reset search when active conversation changes
  useEffect(() => {
    setIsSearchOpen(false);
    setSearchQuery("");
    setSearchCurrentIdx(0);
  }, [activeConversationId]);

  // Reset result index when query changes
  useEffect(() => { setSearchCurrentIdx(0); }, [searchQuery]);

  // Client-side filtering — no IPC call, no injection risk
  // ASVS 5.1.1: empty/whitespace query returns no matches
  const searchMatches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return conversationMessages
      .map((msg, idx) => ({ msg, idx }))
      .filter(({ msg }) => msg.content.toLowerCase().includes(q));
  }, [conversationMessages, searchQuery]);

  // Scroll current match into view
  useEffect(() => {
    if (!isSearchOpen || searchMatches.length === 0) return;
    const match = searchMatches[searchCurrentIdx];
    if (!match) return;
    // CSS.escape prevents any edge-case injection via message IDs (defensive)
    const el = document.querySelector(
      `[data-message-id="${CSS.escape(match.msg.id)}"]`
    );
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [searchCurrentIdx, isSearchOpen, searchMatches]);

  const searchPrev = useCallback(() => {
    setSearchCurrentIdx((i) =>
      searchMatches.length === 0 ? 0 : (i - 1 + searchMatches.length) % searchMatches.length
    );
  }, [searchMatches.length]);

  const searchNext = useCallback(() => {
    setSearchCurrentIdx((i) =>
      searchMatches.length === 0 ? 0 : (i + 1) % searchMatches.length
    );
  }, [searchMatches.length]);

  const closeSearch = useCallback(() => {
    setIsSearchOpen(false);
    setSearchQuery("");
    setSearchCurrentIdx(0);
  }, []);

  // Ctrl+F keyboard handler — capture phase so e.preventDefault() reliably
  // blocks the browser/Tauri native find dialog before any other listener fires
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "f" && !e.shiftKey && !e.altKey) {
        if (!activeConversationId) return;
        e.preventDefault();
        e.stopPropagation();
        setIsSearchOpen((prev) => {
          if (!prev) {
            setSearchQuery("");
            setSearchCurrentIdx(0);
          }
          return !prev;
        });
        return;
      }
      // Escape: close search with priority over other modal handlers
      if (e.key === "Escape" && isSearchOpenRef.current) {
        e.stopPropagation();
        setIsSearchOpen(false);
        setSearchQuery("");
        setSearchCurrentIdx(0);
      }
    };
    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, [activeConversationId]);

  const activeConv = conversations.find((c) => c.id === activeConversationId);

  // ── Conversation Branching ───────────────────────────────────────────────
  const [showBranchPanel, setShowBranchPanel] = useState(false);
  const [branchDialogState, setBranchDialogState] = useState<{
    messageId: string;
    messageIndex: number;
  } | null>(null);

  // Called from MessageBubble fork button
  const handleBranchRequest = useCallback((messageId: string, messageIndex: number) => {
    setBranchDialogState({ messageId, messageIndex });
  }, []);

  const handleBranchConfirm = useCallback(async (label: string) => {
    if (!branchDialogState || !activeConversationId) return;
    setBranchDialogState(null);
    try {
      const branch = await createConversationBranch({
        parent_conversation_id: activeConversationId,
        fork_message_id: branchDialogState.messageId,
        fork_message_index: branchDialogState.messageIndex,
        label: label || undefined,
      });
      // Reload conversations so branch appears in sidebar
      const { loadConversations: reload } = useChatStore.getState();
      await reload();
      const { useToastStore } = await import("@/stores/toastStore");
      useToastStore.getState().addToast("success", `브랜치 생성됨 — ${label || `#${branch.id}`}`);
    } catch (e) {
      const { useToastStore } = await import("@/stores/toastStore");
      useToastStore.getState().addToast("error", String(e));
    }
  }, [branchDialogState, activeConversationId]);

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-zinc-50 font-sans antialiased">
      <ToastContainer />
      <CommandPalette />
      <PromptLibraryModal onUsePrompt={handleUsePrompt} />
      <KeyboardShortcutsModal
        isOpen={showKbdHelp}
        onClose={() => setShowKbdHelp(false)}
      />
      <UpdateBanner />

      {/* ── Body: sidebar + main (flex-1 so UpdateBanner doesn't shrink them) */}
      <div className="flex flex-1 overflow-hidden">

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside className="w-56 border-r border-zinc-800/80 flex flex-col bg-zinc-950 shrink-0">
        {/* Logo / Brand */}
        <div
          className="h-12 px-4 border-b border-zinc-800/80 flex items-center justify-between select-none"
          data-tauri-drag-region
        >
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-violet-600 flex items-center justify-center" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="white" className="w-3.5 h-3.5">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z"/>
              </svg>
            </div>
            <span className="font-semibold text-sm tracking-tight text-zinc-100">
              {t("app.name")}
            </span>
          </div>
          <button
            onClick={handleNewChat}
            className="w-6 h-6 rounded-md flex items-center justify-center text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            aria-label={t("app.newChat")}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3.5 h-3.5" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
          </button>
        </div>

        {/* Conversation search */}
        {conversations.length > 3 && (
          <div className="px-3 pt-3 pb-1">
            <div className="relative">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                value={sidebarSearch}
                onChange={(e) => setSidebarSearch(e.target.value)}
                placeholder="대화 검색..."
                aria-label="대화 목록 검색"
                maxLength={200}
                className="w-full pl-7 pr-2.5 py-1.5 text-xs bg-zinc-900 border border-zinc-800 rounded-lg focus:border-zinc-600 focus:outline-none placeholder-zinc-600 text-zinc-300"
              />
            </div>
          </div>
        )}

        {/* Conversation list — date-grouped */}
        <nav aria-label="대화 목록" className="flex-1 overflow-y-auto px-2 py-2 min-h-0">
          {filteredConversations.length === 0 && conversations.length === 0 && (
            <div className="px-2 py-8 text-center">
              <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center mx-auto mb-2">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4 text-zinc-500" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                </svg>
              </div>
              <p className="text-xs text-zinc-600">아직 대화가 없습니다</p>
              <button
                onClick={handleNewChat}
                className="mt-2 text-xs text-violet-500 hover:text-violet-400 transition-colors"
              >
                첫 대화 시작하기 →
              </button>
            </div>
          )}
          {filteredConversations.length === 0 && conversations.length > 0 && (
            <p role="status" aria-live="polite" className="px-3 py-4 text-xs text-zinc-600 text-center">검색 결과 없음</p>
          )}
          {groupedConversations.map((group) => (
            <div key={group.label} className="mb-2">
              <p className="px-2 mb-1 mt-1 text-[10px] font-medium text-zinc-600 uppercase tracking-wider">
                {group.label}
              </p>
              <div className="space-y-px">
                {group.items.map((conv) => (
                  <ConversationItem
                    key={conv.id}
                    conversation={conv}
                    isActive={currentView === "chat" && activeConversationId === conv.id}
                    onClick={() => { setActive(conv.id); setCurrentView("chat"); }}
                    onPin={() => pin(conv.id)}
                    onDelete={() => remove(conv.id)}
                    onRename={(title) => rename(conv.id, title)}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Tools section */}
        <div className="border-t border-zinc-800/80 px-2 pt-2 pb-1">
          <p className="px-2 mb-1 text-[10px] font-medium text-zinc-600 uppercase tracking-wider">
            도구
          </p>
          {(
            [
              { view: "kb",       label: "지식베이스",  badge: null, icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375" /></svg> },
              { view: "agent",    label: "AI 에이전트", badge: "NEW", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1 1 .03 2.798-1.414 2.798H4.212c-1.444 0-2.414-1.798-1.414-2.798L4.2 15.3" /></svg> },
              { view: "workflow", label: "워크플로우",  badge: null, icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" /></svg> },
              { view: "batch",    label: "배치 처리",  badge: null, icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 6.878V6a2.25 2.25 0 012.25-2.25h7.5A2.25 2.25 0 0118 6v.878m-12 0c.235-.083.487-.128.75-.128h10.5c.263 0 .515.045.75.128m-12 0A2.25 2.25 0 004.5 9v.878m13.5-3A2.25 2.25 0 0119.5 9v.878m0 0a2.246 2.246 0 00-.75-.128H5.25c-.263 0-.515.045-.75.128m15 0A2.25 2.25 0 0121 12v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6c0-.98.626-1.813 1.5-2.122" /></svg> },
              { view: "mcp",      label: "MCP 마켓",   badge: null, icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.39 48.39 0 01-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 01-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 00-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 01-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 00.657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 01-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.4.604-.4.959v0c0 .333.277.599.61.58a48.1 48.1 0 005.427-.63 48.05 48.05 0 00.582-4.717.532.532 0 00-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.96.401v0a.656.656 0 00.658-.663 48.422 48.422 0 00-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 01-.61-.58v0z" /></svg> },
            ] as const
          ).map(({ view, label, badge, icon }) => (
            <button
              key={view}
              onClick={() => setCurrentView(view)}
              aria-current={currentView === view ? "page" : undefined}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                currentView === view
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300"
              }`}
            >
              <span className={currentView === view ? "text-violet-400" : ""} aria-hidden="true">{icon}</span>
              <span>{label}</span>
              {badge && (
                <span className="ml-auto text-[9px] font-semibold px-1.5 py-0.5 rounded bg-violet-900/60 text-violet-300">
                  {badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Bottom: Costs + Pro + Settings */}
        <div className="border-t border-zinc-800/80 px-2 py-2 space-y-px">
          {(
            [
              { view: "costs",   label: "비용 리포트",   icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75" /></svg> },
              { view: "privacy", label: "개인정보 & 감사", icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg> },
              { view: "pro",     label: "Pro 플랜",      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.745 3.745 0 0121 12z" /></svg> },
            ] as const
          ).map(({ view, label, icon }) => (
            <button
              key={view}
              onClick={() => setCurrentView(view)}
              aria-current={currentView === view ? "page" : undefined}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                currentView === view
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300"
              }`}
            >
              <span aria-hidden="true">{icon}</span>
              <span>{label}</span>
            </button>
          ))}
          <button
            onClick={() => setCurrentView("settings")}
            aria-current={currentView === "settings" ? "page" : undefined}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              currentView === "settings"
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-500 hover:bg-zinc-800/60 hover:text-zinc-300"
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="w-3.5 h-3.5" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>{t("app.settings")}</span>
          </button>
        </div>
      </aside>

      {/* Model Picker Modal */}
      {showModelPicker && (
        <ModelPicker
          onConfirm={(targets) => {
            setCompareTargets(targets);
            setShowModelPicker(false);
            setCurrentView("compare");
          }}
          onCancel={() => setShowModelPicker(false)}
        />
      )}

      {/* ── Main content ────────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">
        {currentView === "settings" ? (
          <SettingsView />
        ) : currentView === "costs" ? (
          <CostReportView />
        ) : currentView === "mcp" ? (
          <MCPMarketView />
        ) : currentView === "workflow" ? (
          <WorkflowBuilderView />
        ) : currentView === "batch" ? (
          <BatchQueueView />
        ) : currentView === "pro" ? (
          <ProUpgradeView />
        ) : currentView === "kb" ? (
          <KnowledgeBaseView />
        ) : currentView === "agent" ? (
          <AgentView />
        ) : currentView === "privacy" ? (
          <PrivacyAuditView />
        ) : currentView === "compare" && compareTargets ? (
          <MultiStreamView
            targets={compareTargets}
            onClose={() => { setCurrentView("chat"); setCompareTargets(null); }}
          />
        ) : activeConversationId ? (
          <>
            {/* Chat header */}
            <div className="h-12 px-4 border-b border-zinc-800/80 flex items-center justify-between shrink-0 bg-zinc-950/80 backdrop-blur-sm">
              <div className="flex items-center gap-3 min-w-0">
                <ModelSelector />
                <div className="w-px h-4 bg-zinc-800" />
                <button
                  onClick={() => setShowModelPicker(true)}
                  className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-zinc-800 text-zinc-500 hover:text-zinc-200 hover:border-zinc-700 hover:bg-zinc-800/50 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"
                  aria-label="AI 모델 비교 열기"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125z" />
                  </svg>
                  비교
                </button>
              </div>
              <div className="flex items-center gap-2">
                {activeConv && (
                  <span className="text-xs text-zinc-500 truncate max-w-[160px] hidden sm:block">
                    {activeConv.title}
                  </span>
                )}
                {/* Export menu — click-toggle with outside-click dismissal */}
                <div className="relative" ref={exportMenuRef}>
                  <button
                    onClick={() => setShowExportMenu((p) => !p)}
                    className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border transition-all
                                focus-visible:outline-none focus-visible:ring-2
                                focus-visible:ring-violet-500/50 focus-visible:ring-offset-1
                                focus-visible:ring-offset-zinc-950 ${
                                  showExportMenu
                                    ? "border-violet-600/60 bg-violet-900/30 text-violet-300"
                                    : "border-zinc-800 text-zinc-500 hover:text-zinc-200 hover:border-zinc-700 hover:bg-zinc-800/50"
                                }`}
                    aria-label="대화 내보내기 메뉴 열기"
                    aria-haspopup="menu"
                    aria-expanded={showExportMenu}
                  >
                    <Download className="w-3 h-3" aria-hidden="true" />
                    <span>저장</span>
                    <ChevronDown
                      className={`w-2.5 h-2.5 transition-transform duration-150 ${
                        showExportMenu ? "rotate-180" : ""
                      }`}
                      aria-hidden="true"
                    />
                  </button>

                  {showExportMenu && (
                    <div
                      role="menu"
                      aria-label="내보내기 형식"
                      className="absolute right-0 top-full mt-1.5 w-44 rounded-lg
                                 border border-zinc-700 bg-zinc-900/95 backdrop-blur-sm
                                 shadow-2xl z-50 overflow-hidden animate-search-bar-in"
                    >
                      <button
                        role="menuitem"
                        onClick={() => handleExportConversation("markdown")}
                        className="w-full px-3 py-2.5 text-xs text-zinc-200 hover:bg-zinc-800/80
                                   text-left flex items-center gap-2.5 transition-colors
                                   focus-visible:outline-none focus-visible:bg-zinc-800"
                      >
                        <FileText
                          className="w-3.5 h-3.5 text-sky-400 shrink-0"
                          aria-hidden="true"
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium leading-tight">Markdown</span>
                          <span className="text-[10px] text-zinc-500 leading-tight">
                            읽기 편한 형식 (.md)
                          </span>
                        </div>
                      </button>
                      <div className="h-px bg-zinc-800" aria-hidden="true" />
                      <button
                        role="menuitem"
                        onClick={() => handleExportConversation("json")}
                        className="w-full px-3 py-2.5 text-xs text-zinc-200 hover:bg-zinc-800/80
                                   text-left flex items-center gap-2.5 transition-colors
                                   focus-visible:outline-none focus-visible:bg-zinc-800"
                      >
                        <FileCode
                          className="w-3.5 h-3.5 text-amber-400 shrink-0"
                          aria-hidden="true"
                        />
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium leading-tight">JSON</span>
                          <span className="text-[10px] text-zinc-500 leading-tight">
                            구조화된 데이터 (.json)
                          </span>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
                {/* Branch panel toggle */}
                <button
                  onClick={() => setShowBranchPanel((p) => !p)}
                  className={`flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 ${
                    showBranchPanel
                      ? "border-violet-600/60 bg-violet-900/30 text-violet-300"
                      : "border-zinc-800 text-zinc-500 hover:text-zinc-200 hover:border-zinc-700 hover:bg-zinc-800/50"
                  }`}
                  aria-label="대화 브랜치 패널 열기"
                  aria-pressed={showBranchPanel}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
                  </svg>
                  브랜치
                </button>
                <PrivacyToggle />
                <PersonaSelector />
                {/* Keyboard shortcuts help button */}
                <button
                  onClick={() => setShowKbdHelp(true)}
                  className="w-6 h-6 flex items-center justify-center rounded-md
                             border border-zinc-800 text-zinc-500 hover:text-zinc-200
                             hover:border-zinc-700 hover:bg-zinc-800/50 transition-all
                             focus-visible:outline-none focus-visible:ring-2
                             focus-visible:ring-violet-500/50"
                  aria-label="키보드 단축키 도움말 열기"
                >
                  <span className="text-[11px] font-semibold font-mono leading-none">?</span>
                </button>
              </div>
            </div>

            {/* Chat search bar (Ctrl+F) */}
            {isSearchOpen && (
              <ChatSearchBar
                query={searchQuery}
                onQueryChange={setSearchQuery}
                resultCount={searchMatches.length}
                currentIndex={searchCurrentIdx}
                onPrev={searchPrev}
                onNext={searchNext}
                onClose={closeSearch}
              />
            )}

            {/* Messages */}
            <div
              id="chat-messages"
              className="flex-1 overflow-y-auto px-4 py-4 space-y-3"
            >
              {conversationMessages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full gap-3 text-center pb-16">
                  <div className="w-10 h-10 rounded-xl bg-zinc-800/80 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5 text-zinc-400" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
                    </svg>
                  </div>
                  <p className="text-sm text-zinc-500">무엇이든 물어보세요</p>
                  <p className="text-xs text-zinc-600">
                    <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 font-mono text-zinc-400">Ctrl+K</kbd>
                    {" "}명령 팔레트 ·{" "}
                    <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 font-mono text-zinc-400">⊞</kbd>
                    {" "}파일 드롭
                  </p>
                </div>
              )}
              {conversationMessages.map((msg, idx) => {
                const matchIdx = isSearchOpen && searchQuery.trim()
                  ? searchMatches.findIndex((m) => m.msg.id === msg.id)
                  : -1;
                const isMatch = matchIdx !== -1;
                const isCurrent = isMatch && matchIdx === searchCurrentIdx;
                return (
                  <MessageBubble
                    key={msg.id}
                    message={msg}
                    messageIndex={idx}
                    modelLabel={activeConv?.modelId}
                    onBranch={handleBranchRequest}
                    isSearchMatch={isMatch}
                    isCurrentMatch={isCurrent}
                    searchQuery={isMatch ? searchQuery : ""}
                  />
                );
              })}
              {isStreaming && (
                <StreamingBubble
                  content={streamingContent}
                  modelLabel={activeConv?.modelId}
                />
              )}
              <div ref={chatEndRef} />
            </div>

            {/* KB context chips (Smart Context Injection UI) */}
            <KbContextBar activeKbIds={activeKbIds} onToggle={toggleKb} onClearAll={clearKbs} />

            <ChatInput
              isStreaming={isStreaming}
              onSubmit={(content, opts) => sendMessage(content, { ...opts, kbIds: activeKbIds.length > 0 ? activeKbIds : undefined })}
              onCancel={cancelCurrentStream}
            />

            {/* Branch panel (slide-in from right) */}
            <BranchPanel
              conversationId={activeConversationId}
              isOpen={showBranchPanel}
              onClose={() => setShowBranchPanel(false)}
              onNavigate={(branchConvId) => {
                setActive(branchConvId);
                setCurrentView("chat");
              }}
            />

            {/* Branch creation dialog */}
            {branchDialogState && (
              <BranchDialog
                messageIndex={branchDialogState.messageIndex}
                onConfirm={handleBranchConfirm}
                onCancel={() => setBranchDialogState(null)}
              />
            )}
          </>
        ) : (
          <WelcomeView onNewChat={handleNewChat} />
        )}
      </main>
      </div>{/* end body flex */}
    </div>
  );
}

function WelcomeView({ onNewChat }: { onNewChat: () => void }) {
  const { t } = useTranslation();

  const FEATURES = [
    { icon: "🤖", title: "멀티 AI 허브", desc: "GPT-4o · Claude · Gemini 동시 비교" },
    { icon: "🎤", title: "음성 입력", desc: "Whisper STT · 자동 침묵 감지" },
    { icon: "📷", title: "스크린샷 Vision", desc: "화면 캡처 → AI 분석" },
    { icon: "📚", title: "지식베이스 RAG", desc: "내 문서 기반 AI 답변" },
    { icon: "🔒", title: "완전 로컬 보안", desc: "API 키 OS 키체인 · DB AES-256" },
    { icon: "⚡", title: "AI 에이전트", desc: "멀티스텝 자율 작업 + 승인 게이트" },
  ];

  const SHORTCUTS = [
    { keys: ["Alt", "Space"], label: "오버레이" },
    { keys: ["Alt", "Shift", "A"], label: "클립보드 → AI" },
    { keys: ["Alt", "Shift", "V"], label: "음성 입력" },
    { keys: ["Ctrl", "Shift", "S"], label: "스크린샷" },
    { keys: ["Ctrl", "K"], label: "명령 팔레트" },
  ];

  const SUGGESTIONS = [
    "GPT-4o, Claude, Gemini를 동시에 비교해줘",
    "내 화면을 캡처해서 코드 리뷰해줘",
    "문서를 업로드해서 핵심 내용 요약해줘",
    "웹에서 최신 AI 뉴스를 검색해줘",
  ];

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-7 px-8 pb-10 overflow-y-auto">
      {/* Logo + headline */}
      <div className="flex flex-col items-center gap-4 mt-8">
        <div
          className="w-16 h-16 rounded-2xl bg-violet-600/20 border border-violet-600/30 flex items-center justify-center shadow-lg shadow-violet-900/20"
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-8 h-8 text-violet-400" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
          </svg>
        </div>
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight">
            {t("app.name")}
          </h1>
          <p className="text-sm text-zinc-400 mt-2 max-w-sm leading-relaxed">
            {t("app.welcome")}
          </p>
        </div>
        <button
          onClick={onNewChat}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 active:scale-95 text-white text-sm font-medium transition-all shadow-lg shadow-violet-900/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          {t("app.startChat")}
        </button>
      </div>

      {/* Suggested prompts */}
      <div className="w-full max-w-lg">
        <p className="text-[10px] font-medium text-zinc-600 uppercase tracking-wider mb-2.5 text-center">
          시작 제안
        </p>
        <div className="grid grid-cols-2 gap-1.5">
          {SUGGESTIONS.map((text) => (
            <button
              key={text}
              onClick={onNewChat}
              className="text-left px-3 py-2.5 rounded-lg bg-zinc-900/70 border border-zinc-800/80 text-[11px] text-zinc-400 hover:text-zinc-200 hover:border-zinc-700 hover:bg-zinc-800/60 transition-all leading-snug focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500/60 group"
              aria-label={`"${text}" 로 새 대화 시작`}
            >
              <span className="line-clamp-2 group-hover:text-zinc-200 transition-colors">{text}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-2 gap-2 w-full max-w-lg" role="list" aria-label="주요 기능">
        {FEATURES.map(({ icon, title, desc }) => (
          <div
            key={title}
            role="listitem"
            className="flex items-start gap-3 px-3.5 py-3 rounded-xl bg-zinc-900/60 border border-zinc-800/60"
          >
            <span className="text-base leading-none mt-0.5 shrink-0" aria-hidden="true">{icon}</span>
            <div className="min-w-0">
              <p className="text-xs font-medium text-zinc-300 leading-tight">{title}</p>
              <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Keyboard shortcuts */}
      <div className="w-full max-w-lg">
        <p className="text-[10px] font-medium text-zinc-600 uppercase tracking-wider mb-2.5 text-center">
          단축키
        </p>
        <dl className="flex flex-wrap justify-center gap-x-5 gap-y-1.5">
          {SHORTCUTS.map(({ keys, label }) => (
            <div key={label} className="flex items-center gap-1">
              <dt className="flex items-center gap-1">
                {keys.map((k, i) => (
                  <span key={k} className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700/80 font-mono text-zinc-400 text-[10px] leading-4">
                      {k}
                    </kbd>
                    {i < keys.length - 1 && <span className="text-zinc-700 text-[10px]" aria-hidden="true">+</span>}
                  </span>
                ))}
              </dt>
              <dd className="text-[11px] text-zinc-600 ml-0.5">— {label}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
