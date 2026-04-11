import { Monitor } from "lucide-react";

/**
 * Shown when a feature requires the Tauri desktop environment.
 * Use in views that depend entirely on Tauri IPC.
 */
export default function DesktopOnly({ label }: { label?: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center p-8">
      <Monitor className="w-10 h-10 text-zinc-700" aria-hidden="true" />
      <p className="text-sm font-medium text-zinc-500">
        {label ?? "이 기능은 데스크톱 앱에서만 사용할 수 있습니다"}
      </p>
      <p className="text-xs text-zinc-600">
        브라우저 미리보기 모드에서는 지원되지 않습니다
      </p>
    </div>
  );
}
