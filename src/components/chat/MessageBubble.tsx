import type { Message } from "@/types";
import { useTranslation } from "react-i18next";
import { Copy } from "lucide-react";

interface Props {
  message: Message;
  exchangeRate?: number;
}

export default function MessageBubble({ message, exchangeRate = 1380 }: Props) {
  const { t } = useTranslation();
  const isUser = message.role === "user";

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
  };

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
          isUser
            ? "bg-zinc-100 text-zinc-900"
            : "bg-zinc-800/50 text-zinc-100"
        }`}
      >
        <p className="text-sm whitespace-pre-wrap leading-relaxed">
          {message.content}
        </p>

        {/* Cost badge (assistant messages only) */}
        {!isUser && message.costUsd != null && message.costUsd > 0 && (
          <div className="flex items-center gap-2 mt-2 pt-1.5 border-t border-zinc-700/50">
            <span className="text-[10px] text-zinc-500">
              {message.inputTokens ?? 0}+{message.outputTokens ?? 0}{" "}
              {t("chat.tokens")}
            </span>
            <span className="text-[10px] text-zinc-500">
              ${message.costUsd.toFixed(4)}
            </span>
            <span className="text-[10px] text-zinc-500">
              ~{Math.round(message.costUsd * exchangeRate).toLocaleString()}
            </span>
            <button
              onClick={handleCopy}
              className="ml-auto p-0.5 rounded hover:bg-zinc-700/50"
              title={t("chat.copy")}
            >
              <Copy className="w-3 h-3 text-zinc-500" />
            </button>
          </div>
        )}

        {isUser && (
          <div className="flex justify-end mt-1">
            <button
              onClick={handleCopy}
              className="p-0.5 rounded hover:bg-zinc-200"
              title={t("chat.copy")}
            >
              <Copy className="w-3 h-3 text-zinc-400" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
