import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { usePersonaStore } from "@/stores/personaStore";
import { Bot, ChevronDown, X } from "lucide-react";

export default function PersonaSelector() {
  const { t } = useTranslation();
  const { personas, activePersonaId, fetchPersonas, setActivePersona, getActivePersona } =
    usePersonaStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchPersonas();
  }, [fetchPersonas]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const active = getActivePersona();

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors hover:bg-zinc-800"
      >
        {active ? (
          <>
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: active.color }}
            />
            <span className="text-zinc-300">{active.name}</span>
          </>
        ) : (
          <>
            <Bot className="w-3 h-3 text-zinc-500" />
            <span className="text-zinc-500">{t("persona.select")}</span>
          </>
        )}
        <ChevronDown className="w-3 h-3 text-zinc-500" />
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 w-64 bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl z-40 max-h-72 overflow-y-auto">
          {/* None option */}
          <button
            onClick={() => {
              setActivePersona(null);
              setOpen(false);
            }}
            className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-zinc-800/50 ${
              !activePersonaId ? "bg-zinc-800 text-zinc-100" : "text-zinc-400"
            }`}
          >
            <X className="w-3 h-3" />
            <span>{t("persona.none")}</span>
          </button>

          <div className="border-t border-zinc-800 my-0.5" />

          {personas.map((persona) => (
            <button
              key={persona.id}
              onClick={() => {
                setActivePersona(persona.id);
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 hover:bg-zinc-800/50 ${
                activePersonaId === persona.id
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-300"
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: persona.color }}
              />
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{persona.name}</div>
                <div className="text-[10px] text-zinc-500 truncate">
                  {persona.description}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
