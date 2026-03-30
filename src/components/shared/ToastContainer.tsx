import { useToastStore } from "@/stores/toastStore";
import { X, AlertCircle, CheckCircle, Info } from "lucide-react";

const ICON_MAP = {
  error: AlertCircle,
  success: CheckCircle,
  info: Info,
};

const COLOR_MAP = {
  error: "border-red-800 bg-red-950/90 text-red-200",
  success: "border-emerald-800 bg-emerald-950/90 text-emerald-200",
  info: "border-blue-800 bg-blue-950/90 text-blue-200",
};

const ICON_COLOR_MAP = {
  error: "text-red-400",
  success: "text-emerald-400",
  info: "text-blue-400",
};

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => {
        const Icon = ICON_MAP[toast.type];
        return (
          <div
            key={toast.id}
            className={`flex items-start gap-2.5 px-3.5 py-2.5 rounded-lg border backdrop-blur-sm shadow-lg animate-in slide-in-from-right ${COLOR_MAP[toast.type]}`}
          >
            <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${ICON_COLOR_MAP[toast.type]}`} />
            <p className="text-xs leading-relaxed flex-1">{toast.message}</p>
            <button
              onClick={() => removeToast(toast.id)}
              className="p-0.5 rounded hover:bg-white/10 shrink-0"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
