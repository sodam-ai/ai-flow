import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "@/stores/settingsStore";
import { usePersonaStore } from "@/stores/personaStore";
import { useToastStore } from "@/stores/toastStore";
import { PROVIDERS } from "@/lib/providers";
import PersonaEditor from "@/components/chat/PersonaEditor";
import type { Persona } from "@/types";
import { Eye, EyeOff, Trash2, Check, Loader2, Plus, Pencil, Keyboard } from "lucide-react";

export default function SettingsView() {
  const { t, i18n } = useTranslation();
  const { keyStatuses, loadAllKeyStatuses, saveKey, removeKey, setActiveProvider } =
    useSettingsStore();
  const { personas, fetchPersonas, deletePersona } = usePersonaStore();
  const [editorPersona, setEditorPersona] = useState<Persona | null | "new">(null);

  useEffect(() => {
    loadAllKeyStatuses();
    fetchPersonas();
  }, [loadAllKeyStatuses, fetchPersonas]);

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-2xl">
      <h2 className="text-xl font-bold mb-6">{t("settings.title")}</h2>

      {/* Language */}
      <section className="mb-8">
        <h3 className="text-sm font-medium text-zinc-400 mb-3">
          {t("settings.language")}
        </h3>
        <div className="flex gap-2">
          {(["ko", "en"] as const).map((lang) => (
            <button
              key={lang}
              onClick={() => i18n.changeLanguage(lang)}
              className={`px-3 py-1.5 rounded text-sm transition-colors ${
                i18n.language === lang
                  ? "bg-zinc-100 text-zinc-900"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              {lang === "ko" ? "한국어" : "English"}
            </button>
          ))}
        </div>
      </section>

      {/* API Keys */}
      <section className="mb-8">
        <h3 className="text-sm font-medium text-zinc-400 mb-3">
          {t("settings.apiKeys")}
        </h3>
        <div className="space-y-3">
          {PROVIDERS.map((provider) => (
            <ProviderKeyRow
              key={provider.id}
              providerName={provider.name}
              defaultModel={provider.defaultModel}
              status={keyStatuses[provider.id]}
              onSave={(key) => saveKey(provider.id, key)}
              onDelete={() => removeKey(provider.id)}
              onSelect={() =>
                setActiveProvider(provider.id, provider.defaultModel)
              }
            />
          ))}
        </div>
      </section>

      {/* Personas */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-zinc-400">
            {t("persona.select")}
          </h3>
          <button
            onClick={() => setEditorPersona("new")}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-zinc-800 hover:bg-zinc-700 rounded transition-colors"
          >
            <Plus className="w-3 h-3" />
            {t("persona.create")}
          </button>
        </div>
        <div className="space-y-2">
          {personas.map((persona) => (
            <div
              key={persona.id}
              className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900 border border-zinc-800"
            >
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: persona.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{persona.name}</span>
                  {persona.is_builtin && (
                    <span className="text-[9px] px-1.5 py-0.5 bg-zinc-800 text-zinc-500 rounded">
                      built-in
                    </span>
                  )}
                </div>
                <p className="text-[10px] text-zinc-500 mt-0.5 truncate">
                  {persona.description}
                </p>
              </div>
              {!persona.is_builtin && (
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditorPersona(persona)}
                    className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => deletePersona(persona.id)}
                    className="p-1.5 rounded hover:bg-zinc-800 text-red-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Keyboard Shortcuts */}
      <section className="mb-8">
        <h3 className="text-sm font-medium text-zinc-400 mb-3 flex items-center gap-2">
          <Keyboard className="w-4 h-4" />
          Shortcuts
        </h3>
        <div className="space-y-2">
          {[
            { keys: "Alt+Space", desc: "Open/close overlay window" },
            { keys: "Alt+Shift+A", desc: "Send clipboard to AI" },
            { keys: "Ctrl+K", desc: "Command palette" },
            { keys: "Enter", desc: "Send message" },
            { keys: "Shift+Enter", desc: "New line" },
            { keys: "Escape", desc: "Close modal / overlay" },
          ].map(({ keys, desc }) => (
            <div
              key={keys}
              className="flex items-center justify-between p-2.5 rounded-lg bg-zinc-900 border border-zinc-800"
            >
              <span className="text-xs text-zinc-400">{desc}</span>
              <kbd className="px-2 py-0.5 text-[10px] font-mono bg-zinc-800 text-zinc-300 rounded border border-zinc-700">
                {keys}
              </kbd>
            </div>
          ))}
        </div>
      </section>

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

function ProviderKeyRow({
  providerName,
  defaultModel,
  status,
  onSave,
  onDelete,
  onSelect,
}: {
  providerName: string;
  defaultModel: string;
  status?: { isSet: boolean; maskedPreview: string | null };
  onSave: (key: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onSelect: () => void;
}) {
  const { t } = useTranslation();
  const [inputKey, setInputKey] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [saving, setSaving] = useState(false);
  const isSet = status?.isSet ?? false;

  const handleSave = async () => {
    if (!inputKey.trim()) return;
    setSaving(true);
    try {
      await onSave(inputKey);
      setInputKey("");
      setShowInput(false);
      onSelect();
      useToastStore.getState().addToast("success", `${providerName} API key saved`);
    } catch (err) {
      const message = typeof err === "string" ? err : String(err);
      useToastStore.getState().addToast("error", message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900 border border-zinc-800">
      {/* Provider info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{providerName}</span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded ${
              isSet
                ? "bg-emerald-900/50 text-emerald-400"
                : "bg-zinc-800 text-zinc-500"
            }`}
          >
            {isSet ? t("settings.connected") : t("settings.notConnected")}
          </span>
        </div>
        {isSet && status?.maskedPreview && (
          <p className="text-xs text-zinc-500 font-mono mt-0.5">
            {status.maskedPreview}
          </p>
        )}
        <p className="text-[10px] text-zinc-600 mt-0.5">{defaultModel}</p>
      </div>

      {/* Actions */}
      {showInput ? (
        <div className="flex items-center gap-2">
          <input
            type="password"
            value={inputKey}
            onChange={(e) => setInputKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            placeholder={t("settings.enterKey")}
            className="w-48 px-2 py-1 text-xs bg-zinc-800 border border-zinc-700 rounded focus:border-zinc-500 focus:outline-none"
            autoFocus
          />
          <button
            onClick={handleSave}
            disabled={saving || !inputKey.trim()}
            className="p-1 rounded hover:bg-zinc-700 text-emerald-400 disabled:opacity-30"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={() => {
              setShowInput(false);
              setInputKey("");
            }}
            className="text-xs text-zinc-500 hover:text-zinc-300"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowInput(true)}
            className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400"
            title={isSet ? "Change key" : "Add key"}
          >
            {isSet ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
          {isSet && (
            <button
              onClick={onDelete}
              className="p-1.5 rounded hover:bg-zinc-800 text-red-400"
              title="Delete key"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
