/**
 * OverlayApp — Alt+Space 명령 팔레트 앱 진입점
 * 독립 웹뷰("overlay" 레이블)에서 실행되는 최소 React 앱
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useChatStore } from '@/stores/chatStore';
import { useSettingsStore } from '@/stores/settingsStore';
import {
  GLOBAL_COMMANDS,
  PROVIDER_DEFAULT_MODELS,
  conversationsToCommands,
  getConversationIdFromCommand,
  getProviderIdFromCommand,
  type PaletteCommand,
} from '@/lib/commands';
import { fuzzySearch, highlightMatches } from '@/lib/fuzzy';
import { getErrorMessage } from '@/lib/errors';

export default function OverlayApp() {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const { conversations, createConversation, setActiveConversation, loadConversations } =
    useChatStore();
  const { setActiveProvider } = useSettingsStore();

  // 오버레이 표시 시 데이터 로드
  useEffect(() => {
    loadConversations().catch(console.error);
  }, [loadConversations]);

  // aiflow://overlay-toggle 이벤트 수신 → 표시될 때 입력창 포커스
  useEffect(() => {
    const unlisten = listen<boolean>('aiflow://overlay-toggle', async (event) => {
      if (event.payload) {
        // 표시됨
        setQuery('');
        setSelectedIndex(0);
        setError(null);
        await loadConversations().catch(console.error);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    });
    // 초기 포커스 (창이 이미 보일 때)
    setTimeout(() => inputRef.current?.focus(), 100);
    return () => { unlisten.then((fn) => fn()); };
  }, [loadConversations]);

  // Escape → 오버레이 숨기기
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        await getCurrentWindow().hide();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 모든 커맨드 = 글로벌 + 대화 목록
  const allCommands: PaletteCommand[] = [
    ...GLOBAL_COMMANDS,
    ...conversationsToCommands(conversations),
  ];

  // 퍼지 검색 결과
  const results = fuzzySearch(allCommands, (cmd) => {
    const kw = cmd.keywords?.join(' ') ?? '';
    return `${cmd.label} ${kw}`;
  }, query);

  // 선택 인덱스 범위 클램프
  const clampedIndex = Math.min(selectedIndex, Math.max(results.length - 1, 0));

  const executeCommand = useCallback(async (command: PaletteCommand) => {
    try {
      setError(null);

      if (command.id === 'new-chat') {
        await createConversation('openai', 'gpt-4o');
        // 메인 창에 새 대화 알림
        await getCurrentWindow().hide();
        return;
      }

      if (command.id === 'settings') {
        // 메인 창 네비게이션은 Rust에서 emit으로 처리
        await getCurrentWindow().hide();
        return;
      }

      const conversationId = getConversationIdFromCommand(command.id);
      if (conversationId) {
        setActiveConversation(conversationId);
        await getCurrentWindow().hide();
        return;
      }

      const providerId = getProviderIdFromCommand(command.id);
      if (providerId) {
        setActiveProvider(providerId, PROVIDER_DEFAULT_MODELS[providerId]);
        await getCurrentWindow().hide();
        return;
      }
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }, [createConversation, setActiveConversation, setActiveProvider]);

  const handleKeyDown = useCallback(async (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const result = results[clampedIndex];
      if (result) await executeCommand(result.item);
    }
  }, [results, clampedIndex, executeCommand]);

  // 선택 항목 자동 스크롤
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const selected = list.children[clampedIndex] as HTMLElement | undefined;
    selected?.scrollIntoView({ block: 'nearest' });
  }, [clampedIndex]);

  // 쿼리 변경 시 선택 초기화
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const CATEGORY_LABELS: Record<string, string> = {
    action: '액션',
    conversation: '최근 대화',
    settings: '설정',
    provider: 'AI 모델',
  };

  // 카테고리 그룹핑
  let lastCategory = '';

  return (
    <div className="overlay-root flex flex-col h-screen bg-transparent">
      {/* 팔레트 컨테이너 */}
      <div className="palette-enter mx-auto mt-20 w-[640px] rounded-xl overflow-hidden shadow-2xl border border-white/10 bg-zinc-900/95 backdrop-blur-xl">
        {/* 검색 입력 */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
          <span className="text-lg shrink-0">🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="명령어 검색... (대화, AI 모델, 설정)"
            className="flex-1 bg-transparent text-white placeholder-zinc-500 text-sm outline-none"
            autoFocus
          />
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 text-xs font-mono shrink-0">
            ESC
          </kbd>
        </div>

        {/* 결과 목록 */}
        <div
          ref={listRef}
          className="overflow-y-auto max-h-[360px] py-2"
        >
          {results.length === 0 && (
            <p className="text-center text-zinc-500 text-sm py-8">
              결과 없음
            </p>
          )}

          {results.map((result, idx) => {
            const cmd = result.item;
            const isSelected = idx === clampedIndex;
            const showCategoryHeader = cmd.category !== lastCategory;
            if (showCategoryHeader) lastCategory = cmd.category;

            const labelSegments = highlightMatches(
              cmd.label,
              result.matches.filter((m) => m < cmd.label.length)
            );

            return (
              <div key={cmd.id}>
                {showCategoryHeader && (
                  <div className="px-4 pt-3 pb-1">
                    <span className="text-xs text-zinc-500 uppercase tracking-widest font-medium">
                      {CATEGORY_LABELS[cmd.category] ?? cmd.category}
                    </span>
                  </div>
                )}
                <button
                  onClick={() => executeCommand(cmd)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    isSelected
                      ? 'bg-blue-600/30 text-white'
                      : 'text-zinc-300 hover:bg-white/5'
                  }`}
                >
                  <span className="text-base shrink-0 w-6 text-center">{cmd.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">
                      {labelSegments.map((seg, i) => (
                        <span
                          key={i}
                          className={seg.highlight ? 'text-blue-300 font-semibold' : ''}
                        >
                          {seg.text}
                        </span>
                      ))}
                    </p>
                    {cmd.description && (
                      <p className="text-xs text-zinc-500 truncate">{cmd.description}</p>
                    )}
                  </div>
                  {isSelected && (
                    <kbd className="shrink-0 text-xs text-zinc-400 font-mono">↵</kbd>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* 에러 표시 */}
        {error && (
          <div className="px-4 py-2 border-t border-white/10 bg-red-950/40">
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        {/* 하단 힌트 */}
        <div className="px-4 py-2 border-t border-white/10 flex items-center gap-3 text-xs text-zinc-600">
          <span><kbd className="font-mono">↑↓</kbd> 이동</span>
          <span><kbd className="font-mono">↵</kbd> 선택</span>
          <span><kbd className="font-mono">ESC</kbd> 닫기</span>
          <span className="ml-auto">Alt+Space로 다시 열기</span>
        </div>
      </div>
    </div>
  );
}
