import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useCommandPaletteStore } from "@/stores/commandPaletteStore";
import { Search } from "lucide-react";

export default function CommandPalette() {
  const { t } = useTranslation();
  const {
    isOpen,
    query,
    selectedIndex,
    close,
    setQuery,
    moveUp,
    moveDown,
    executeSelected,
    getFilteredCommands,
  } = useCommandPaletteStore();

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selected = listRef.current.children[selectedIndex] as HTMLElement;
    selected?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!isOpen) return null;

  const filtered = getFilteredCommands();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        moveUp();
        break;
      case "ArrowDown":
        e.preventDefault();
        moveDown();
        break;
      case "Enter":
        e.preventDefault();
        executeSelected();
        break;
      case "Escape":
        e.preventDefault();
        close();
        break;
    }
  };

  const categoryColors: Record<string, string> = {
    chat: "text-emerald-400",
    persona: "text-indigo-400",
    prompt: "text-amber-400",
    navigation: "text-blue-400",
    settings: "text-zinc-400",
  };

  const activeDescendant =
    filtered.length > 0 ? `cmd-option-${filtered[selectedIndex]?.id}` : undefined;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh] bg-black/40 backdrop-blur-sm"
      onClick={close}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("commandPalette.title", "명령 팔레트")}
        className="w-[480px] bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input — combobox pattern */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
          <Search className="w-4 h-4 text-zinc-500 shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            role="combobox"
            aria-expanded={filtered.length > 0}
            aria-controls="cmd-palette-list"
            aria-activedescendant={activeDescendant}
            aria-autocomplete="list"
            aria-label={t("commandPalette.placeholder", "명령 검색…")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("commandPalette.placeholder")}
            className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none"
          />
          <kbd className="text-[9px] px-1.5 py-0.5 bg-zinc-800 text-zinc-500 rounded font-mono" aria-hidden="true">
            ESC
          </kbd>
        </div>

        {/* Command list */}
        <div
          ref={listRef}
          id="cmd-palette-list"
          role="listbox"
          aria-label={t("commandPalette.listLabel", "명령 목록")}
          className="max-h-64 overflow-y-auto py-1"
        >
          {filtered.length === 0 ? (
            <p className="text-xs text-zinc-500 text-center py-4" aria-live="polite">
              {t("commandPalette.noResults")}
            </p>
          ) : (
            filtered.map((cmd, i) => (
              <button
                key={cmd.id}
                id={`cmd-option-${cmd.id}`}
                role="option"
                aria-selected={i === selectedIndex}
                onClick={() => {
                  cmd.action();
                  close();
                }}
                className={`w-full text-left px-4 py-2 flex items-center gap-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-violet-500/50 ${
                  i === selectedIndex
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-300 hover:bg-zinc-800/50"
                }`}
              >
                <span className="flex-1 truncate">{cmd.label}</span>
                <span
                  aria-hidden="true"
                  className={`text-[9px] uppercase tracking-wider ${
                    categoryColors[cmd.category] ?? "text-zinc-500"
                  }`}
                >
                  {cmd.category}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
