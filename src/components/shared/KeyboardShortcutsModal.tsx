import { useEffect, useRef } from "react";
import { X, Keyboard } from "lucide-react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useFocusReturn } from "@/hooks/useFocusReturn";

/**
 * KeyboardShortcutsModal — global help overlay listing all keyboard shortcuts.
 *
 * Trigger: `?` (outside inputs) or `Ctrl+/` anywhere.
 * Close: Escape, backdrop click, or X button.
 *
 * Security:
 *   - All shortcut labels and keys are static constants — no user input
 *   - No IPC calls, no external data, no XSS surface
 *   - role="dialog" + aria-modal="true" for proper focus trap semantics
 *
 * Accessibility (WCAG 2.1 AA):
 *   - aria-modal, aria-labelledby, role="dialog"
 *   - focus moves to close button on open
 *   - Escape key closes modal (highest priority)
 *   - Backdrop click dismissal (Apple HIG + Material Design)
 *   - All <kbd> elements use semantic HTML
 *   - Grouped with semantic <section> + <h3>
 */

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

interface Shortcut {
  keys: string[];
  label: string;
  description?: string;
}

interface ShortcutGroup {
  title: string;
  shortcuts: Shortcut[];
}

// ── Shortcut catalog ──────────────────────────────────────────────────────
// Static, no user input, no IPC — fully XSS-safe.
const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "글로벌 (어디서든)",
    shortcuts: [
      { keys: ["Alt", "Space"], label: "오버레이 열기", description: "어떤 앱에서든 AIFlow 소환" },
      { keys: ["Alt", "Shift", "A"], label: "클립보드 → AI", description: "클립보드 내용을 즉시 AI에 전송" },
      { keys: ["Alt", "Shift", "V"], label: "음성 녹음 시작", description: "Whisper STT로 변환" },
      { keys: ["Ctrl", "Shift", "S"], label: "스크린샷 → Vision AI", description: "화면 캡처 후 분석 요청" },
    ],
  },
  {
    title: "채팅",
    shortcuts: [
      { keys: ["Ctrl", "K"], label: "명령 팔레트", description: "모든 기능을 자연어로 검색" },
      { keys: ["Ctrl", "F"], label: "채팅 내 검색", description: "현재 대화에서 메시지 검색" },
      { keys: ["Enter"], label: "메시지 전송" },
      { keys: ["Shift", "Enter"], label: "줄바꿈" },
    ],
  },
  {
    title: "검색 바 (Ctrl+F 열린 상태)",
    shortcuts: [
      { keys: ["Enter"], label: "다음 결과로 이동" },
      { keys: ["Shift", "Enter"], label: "이전 결과로 이동" },
      { keys: ["Esc"], label: "검색 닫기" },
    ],
  },
  {
    title: "도움말",
    shortcuts: [
      { keys: ["?"], label: "이 화면 열기", description: "입력창 외부에서만 동작" },
      { keys: ["Ctrl", "/"], label: "이 화면 열기", description: "어디서든 동작" },
      { keys: ["Esc"], label: "모달 / 패널 닫기" },
    ],
  },
];

export default function KeyboardShortcutsModal({ isOpen, onClose }: Props) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(modalRef, isOpen);
  useFocusReturn(isOpen);

  // Focus management — move focus to close button on open
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => closeButtonRef.current?.focus());
    }
  }, [isOpen]);

  // Handle Escape + outside click. Capture:false so Ctrl+F search modal
  // and command palette's own Escape handlers can still run when this
  // modal isn't open.
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };

    const handleBackdropClick = (e: MouseEvent) => {
      // Click on backdrop (outside the modal box) closes the modal
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handleBackdropClick);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleBackdropClick);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="kbd-modal-title"
      className="fixed inset-0 z-[100] flex items-center justify-center px-4
                 bg-black/60 backdrop-blur-sm animate-search-bar-in"
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-2xl max-h-[85vh] overflow-hidden
                   rounded-2xl border border-zinc-800 bg-zinc-950/95 backdrop-blur-xl
                   shadow-[0_25px_60px_-15px_rgba(0,0,0,0.8)]"
      >
        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/80">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-violet-900/40 border border-violet-700/30
                            flex items-center justify-center">
              <Keyboard className="w-3.5 h-3.5 text-violet-300" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="kbd-modal-title"
                className="text-sm font-semibold text-zinc-100 leading-tight"
              >
                키보드 단축키
              </h2>
              <p className="text-[10px] text-zinc-500 leading-tight mt-0.5">
                사용성 향상을 위한 전체 단축키 목록
              </p>
            </div>
          </div>

          <button
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="단축키 도움말 닫기 (Esc)"
            className="w-7 h-7 flex items-center justify-center rounded-lg
                       text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800
                       transition-colors duration-150
                       focus-visible:outline-none focus-visible:ring-2
                       focus-visible:ring-violet-500/50"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>

        {/* ── Content (scrollable) ─────────────────────────────────── */}
        <div className="overflow-y-auto max-h-[calc(85vh-64px)]">
          <div className="px-5 py-4 space-y-5">
            {SHORTCUT_GROUPS.map((group) => (
              <section key={group.title} aria-labelledby={`kbd-group-${group.title}`}>
                <h3
                  id={`kbd-group-${group.title}`}
                  className="text-[10px] font-semibold uppercase tracking-wider
                             text-zinc-500 mb-2 px-1"
                >
                  {group.title}
                </h3>
                <div className="rounded-xl border border-zinc-800/80 overflow-hidden
                                divide-y divide-zinc-800/60">
                  {group.shortcuts.map((sc, idx) => (
                    <div
                      key={`${group.title}-${idx}`}
                      className="flex items-center justify-between gap-4 px-3.5 py-2.5
                                 hover:bg-zinc-900/50 transition-colors"
                    >
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-xs text-zinc-200 leading-tight font-medium">
                          {sc.label}
                        </span>
                        {sc.description && (
                          <span className="text-[10px] text-zinc-500 leading-tight mt-0.5 truncate">
                            {sc.description}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {sc.keys.map((key, keyIdx) => (
                          <span key={keyIdx} className="flex items-center gap-1">
                            {keyIdx > 0 && (
                              <span className="text-[9px] text-zinc-600" aria-hidden="true">
                                +
                              </span>
                            )}
                            <kbd
                              className="inline-flex items-center justify-center
                                         min-w-[22px] h-[22px] px-1.5
                                         rounded-md border border-zinc-700/80
                                         bg-zinc-900/80 text-[10px] font-mono font-medium
                                         text-zinc-300 shadow-[0_1px_0_0_rgba(0,0,0,0.5)]"
                            >
                              {key}
                            </kbd>
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}

            {/* Footer hint */}
            <div className="text-[10px] text-zinc-600 text-center pt-1 pb-1 select-none">
              Esc 또는 바깥 영역 클릭으로 닫기
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
