import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useChatStore } from "@/stores/chatStore";
import { useSettingsStore } from "@/stores/settingsStore";
import SettingsView from "@/views/SettingsView";
import ConversationItem from "@/components/sidebar/ConversationItem";
import MessageBubble from "@/components/chat/MessageBubble";
import StreamingBubble from "@/components/chat/StreamingBubble";
import ChatInput from "@/components/chat/ChatInput";
import ModelSelector from "@/components/chat/ModelSelector";
import ToastContainer from "@/components/shared/ToastContainer";

type AppView = "chat" | "settings";

export default function App() {
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

  useEffect(() => {
    loadPersistedSettings();
    loadConversations();
    loadAllKeyStatuses();
  }, [loadPersistedSettings, loadConversations, loadAllKeyStatuses]);

  const handleNewChat = async () => {
    await createChat(activeProviderId, activeModelId);
    setCurrentView("chat");
  };

  const conversationMessages = activeConversationId
    ? (messages[activeConversationId] ?? [])
    : [];

  // Auto-scroll to bottom on new messages or streaming
  const chatEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversationMessages.length, streamingContent]);

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-50">
      <ToastContainer />
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

        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {conversations.map((conv) => (
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

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {currentView === "settings" ? (
          <SettingsView />
        ) : activeConversationId ? (
          <>
            <ModelSelector />
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
