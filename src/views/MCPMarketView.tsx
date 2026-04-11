import { useEffect, useState, useRef } from "react";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { useFocusReturn } from "@/hooks/useFocusReturn";
import {
  Plug, Trash2, ToggleLeft, ToggleRight, FolderOpen,
  AlertCircle, Check, X, Loader2,
} from "lucide-react";
import type { MCPServer } from "@/types";
import { listMcpServers, toggleMcpServer, deleteMcpServer, setMcpAllowedPaths, isTauri } from "@/lib/ipc/invoke";
import { toUserMessage } from "@/lib/errors";
import DesktopOnly from "@/components/shared/DesktopOnly";

const SERVER_TYPE_LABELS: Record<string, { icon: string; color: string }> = {
  filesystem: { icon: "📁", color: "text-blue-400" },
  git:        { icon: "🔀", color: "text-orange-400" },
  browser:    { icon: "🌐", color: "text-green-400" },
  custom:     { icon: "⚙️", color: "text-zinc-400" },
};

export default function MCPMarketView() {
  if (!isTauri) return <DesktopOnly label="MCP 마켓은 데스크톱 앱에서만 사용할 수 있습니다" />;
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [pathModalId, setPathModalId] = useState<number | null>(null);
  const pathModalRef = useRef<HTMLDivElement>(null);
  useFocusTrap(pathModalRef, pathModalId !== null);
  useFocusReturn(pathModalId !== null);
  const [pathInput, setPathInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Inline confirm replaces window.confirm() — OWASP ASVS 5.1.1
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  async function load() {
    try {
      setServers(await listMcpServers());
    } catch (e) {
      setError(toUserMessage(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleToggle(server: MCPServer) {
    try {
      const updated = await toggleMcpServer(server.id, !server.is_enabled);
      setServers((prev) => prev.map((s) => s.id === updated.id ? updated : s));
    } catch (e) {
      setError(toUserMessage(e));
    }
  }

  async function handleDelete(id: number) {
    try {
      await deleteMcpServer(id);
      setServers((prev) => prev.filter((s) => s.id !== id));
      setConfirmDeleteId(null);
    } catch (e) {
      setError(toUserMessage(e));
    }
  }

  async function handleSavePaths(id: number) {
    const paths = pathInput.split("\n").map((p) => p.trim()).filter(Boolean);
    try {
      const updated = await setMcpAllowedPaths(id, paths);
      setServers((prev) => prev.map((s) => s.id === updated.id ? updated : s));
      setPathModalId(null);
    } catch (e) {
      setError(toUserMessage(e));
    }
  }

  if (loading) {
    return (
      <div role="status" aria-live="polite" className="flex-1 flex items-center justify-center gap-2 text-zinc-500 text-sm">
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        로딩 중...
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
              <Plug size={20} className="text-violet-400" aria-hidden="true" />
              MCP 플러그인 마켓
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              AI 도구 서버를 연결하여 파일 읽기, Git, 브라우저 기능을 AI에게 부여합니다.
            </p>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="flex items-start gap-2 p-3 bg-red-950/50 border border-red-800 rounded-lg text-red-400 text-sm"
          >
            <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {/* Server list — ul/li semantics */}
        <ul role="list" aria-label="MCP 서버 목록" className="space-y-3">
          {servers.length === 0 && (
            <li>
              <p role="status" className="text-sm text-zinc-600 text-center py-8">
                등록된 MCP 서버가 없습니다.
              </p>
            </li>
          )}
          {servers.map((server) => {
            const meta = SERVER_TYPE_LABELS[server.server_type] ?? SERVER_TYPE_LABELS.custom;
            const isConfirmingDelete = confirmDeleteId === server.id;

            return (
              <li key={server.id}>
                <div
                  className={`rounded-xl border p-4 transition-colors ${
                    server.is_enabled
                      ? "bg-zinc-900 border-zinc-700"
                      : "bg-zinc-950 border-zinc-800 opacity-60"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {/* Server type icon */}
                      <span className="text-2xl" aria-hidden="true">{meta.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-zinc-100">{server.name}</span>
                          {server.is_builtin && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">내장</span>
                          )}
                          {server.is_enabled && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-green-950 text-green-400">활성</span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-500 mt-0.5 truncate">{server.description}</p>

                        {/* Allowed Paths */}
                        {server.allowed_paths.length > 0 ? (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {server.allowed_paths.map((p) => (
                              <span key={p} className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono truncate max-w-48">{p}</span>
                            ))}
                          </div>
                        ) : (
                          server.is_enabled && (
                            <p className="text-xs text-amber-500 mt-1 flex items-center gap-1">
                              <AlertCircle size={12} aria-hidden="true" />
                              허용 경로를 설정해야 사용할 수 있습니다.
                            </p>
                          )
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {/* Path config button */}
                      <button
                        onClick={() => {
                          setPathModalId(server.id);
                          setPathInput(server.allowed_paths.join("\n"));
                        }}
                        aria-label={`${server.name} 허용 경로 설정`}
                        className="p-1.5 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"
                      >
                        <FolderOpen size={15} aria-hidden="true" />
                      </button>

                      {/* Toggle switch */}
                      <button
                        onClick={() => handleToggle(server)}
                        role="switch"
                        aria-checked={server.is_enabled}
                        aria-label={`${server.name} ${server.is_enabled ? "비활성화" : "활성화"}`}
                        className="p-1.5 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50"
                      >
                        {server.is_enabled
                          ? <ToggleRight size={18} className="text-green-400" aria-hidden="true" />
                          : <ToggleLeft size={18} aria-hidden="true" />
                        }
                      </button>

                      {/* Delete — inline confirm (replaces window.confirm) */}
                      {!server.is_builtin && (
                        isConfirmingDelete ? (
                          <div
                            role="alert"
                            className="flex items-center gap-1 rounded-md bg-red-950/40 border border-red-800/50 px-2 py-1"
                          >
                            <span className="text-[10px] text-red-400 mr-0.5">삭제?</span>
                            <button
                              onMouseDown={(e) => { e.preventDefault(); handleDelete(server.id); }}
                              aria-label={`${server.name} 삭제 확인`}
                              className="p-0.5 rounded text-red-400 hover:bg-red-900/50 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-500"
                            >
                              <Check size={12} aria-hidden="true" />
                            </button>
                            <button
                              onMouseDown={(e) => { e.preventDefault(); setConfirmDeleteId(null); }}
                              aria-label="삭제 취소"
                              className="p-0.5 rounded text-zinc-500 hover:bg-zinc-700 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500"
                            >
                              <X size={12} aria-hidden="true" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDeleteId(server.id)}
                            aria-label={`${server.name} 삭제`}
                            className="p-1.5 rounded hover:bg-zinc-700 text-zinc-400 hover:text-red-400 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
                          >
                            <Trash2 size={15} aria-hidden="true" />
                          </button>
                        )
                      )}
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        {/* Path Configuration Modal */}
        {pathModalId !== null && (
          <div
            ref={pathModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="path-modal-title"
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onKeyDown={(e) => { if (e.key === "Escape") setPathModalId(null); }}
          >
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md space-y-4">
              <h2 id="path-modal-title" className="font-semibold text-zinc-100">
                허용 경로 설정
              </h2>
              <p className="text-sm text-zinc-400">
                MCP 서버가 접근할 수 있는 절대 경로를 줄 단위로 입력하세요.<br />
                <span className="text-amber-400">지정된 경로 외에는 접근이 차단됩니다.</span>
              </p>
              <div>
                <label htmlFor="path-modal-input" className="sr-only">
                  허용 경로 목록 (줄 단위)
                </label>
                <textarea
                  id="path-modal-input"
                  value={pathInput}
                  onChange={(e) => setPathInput(e.target.value)}
                  placeholder={"C:\\Users\\username\\Documents\nC:\\Projects"}
                  rows={5}
                  maxLength={10000}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-sm font-mono text-zinc-100 placeholder-zinc-600 focus:border-violet-500 focus:outline-none resize-none focus-visible:ring-1 focus-visible:ring-violet-500/50"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setPathModalId(null)}
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/50"
                >
                  취소
                </button>
                <button
                  onClick={() => handleSavePaths(pathModalId)}
                  className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70"
                >
                  저장
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
