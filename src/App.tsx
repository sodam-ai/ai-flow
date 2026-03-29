import { useState } from "react";
import { useTranslation } from "react-i18next";
import SettingsView from "@/views/SettingsView";

type AppView = "chat" | "settings";

export default function App() {
  const [currentView, setCurrentView] = useState<AppView>("chat");
  const { t } = useTranslation();

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-50">
      {/* Sidebar */}
      <aside className="w-60 border-r border-zinc-800 flex flex-col">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <span className="font-semibold text-sm select-none">
            {t("app.name")}
          </span>
          <button
            onClick={() => setCurrentView("chat")}
            className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 transition-colors"
          >
            + {t("app.newChat")}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-2">
          <p className="text-xs text-zinc-500 text-center py-8">
            {t("app.noConversations")}
          </p>
        </nav>

        <div className="p-2 border-t border-zinc-800">
          <button
            onClick={() => setCurrentView("settings")}
            className={`w-full text-left px-3 py-2 rounded text-sm transition-colors ${
              currentView === "settings"
                ? "bg-zinc-800 text-zinc-100"
                : "text-zinc-400 hover:bg-zinc-800/50"
            }`}
          >
            {t("app.settings")}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {currentView === "settings" ? (
          <SettingsView />
        ) : (
          <WelcomeView
            onNewChat={() => {
              /* TODO: create conversation */
            }}
          />
        )}
      </main>
    </div>
  );
}

function WelcomeView({ onNewChat }: { onNewChat: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-bold">{t("app.name")}</h1>
      <p className="text-zinc-400 text-sm">{t("app.welcome")}</p>
      <p className="text-xs text-zinc-500">
        <kbd className="px-1.5 py-0.5 rounded bg-zinc-800 font-mono text-zinc-300">
          Alt+Space
        </kbd>{" "}
        {t("app.hotkeyHint")}
      </p>
      <button
        onClick={onNewChat}
        className="px-4 py-2 rounded bg-zinc-100 text-zinc-900 hover:bg-zinc-200 text-sm font-medium transition-colors"
      >
        {t("app.startChat")}
      </button>
    </div>
  );
}
