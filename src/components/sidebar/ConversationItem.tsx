import { useState, useRef, useEffect } from 'react';
import type { Conversation } from '@/types';
import { useChatStore } from '@/stores/chatStore';

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
}

export default function ConversationItem({ conversation, isActive, onClick }: ConversationItemProps) {
  const { renameConversation, togglePinConversation, deleteConversation } = useChatStore();
  const [isRenaming, setIsRenaming] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const renameRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // 이름 변경 모드 진입 시 인풋에 포커스
  useEffect(() => {
    if (isRenaming) renameRef.current?.select();
  }, [isRenaming]);

  // 바깥 클릭 시 컨텍스트 메뉴 닫기
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  const handleRenameSubmit = async (value: string) => {
    const title = value.trim();
    if (title && title !== conversation.title) {
      await renameConversation(conversation.id, title).catch(console.error);
    }
    setIsRenaming(false);
  };

  const handleTogglePin = async () => {
    setShowMenu(false);
    await togglePinConversation(conversation.id).catch(console.error);
  };

  const handleDelete = async () => {
    setShowMenu(false);
    await deleteConversation(conversation.id).catch(console.error);
  };

  // 이름 변경 모드일 때 인풋 표시
  if (isRenaming) {
    return (
      <div className="px-1 py-0.5">
        <input
          ref={renameRef}
          defaultValue={conversation.title || '새 대화'}
          className="w-full bg-[hsl(var(--input))] border border-[hsl(var(--primary))] rounded px-2 py-1 text-sm outline-none"
          onBlur={(e) => handleRenameSubmit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleRenameSubmit(e.currentTarget.value);
            if (e.key === 'Escape') setIsRenaming(false);
          }}
        />
      </div>
    );
  }

  return (
    <div className="relative group">
      <button
        onClick={onClick}
        className={`w-full text-left px-3 py-2 rounded text-sm truncate transition-colors ${
          isActive
            ? 'bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]'
            : 'text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--accent-foreground))]'
        }`}
        title={conversation.title || '새 대화'}
      >
        <span className="flex items-center gap-1.5">
          {conversation.isPrivate ? <span title="비공개 대화">🔒</span> : null}
          {conversation.isPinned ? <span title="고정된 대화">📌</span> : null}
          <span className="truncate">{conversation.title || '새 대화'}</span>
        </span>
      </button>

      {/* 컨텍스트 메뉴 버튼 — hover 시 표시 */}
      <button
        onClick={(e) => { e.stopPropagation(); setShowMenu((v) => !v); }}
        className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] text-xs leading-none transition-opacity"
      >
        ⋯
      </button>

      {/* 드롭다운 메뉴 */}
      {showMenu ? (
        <div
          ref={menuRef}
          className="absolute right-0 top-full mt-0.5 w-40 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--popover))] shadow-lg z-50 py-1 overflow-hidden"
        >
          <MenuItem
            label="이름 변경"
            icon="✏️"
            onClick={() => { setShowMenu(false); setIsRenaming(true); }}
          />
          <MenuItem
            label={conversation.isPinned ? '핀 해제' : '핀 고정'}
            icon={conversation.isPinned ? '📌' : '📍'}
            onClick={handleTogglePin}
          />
          <div className="my-1 border-t border-[hsl(var(--border))]" />
          <MenuItem label="삭제" icon="🗑️" onClick={handleDelete} danger />
        </div>
      ) : null}
    </div>
  );
}

// ── 메뉴 아이템 (rerender-no-inline-components) ──
interface MenuItemProps {
  label: string;
  icon: string;
  onClick: () => void;
  danger?: boolean;
}

function MenuItem({ label, icon, onClick, danger = false }: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left flex items-center gap-2 px-3 py-1.5 text-sm transition-colors ${
        danger
          ? 'text-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive))]/10'
          : 'text-[hsl(var(--popover-foreground))] hover:bg-[hsl(var(--accent))]'
      }`}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}
