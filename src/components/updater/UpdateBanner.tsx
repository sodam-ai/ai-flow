import { useState, useEffect, useCallback } from "react";
import { listen } from "@tauri-apps/api/event";
import { X, Download, RefreshCw, ArrowUpCircle, Loader2 } from "lucide-react";
import { checkForUpdates, installUpdate } from "@/lib/ipc/invoke";
import type { UpdateInfo } from "@/lib/ipc/invoke";

type BannerState = "hidden" | "available" | "downloading" | "done";

interface ProgressPayload {
  downloaded: number;
  total: number | null;
}

interface Props {
  /** Delay in ms before the first update check fires (default: 5000) */
  checkDelayMs?: number;
}

/**
 * Non-intrusive update notification banner.
 *
 * Lifecycle: hidden → available → downloading → done (restart needed)
 * The banner appears at the top of the app and can be dismissed at any stage.
 * It never blocks the UI or shows a modal.
 */
export default function UpdateBanner({ checkDelayMs = 5_000 }: Props) {
  const [state, setBannerState] = useState<BannerState>("hidden");
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [progress, setProgress] = useState<{ downloaded: number; total: number | null } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Run update check after app stabilises (delayed to avoid blocking startup)
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const info = await checkForUpdates();
        if (info.available) {
          setUpdateInfo(info);
          setBannerState("available");
        }
      } catch {
        // Silent — update check failure is non-fatal
      }
    }, checkDelayMs);
    return () => clearTimeout(timer);
  }, [checkDelayMs]);

  // Listen for download progress from Rust
  useEffect(() => {
    const unsub = listen<ProgressPayload>("aiflow://update-progress", (event) => {
      setProgress(event.payload);
    });
    return () => { unsub.then((fn) => fn()); };
  }, []);

  const handleInstall = useCallback(async () => {
    setError(null);
    setBannerState("downloading");
    setProgress({ downloaded: 0, total: null });
    try {
      await installUpdate();
      setBannerState("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBannerState("available");
    }
  }, []);

  const handleRestart = () => {
    // Tauri will have staged the MSI installer — restarting triggers the install
    window.location.reload();
  };

  if (state === "hidden") return null;

  const pct =
    progress && progress.total && progress.total > 0
      ? Math.round((progress.downloaded / progress.total) * 100)
      : null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-3 px-4 py-2 bg-violet-950/80 border-b border-violet-800/50 text-sm shrink-0"
    >
      <ArrowUpCircle className="w-4 h-4 text-violet-400 shrink-0" />

      {/* Available state */}
      {state === "available" && (
        <>
          <span className="text-zinc-300 flex-1 min-w-0 truncate">
            새 버전 사용 가능:{" "}
            <span className="font-semibold text-violet-300">
              v{updateInfo?.version}
            </span>
            {updateInfo?.current_version && (
              <span className="text-zinc-500 text-xs ml-1">
                (현재 v{updateInfo.current_version})
              </span>
            )}
            {updateInfo?.notes && (
              <span className="text-zinc-400 ml-2 text-xs truncate hidden sm:inline">
                — {updateInfo.notes.split("\n")[0]}
              </span>
            )}
          </span>
          {error && (
            <span className="text-red-400 text-xs shrink-0">{error}</span>
          )}
          <button
            onClick={handleInstall}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-colors shrink-0"
          >
            <Download className="w-3 h-3" />
            지금 설치
          </button>
        </>
      )}

      {/* Downloading state */}
      {state === "downloading" && (
        <>
          <div className="flex-1 flex items-center gap-3 min-w-0">
            <span className="text-zinc-300 shrink-0 text-xs">
              다운로드 중{pct !== null ? ` ${pct}%` : "…"}
            </span>
            <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-violet-500 rounded-full transition-all duration-200"
                style={{ width: pct !== null ? `${pct}%` : "40%" }}
                aria-valuenow={pct ?? undefined}
                aria-valuemin={0}
                aria-valuemax={100}
                role="progressbar"
              />
            </div>
            {pct === null && <Loader2 className="w-3 h-3 text-violet-400 animate-spin shrink-0" />}
          </div>
        </>
      )}

      {/* Done / needs restart */}
      {state === "done" && (
        <>
          <span className="text-zinc-300 flex-1">
            설치 완료 —{" "}
            <span className="text-violet-300 font-medium">재시작하면 적용됩니다</span>
          </span>
          <button
            onClick={handleRestart}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-colors shrink-0"
          >
            <RefreshCw className="w-3 h-3" />
            지금 재시작
          </button>
        </>
      )}

      {/* Dismiss — hidden during active download */}
      {state !== "downloading" && (
        <button
          onClick={() => setBannerState("hidden")}
          className="p-0.5 rounded hover:bg-violet-900/60 text-zinc-500 hover:text-zinc-300 transition-colors shrink-0 ml-1"
          aria-label="닫기"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
