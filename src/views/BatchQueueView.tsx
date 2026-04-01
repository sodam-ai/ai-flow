import { useEffect, useState, useRef } from "react";
import { ListTodo, Play, X, Upload, Plus, FileText, CheckCircle2, XCircle, Loader2, Clock } from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import type { BatchJob, BatchItem, BatchProgressEvent } from "@/types";
import { listBatchJobs, createBatchJob, getBatchItems, runBatchJob, cancelBatchJob } from "@/lib/ipc/invoke";

const STATUS_COLOR: Record<string, string> = {
  pending:   "text-zinc-400",
  running:   "text-blue-400",
  completed: "text-green-400",
  failed:    "text-red-400",
  cancelled: "text-zinc-600",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "대기", running: "처리 중", completed: "완료", failed: "실패", cancelled: "취소됨",
};

export default function BatchQueueView() {
  const [jobs, setJobs] = useState<BatchJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<BatchJob | null>(null);
  const [items, setItems] = useState<BatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [liveProgress, setLiveProgress] = useState<Record<number, BatchProgressEvent>>({});

  // 새 배치 폼 상태
  const [newJobName, setNewJobName] = useState("");
  const [newModel, setNewModel] = useState("claude-sonnet-4-6");
  const [newSystemPrompt, setNewSystemPrompt] = useState("");
  const [inputLines, setInputLines] = useState("");
  const [outputDir, setOutputDir] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setJobs(await listBatchJobs());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  // 배치 진행 이벤트 수신
  useEffect(() => {
    const unlistens = [
      listen<BatchProgressEvent>("aiflow://batch-progress", (ev) => {
        const payload = ev.payload;
        setLiveProgress((prev) => ({ ...prev, [payload.item_id]: payload }));
        setJobs((prev) => prev.map((j) =>
          j.id === payload.job_id
            ? { ...j, processed_items: payload.processed_items, status: "running" }
            : j
        ));
      }),
      listen("aiflow://batch-completed", (ev: any) => {
        const { job_id, status } = ev.payload;
        setJobs((prev) => prev.map((j) =>
          j.id === job_id ? { ...j, status } : j
        ));
        // 완료 시 items 새로고침
        if (selectedJob?.id === job_id) loadItems(job_id);
      }),
    ];
    return () => { unlistens.forEach((p) => p.then((fn) => fn())); };
  }, [selectedJob]);

  async function loadItems(jobId: number) {
    try {
      setItems(await getBatchItems(jobId));
    } catch {}
  }

  async function handleSelectJob(job: BatchJob) {
    setSelectedJob(job);
    await loadItems(job.id);
  }

  async function handleCreateJob() {
    const lines = inputLines.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!newJobName.trim() || lines.length === 0) {
      setError("이름과 입력 항목이 필요합니다.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const job = await createBatchJob({
        name: newJobName,
        model: newModel,
        system_prompt: newSystemPrompt || undefined,
        output_dir: outputDir || undefined,
        items: lines.map((input_text) => ({ input_text })),
      });
      setJobs((prev) => [job, ...prev]);
      setShowCreate(false);
      setNewJobName(""); setNewModel("claude-sonnet-4-6");
      setNewSystemPrompt(""); setInputLines(""); setOutputDir("");
      handleSelectJob(job);
    } catch (e) {
      setError(String(e));
    } finally {
      setCreating(false);
    }
  }

  async function handleRun(jobId: number) {
    try {
      await runBatchJob(jobId);
      setJobs((prev) => prev.map((j) => j.id === jobId ? { ...j, status: "running" } : j));
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleCancel(jobId: number) {
    try {
      await cancelBatchJob(jobId);
      setJobs((prev) => prev.map((j) => j.id === jobId ? { ...j, status: "cancelled" } : j));
    } catch (e) {
      setError(String(e));
    }
  }

  if (loading) return <div className="flex-1 flex items-center justify-center text-zinc-500">로딩 중...</div>;

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left: Job List */}
      <div className="w-72 border-r border-zinc-800 flex flex-col">
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-100">배치 작업</span>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium transition-colors"
          >
            <Plus size={12} /> 새 배치
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {jobs.length === 0 && (
            <p className="text-xs text-zinc-500 text-center py-8">
              배치 작업이 없습니다.
            </p>
          )}
          {jobs.map((job) => (
            <div
              key={job.id}
              onClick={() => handleSelectJob(job)}
              className={`px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                selectedJob?.id === job.id
                  ? "bg-violet-600/20 border border-violet-600/30"
                  : "hover:bg-zinc-800"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm text-zinc-100 truncate">{job.name}</span>
                <span className={`text-xs ${STATUS_COLOR[job.status]}`}>{STATUS_LABEL[job.status]}</span>
              </div>
              {/* Progress bar */}
              {job.total_items > 0 && (
                <div className="h-1 rounded-full bg-zinc-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      job.status === "completed" ? "bg-green-500" :
                      job.status === "failed" ? "bg-red-500" : "bg-violet-500"
                    }`}
                    style={{ width: `${(job.processed_items / job.total_items) * 100}%` }}
                  />
                </div>
              )}
              <p className="text-xs text-zinc-500 mt-1">
                {job.processed_items}/{job.total_items} 항목
                {job.total_cost_usd > 0 && ` · $${job.total_cost_usd.toFixed(4)}`}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Job Detail */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedJob ? (
          <>
            <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-zinc-100">{selectedJob.name}</h2>
                <p className="text-sm text-zinc-500">
                  {selectedJob.model} · {selectedJob.total_items}개 항목
                </p>
              </div>
              <div className="flex gap-2">
                {selectedJob.status === "pending" && (
                  <button
                    onClick={() => handleRun(selectedJob.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors"
                  >
                    <Play size={13} /> 실행
                  </button>
                )}
                {selectedJob.status === "running" && (
                  <button
                    onClick={() => handleCancel(selectedJob.id)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-700 hover:bg-zinc-600 text-white text-sm transition-colors"
                  >
                    <X size={13} /> 취소
                  </button>
                )}
              </div>
            </div>

            {/* Items */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {items.map((item) => {
                const live = liveProgress[item.id];
                const status = live?.status ?? item.status;
                return (
                  <div key={item.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-zinc-500 mb-1.5">#{item.item_order + 1} 입력</p>
                        <p className="text-sm text-zinc-300 truncate">{item.input_text}</p>
                      </div>
                      <div className={`flex items-center gap-1 text-xs ${STATUS_COLOR[status]} shrink-0`}>
                        {status === "running" && <Loader2 size={12} className="animate-spin" />}
                        {status === "completed" && <CheckCircle2 size={12} />}
                        {status === "failed" && <XCircle size={12} />}
                        {status === "pending" && <Clock size={12} />}
                        {STATUS_LABEL[status]}
                      </div>
                    </div>
                    {(item.output_text || live?.output_text) && (
                      <div className="mt-3 pt-3 border-t border-zinc-800">
                        <p className="text-xs text-zinc-500 mb-1.5">결과</p>
                        <p className="text-sm text-zinc-200 whitespace-pre-wrap">
                          {(live?.output_text ?? item.output_text ?? "").slice(0, 300)}
                        </p>
                        {item.cost_usd > 0 && (
                          <p className="text-xs text-zinc-600 mt-1.5">
                            {item.tokens_in + item.tokens_out} 토큰 · ${item.cost_usd.toFixed(4)}
                          </p>
                        )}
                      </div>
                    )}
                    {item.error_message && (
                      <p className="mt-2 text-xs text-red-400">{item.error_message}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4">
            <ListTodo size={40} className="text-zinc-700" />
            <div>
              <p className="text-zinc-400 font-medium">배치 작업 선택</p>
              <p className="text-zinc-500 text-sm mt-1">여러 입력을 일괄 처리합니다.</p>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-lg space-y-4">
            <h3 className="font-semibold text-zinc-100">새 배치 작업</h3>
            {error && <p className="text-sm text-red-400">{error}</p>}

            <div className="space-y-3">
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">작업 이름</label>
                <input
                  value={newJobName}
                  onChange={(e) => setNewJobName(e.target.value)}
                  placeholder="예: 제품 설명 번역 배치"
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-600 focus:border-violet-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">모델</label>
                <select
                  value={newModel}
                  onChange={(e) => setNewModel(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-sm text-zinc-100 focus:border-violet-500 focus:outline-none"
                >
                  <option value="claude-sonnet-4-6">Claude Sonnet 4.6</option>
                  <option value="gpt-4.1-mini">GPT-4.1 Mini</option>
                  <option value="gemini-2.0-flash">Gemini 2.0 Flash</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">시스템 프롬프트 (선택)</label>
                <textarea
                  value={newSystemPrompt}
                  onChange={(e) => setNewSystemPrompt(e.target.value)}
                  placeholder="각 항목 처리 시 사용할 시스템 프롬프트..."
                  rows={2}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-600 focus:border-violet-500 focus:outline-none resize-none"
                />
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">
                  입력 항목 (줄 단위, 각 줄이 하나의 배치 아이템)
                </label>
                <textarea
                  value={inputLines}
                  onChange={(e) => setInputLines(e.target.value)}
                  placeholder={"첫 번째 입력 항목\n두 번째 입력 항목\n세 번째 입력 항목"}
                  rows={6}
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-sm font-mono text-zinc-100 placeholder-zinc-600 focus:border-violet-500 focus:outline-none resize-none"
                />
                <p className="text-xs text-zinc-600 mt-1">
                  {inputLines.split("\n").filter((l) => l.trim()).length}개 항목
                </p>
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-1 block">결과 저장 폴더 (선택)</label>
                <input
                  value={outputDir}
                  onChange={(e) => setOutputDir(e.target.value)}
                  placeholder="C:\Users\...\results"
                  className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-sm font-mono text-zinc-100 placeholder-zinc-600 focus:border-violet-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button
                onClick={() => { setShowCreate(false); setError(null); }}
                className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleCreateJob}
                disabled={creating}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-sm font-medium transition-colors"
              >
                {creating && <Loader2 size={14} className="animate-spin" />}
                배치 생성
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
