import { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { usePersonaStore } from "@/stores/personaStore";
import PersonaEditor from "./PersonaEditor";
import type { Persona } from "@/types";
import { Bot, ChevronDown, X, Plus, Pencil, Trash2 } from "lucide-react";

export default function PersonaSelector() {
  const { t } = useTranslation();
  const { personas, activePersonaId, fetchPersonas, setActivePersona, getActivePersona, deletePersona } =
    usePersonaStore();
  const [open, setOpen] = useState(false);
  const [editorPersona, setEditorPersona] = useState<Persona | null | "new">(null);
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
            <div
              key={persona.id}
              className={`group flex items-center gap-2 px-3 py-2 text-sm hover:bg-zinc-800/50 cursor-pointer ${
                activePersonaId === persona.id
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-300"
              }`}
            >
              <div
                className="flex items-center gap-2 min-w-0 flex-1"
                onClick={() => {
                  setActivePersona(persona.id);
                  setOpen(false);
                }}
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
              </div>

              {/* Edit/Delete for custom personas only */}
              {!persona.is_builtin && (
                <div className="hidden group-hover:flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpen(false);
                      setEditorPersona(persona);
                    }}
                    className="p-0.5 rounded hover:bg-zinc-700"
                  >
                    <Pencil className="w-3 h-3 text-zinc-500" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deletePersona(persona.id);
                    }}
                    className="p-0.5 rounded hover:bg-zinc-700"
                  >
                    <Trash2 className="w-3 h-3 text-red-400" />
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* Create new persona */}
          <div className="border-t border-zinc-800 my-0.5" />
          <button
            onClick={() => {
              setOpen(false);
              setEditorPersona("new");
            }}
            className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300"
          >
            <Plus className="w-3 h-3" />
            {t("persona.create")}
          </button>
        </div>
      )}

      {/* Persona editor modal */}
      {editorPersona !== null && (
        <PersonaEditor
          persona={editorPersona === "new" ? null : editorPersona}
          onClose={() => {
            setEditorPersona(null);
            fetchPersonas();
          }}
        />
      )}
    </div>
  );
}
