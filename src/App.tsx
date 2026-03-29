import { useEffect, useState } from 'react';
import { listen } from '@tauri-apps/api/event';
import { useChatStore } from '@/stores/chatStore';
import { useSettingsStore } from '@/stores/settingsStore';
import { getErrorMessage } from '@/lib/errors';
import SettingsView from '@/views/SettingsView';
import ConversationItem from '@/components/sidebar/ConversationItem';
import MessageBubble from '@/components/chat/MessageBubble';
import StreamingBubble from '@/components/chat/StreamingBubble';
import ChatInput from '@/components/chat/ChatInput';

type AppView = 'chat' | 'settings';

export default function App() {
  const [currentView, setCurrentView] = useState<AppView>('chat');

  const {
    conversations,
    activeConversationId,
    messages,
    streamingContent,
    isStreaming,
    loadConversations,
    createConversation,
    setActiveConversation,
    sendMessage,
    cancelCurrentStream,
  } = useChatStore();

  const { activeProviderId, activeModelId, loadApiKeyStatuses } = useSettingsStore();

  useEffect(() => {
    loadConversations().catch(console.error);
    loadApiKeyStatuses().catch(console.error);
  }, [loadConversations, loadApiKeyStatuses]);

  // 트레이 "설정" 메뉴 클릭 → 설정 화면 이동
  useEffect(() => {
    const unlisten = listen<string>('aiflow://navigate', (event) => {
      if (event.payload === '/settings') setCurrentView('settings');
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  const handleNewChat = async () => {
    try {
      await createConversation(activeProviderId, activeModelId);
      setCurrentView('chat');
    } catch (error) {
      console.error(getErrorMessage(error));
    }
  };

  const handleSendMessage = (content: string) => {
    sendMessage(content).catch(console.error);
  };

  const conversationMessages = activeConversationId
    ? (messages[activeConversationId] ?? [])
    : [];

  return (
    <div className="flex h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      {/* 사이드바 */}
      <aside className="w-64 border-r border-[hsl(var(--border))] flex flex-col">
        {/* 헤더 — 드래그 영역 */}
        <div
          className="p-4 border-b border-[hsl(var(--border))] flex items-center justify-between"
          data-tauri-drag-region
        >
          <span className="font-semibold text-sm select-none">AIFlow</span>
          <button
            onClick={handleNewChat}
            className="text-xs px-2 py-1 rounded bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90"
          >
            + 새 대화
          </button>
        </div>

        {/* 대화 목록 */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              isActive={currentView === 'chat' && activeConversationId === conv.id}
              onClick={() => {
                setActiveConversation(conv.id);
                setCurrentView('chat');
              }}
            />
          ))}
          {conversations.length === 0 && (
            <p className="text-xs text-[hsl(var(--muted-foreground))] text-center py-8">
              새 대화를 시작하세요
            </p>
          )}
        </nav>

        {/* 하단 설정 버튼 */}
        <div className="p-2 border-t border-[hsl(var(--border))]">
          <button
            onClick={() => setCurrentView('settings')}
            className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
              currentView === 'settings'
                ? 'bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]'
                : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))]'
            }`}
          >
            ⚙️ 설정
          </button>
        </div>
      </aside>

      {/* 메인 콘텐츠 */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {currentView === 'settings' ? (
          <SettingsView />
        ) : activeConversationId ? (
          <>
            {/* 메시지 목록 */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {conversationMessages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              {isStreaming && (
                <StreamingBubble content={streamingContent} />
              )}
            </div>

            {/* 입력창 */}
            <ChatInput
              isStreaming={isStreaming}
              onSubmit={handleSendMessage}
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
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-bold">AIFlow</h1>
      <p className="text-[hsl(var(--muted-foreground))] text-sm">
        여러 AI를 하나의 앱에서 사용하세요
      </p>
      <p className="text-xs text-[hsl(var(--muted-foreground))]">
        <kbd className="px-1.5 py-0.5 rounded bg-[hsl(var(--muted))] font-mono">Alt+Space</kbd>
        {' '}로 명령 팔레트 열기
      </p>
      <button
        onClick={onNewChat}
        className="px-4 py-2 rounded bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 text-sm font-medium"
      >
        새 대화 시작
      </button>
    </div>
  );
}
