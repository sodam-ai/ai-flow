import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { usePersonaStore } from "@/stores/personaStore";
import PersonaEditor from "./PersonaEditor";
import type { Persona } from "@/types";
import { Bot, ChevronDown, X, Plus, Pencil, Trash2, AlertTriangle, Check } from "lucide-react";

export default function PersonaSelector() {
  const { t } = useTranslation();
  const { personas, activePersonaId, fetchPersonas, setActivePersona, getActivePersona, deletePersona } =
    usePersonaStore();
  const [open, setOpen] = useState(false);
  const [editorPersona, setEditorPersona] = useState<Persona | null | "new">(null);
  // Inline delete confirm — id of persona pending confirmation, null = none
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchPersonas();
  }, [fetchPersonas]);

  // Close on outside click; clear confirm state on close
  useEffect(() => {
    if (!open) { setConfirmDeleteId(null); return; }
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
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={active ? `페르소나: ${active.name}` : "페르소나 선택"}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors hover:bg-zinc-800
                   focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-600/50"
      >
        {active ? (
          <>
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: active.color }}
              aria-hidden="true"
            />
            <span className="text-zinc-300">{active.name}</span>
          </>
        ) : (
          <>
            <Bot className="w-3 h-3 text-zinc-500" aria-hidden="true" />
            <span className="text-zinc-500">{t("persona.select")}</span>
          </>
        )}
        <ChevronDown className="w-3 h-3 text-zinc-500" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="페르소나 목록"
          className="absolute top-full right-0 mt-1 w-64 bg-zinc-900 border border-zinc-800
                     rounded-lg shadow-xl z-40 max-h-72 overflow-y-auto"
        >
          {/* None option */}
          <button
            role="option"
            aria-selected={!activePersonaId}
            onClick={() => { setActivePersona(null); setOpen(false); }}
            className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2
                        hover:bg-zinc-800/50 transition-colors
                        focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-600/50
                        ${!activePersonaId ? "bg-zinc-800 text-zinc-100" : "text-zinc-400"}`}
          >
            <X className="w-3 h-3" aria-hidden="true" />
            <span>{t("persona.none")}</span>
          </button>

          <div className="border-t border-zinc-800 my-0.5" />

          {personas.map((persona) => (
            <div
              key={persona.id}
              className={`group flex flex-col px-3 py-2 text-sm hover:bg-zinc-800/50 transition-colors ${
                activePersonaId === persona.id ? "bg-zinc-800 text-zinc-100" : "text-zinc-300"
              }`}
            >
              {/* Persona row */}
              <div className="flex items-center gap-2">
                <div
                  role="option"
                  aria-selected={activePersonaId === persona.id}
                  className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer"
                  onClick={() => { setActivePersona(persona.id); setOpen(false); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setActivePersona(persona.id);
                      setOpen(false);
                    }
                  }}
                  tabIndex={0}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: persona.color }}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{persona.name}</div>
                    <div className="text-[10px] text-zinc-500 truncate">{persona.description}</div>
                  </div>
                </div>

                {/* Edit/Delete — custom personas only; visible on hover or focus-within */}
                {!persona.is_builtin && confirmDeleteId !== persona.id && (
                  <div className="hidden group-hover:flex group-focus-within:flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteId(null);
                        setOpen(false);
                        setEditorPersona(persona);
                      }}
                      aria-label={`${persona.name} 편집`}
                      className="p-0.5 rounded hover:bg-zinc-700 transition-colors
                                 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500/50"
                    >
                      <Pencil className="w-3 h-3 text-zinc-500" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmDeleteId(persona.id);
                      }}
                      aria-label={`${persona.name} 삭제`}
                      className="p-0.5 rounded hover:bg-zinc-700 transition-colors
                                 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-500/50"
                    >
                      <Trash2 className="w-3 h-3 text-red-400" />
                    </button>
                  </div>
                )}
              </div>

              {/* Inline delete confirm */}
              {confirmDeleteId === persona.id && (
                <div
                  role="alert"
                  className="mt-1.5 flex items-center gap-1.5 px-2 py-1.5
                             bg-red-950/40 border border-red-800/40 rounded-lg"
                  onClick={(e) => e.stopPropagation()}
                >
                  <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" aria-hidden="true" />
                  <p className="text-[10px] text-red-300 flex-1 leading-tight">삭제 확인</p>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                      aria-label="삭제 취소"
                      className="p-0.5 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200
                                 transition-colors focus-visible:outline-none focus-visible:ring-1
                                 focus-visible:ring-zinc-500/50"
                    >
                      <X className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deletePersona(persona.id);
                        setConfirmDeleteId(null);
                      }}
                      aria-label="삭제 확인"
                      className="p-0.5 rounded bg-red-600 hover:bg-red-500 text-white
                                 transition-colors focus-visible:outline-none focus-visible:ring-1
                                 focus-visible:ring-red-400/50"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Create new persona */}
          <div className="border-t border-zinc-800 my-0.5" />
          <button
            onClick={() => { setOpen(false); setEditorPersona("new"); }}
            className="w-full text-left px-3 py-2 text-xs flex items-center gap-2
                       text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300 transition-colors
                       focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-600/50"
          >
            <Plus className="w-3 h-3" aria-hidden="true" />
            {t("persona.create")}
          </button>
        </div>
      )}

      {/* Persona editor modal */}
      {editorPersona !== null && (
        <PersonaEditor
          persona={editorPersona === "new" ? null : editorPersona}
          onClose={() => { setEditorPersona(null); fetchPersonas(); }}
        />
      )}
    </div>
  );
}
