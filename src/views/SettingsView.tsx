import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "@/stores/settingsStore";
import { useToastStore } from "@/stores/toastStore";
import { PROVIDERS } from "@/lib/providers";
import { Eye, EyeOff, Trash2, Check, Loader2 } from "lucide-react";

export default function SettingsView() {
  const { t, i18n } = useTranslation();
  const { keyStatuses, loadAllKeyStatuses, saveKey, removeKey, setActiveProvider } =
    useSettingsStore();

  useEffect(() => {
    loadAllKeyStatuses();
  }, [loadAllKeyStatuses]);

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
      <section>
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
