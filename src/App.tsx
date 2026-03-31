import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { listen } from "@tauri-apps/api/event";
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
import OverlayChat from "@/components/overlay/OverlayChat";
import type { StreamTarget } from "@/types";

type AppView = "chat" | "settings" | "compare";

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

    return () => {
      unsubNewChat.then((fn) => fn());
      unsubSettings.then((fn) => fn());
      unsubClipboard.then((fn) => fn());
    };
  }, [activeConversationId, activeProviderId, activeModelId, createChat, sendMessage]);

  const [sidebarSearch, setSidebarSearch] = useState("");
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [compareTargets, setCompareTargets] = useState<StreamTarget[] | null>(null);

  const handleNewChat = async () => {
    await createChat(activeProviderId, activeModelId);
    setCurrentView("chat");
  };

  // Filter conversations by search query
  const filteredConversations = useMemo(() => {
    if (!sidebarSearch.trim()) return conversations;
    const q = sidebarSearch.toLowerCase();
    return conversations.filter((c) => c.title.toLowerCase().includes(q));
  }, [conversations, sidebarSearch]);

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

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-50">
      <ToastContainer />
      <CommandPalette />
      <PromptLibraryModal onUsePrompt={handleUsePrompt} />
      {/* Sidebar */}
      <aside className="w-60 border-r border-zinc-800 flex flex-col">
        <div
          className="p-4 border-b border-zinc-800 flex items-center justify-between"
          data-tauri-drag-region
        >
          <span className="font-semibold text-sm select-none">
            {t("app.name")}
          </span>
          <button
            onClick={handleNewChat}
            className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 transition-colors"
          >
            + {t("app.newChat")}
          </button>
        </div>

        {/* Search */}
        {conversations.length > 3 && (
          <div className="px-2 py-1.5">
            <input
              value={sidebarSearch}
              onChange={(e) => setSidebarSearch(e.target.value)}
              placeholder={t("prompt.search")}
              className="w-full px-2 py-1 text-xs bg-zinc-900 border border-zinc-800 rounded focus:border-zinc-600 focus:outline-none placeholder-zinc-600"
            />
          </div>
        )}

        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {filteredConversations.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              isActive={
                currentView === "chat" && activeConversationId === conv.id
              }
              onClick={() => {
                setActive(conv.id);
                setCurrentView("chat");
              }}
              onPin={() => pin(conv.id)}
              onDelete={() => remove(conv.id)}
            />
          ))}
          {conversations.length === 0 && (
            <p className="text-xs text-zinc-500 text-center py-8">
              {t("app.noConversations")}
            </p>
          )}
        </nav>

        <div className="p-2 border-t border-zinc-800">
          <button
            onClick={() => setCurrentView("settings")}
            className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
              currentView === "settings"
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-400 hover:bg-zinc-800/50"
            }`}
          >
            {t("app.settings")}
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

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {currentView === "settings" ? (
          <SettingsView />
        ) : currentView === "compare" && compareTargets ? (
          <MultiStreamView
            targets={compareTargets}
            onClose={() => {
              setCurrentView("chat");
              setCompareTargets(null);
            }}
          />
        ) : activeConversationId ? (
          <>
            <div className="flex items-center justify-between border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <ModelSelector />
                <button
                  onClick={() => setShowModelPicker(true)}
                  className="text-[10px] px-2 py-1 rounded border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors"
                  title="Compare 2~3 AI models side-by-side"
                >
                  Compare
                </button>
              </div>
              <div className="flex items-center gap-2 pr-3">
                <PrivacyToggle />
                <PersonaSelector />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {conversationMessages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              {isStreaming && <StreamingBubble content={streamingContent} />}
              <div ref={chatEndRef} />
            </div>
            <ChatInput
              isStreaming={isStreaming}
              onSubmit={(content) => sendMessage(content)}
              onCancel={cancelCurrentStream}
            />
          </>
        ) : (
          <WelcomeView onNewChat={handleNewChat} />
        )}
      </main>
    </div>
  );
}

function WelcomeView({ onNewChat }: { onNewChat: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-bold">{t("app.name")}</h1>
      <p className="text-zinc-400 text-sm">{t("app.welcome")}</p>
      <p className="text-xs text-zinc-500">
        <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 font-mono text-zinc-300">
          Alt+Space
        </kbd>{" "}
        {t("app.hotkeyHint")}
      </p>
      <button
        onClick={onNewChat}
        className="px-4 py-2 rounded bg-zinc-100 text-zinc-900 hover:bg-zinc-200 text-sm font-medium transition-colors"
      >
        {t("app.startChat")}
      </button>
    </div>
  );
}
