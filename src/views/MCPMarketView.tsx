import { useEffect, useState } from "react";
import { Plug, Trash2, ToggleLeft, ToggleRight, FolderOpen, AlertCircle } from "lucide-react";
import type { MCPServer } from "@/types";
import { listMcpServers, toggleMcpServer, deleteMcpServer, setMcpAllowedPaths } from "@/lib/ipc/invoke";

const SERVER_TYPE_LABELS: Record<string, { icon: string; color: string }> = {
  filesystem: { icon: "📁", color: "text-blue-400" },
  git:        { icon: "🔀", color: "text-orange-400" },
  browser:    { icon: "🌐", color: "text-green-400" },
  custom:     { icon: "⚙️", color: "text-zinc-400" },
};

export default function MCPMarketView() {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [pathModalId, setPathModalId] = useState<number | null>(null);
  const [pathInput, setPathInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setServers(await listMcpServers());
    } catch (e) {
      setError(String(e));
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
      setError(String(e));
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("이 MCP 서버를 삭제하시겠습니까?")) return;
    try {
      await deleteMcpServer(id);
      setServers((prev) => prev.filter((s) => s.id !== id));
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleSavePaths(id: number) {
    const paths = pathInput.split("\n").map((p) => p.trim()).filter(Boolean);
    try {
      const updated = await setMcpAllowedPaths(id, paths);
      setServers((prev) => prev.map((s) => s.id === updated.id ? updated : s));
      setPathModalId(null);
    } catch (e) {
      setError(String(e));
    }
  }

  if (loading) return <div className="flex-1 flex items-center justify-center text-zinc-500">로딩 중...</div>;

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
              <Plug size={20} className="text-violet-400" /> MCP 플러그인 마켓
            </h1>
            <p className="text-sm text-zinc-500 mt-1">
              AI 도구 서버를 연결하여 파일 읽기, Git, 브라우저 기능을 AI에게 부여합니다.
            </p>
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 p-3 bg-red-950/50 border border-red-800 rounded-lg text-red-400 text-sm">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Server List */}
        <div className="space-y-3">
          {servers.map((server) => {
            const meta = SERVER_TYPE_LABELS[server.server_type] ?? SERVER_TYPE_LABELS.custom;
            return (
              <div
                key={server.id}
                className={`rounded-xl border p-4 transition-colors ${
                  server.is_enabled
                    ? "bg-zinc-900 border-zinc-700"
                    : "bg-zinc-950 border-zinc-800 opacity-60"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <span className="text-2xl">{meta.icon}</span>
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
                            <AlertCircle size={12} /> 허용 경로를 설정해야 사용할 수 있습니다.
                          </p>
                        )
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => {
                        setPathModalId(server.id);
                        setPathInput(server.allowed_paths.join("\n"));
                      }}
                      className="p-1.5 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 transition-colors"
                      title="허용 경로 설정"
                    >
                      <FolderOpen size={15} />
                    </button>
                    <button
                      onClick={() => handleToggle(server)}
                      className="p-1.5 rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 transition-colors"
                      title={server.is_enabled ? "비활성화" : "활성화"}
                    >
                      {server.is_enabled
                        ? <ToggleRight size={18} className="text-green-400" />
                        : <ToggleLeft size={18} />
                      }
                    </button>
                    {!server.is_builtin && (
                      <button
                        onClick={() => handleDelete(server.id)}
                        className="p-1.5 rounded hover:bg-zinc-700 text-zinc-400 hover:text-red-400 transition-colors"
                        title="삭제"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Path Configuration Modal */}
        {pathModalId !== null && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md space-y-4">
              <h3 className="font-semibold text-zinc-100">허용 경로 설정</h3>
              <p className="text-sm text-zinc-400">
                MCP 서버가 접근할 수 있는 절대 경로를 줄 단위로 입력하세요.<br/>
                <span className="text-amber-400">지정된 경로 외에는 접근이 차단됩니다.</span>
              </p>
              <textarea
                value={pathInput}
                onChange={(e) => setPathInput(e.target.value)}
                placeholder={"C:\\Users\\username\\Documents\nC:\\Projects"}
                rows={5}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-sm font-mono text-zinc-100 placeholder-zinc-600 focus:border-violet-500 focus:outline-none resize-none"
              />
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setPathModalId(null)}
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={() => handleSavePaths(pathModalId)}
                  className="px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors"
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
