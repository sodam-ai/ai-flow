import { useEffect, useRef, useState } from 'react';
import { usePersonaStore } from '@/stores/personaStore';
import type { Persona } from '@/types';

interface PersonaSelectorProps {
  /** 선택된 페르소나 변경 시 호출 — system_prompt를 채팅에 적용하기 위해 */
  onSelect?: (persona: Persona) => void;
}

export default function PersonaSelector({ onSelect }: PersonaSelectorProps) {
  const { personas, activePersonaId, loadPersonas, setActivePersona } = usePersonaStore();
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadPersonas().catch(console.error);
  }, [loadPersonas]);

  // 바깥 클릭 시 드롭다운 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const activePersona = personas.find((p) => p.id === activePersonaId);

  const handleSelect = (persona: Persona) => {
    setActivePersona(persona.id);
    onSelect?.(persona);
    setOpen(false);
  };

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2 py-1 rounded text-xs hover:bg-[hsl(var(--accent))] transition-colors"
        title="페르소나 선택"
      >
        <span>{activePersona?.avatarEmoji ?? '🤖'}</span>
        <span className="max-w-[80px] truncate text-[hsl(var(--muted-foreground))]">
          {activePersona?.name ?? 'Assistant'}
        </span>
        <span className="text-[hsl(var(--muted-foreground))] opacity-60">▾</span>
      </button>

      {open ? (
        <div className="absolute bottom-full left-0 mb-1 w-56 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--popover))] shadow-lg z-50 overflow-hidden">
          <div className="p-1.5 space-y-0.5">
            {personas.map((persona) => (
              <PersonaOption
                key={persona.id}
                persona={persona}
                isActive={persona.id === activePersonaId}
                onSelect={handleSelect}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── 별도 컴포넌트로 분리 (rerender-no-inline-components) ──
interface PersonaOptionProps {
  persona: Persona;
  isActive: boolean;
  onSelect: (persona: Persona) => void;
}

function PersonaOption({ persona, isActive, onSelect }: PersonaOptionProps) {
  return (
    <button
      onClick={() => onSelect(persona)}
      className={`w-full text-left flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
        isActive
          ? 'bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]'
          : 'hover:bg-[hsl(var(--accent))] text-[hsl(var(--popover-foreground))]'
      }`}
    >
      <span className="text-base leading-none">{persona.avatarEmoji}</span>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{persona.name}</div>
        <div className="text-xs text-[hsl(var(--muted-foreground))] truncate">
          {persona.systemPrompt.slice(0, 40)}…
        </div>
      </div>
      {isActive ? <span className="text-[hsl(var(--primary))] text-xs">✓</span> : null}
    </button>
  );
}
