import { useTranslation } from "react-i18next";

export default function SettingsView() {
  const { t, i18n } = useTranslation();

  return (
    <div className="flex-1 overflow-y-auto p-6">
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

      {/* API Keys — placeholder */}
      <section>
        <h3 className="text-sm font-medium text-zinc-400 mb-3">
          {t("settings.apiKeys")}
        </h3>
        <p className="text-xs text-zinc-500">
          API key management will be implemented next.
        </p>
      </section>
    </div>
  );
}
