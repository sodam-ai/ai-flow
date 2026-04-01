import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import type { AgentRun, AgentStep } from "@/types";
import {
  listAgentRuns,
  startAgentRun,
  resumeAgentRun,
  approveAgentStep,
  cancelAgentRun,
  getAgentRunDetail,
} from "@/lib/ipc/invoke";

// ─── Step Status Icon ──────────────────────────────────────────────────────

function StepIcon({ step }: { step: AgentStep }) {
  if (step.status === "completed") {
    return (
      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-green-800/40 flex items-center justify-center">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-3 h-3 text-green-400">
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        </svg>
      </span>
    );
  }
  if (step.status === "running") {
    return (
      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-800/40 flex items-center justify-center">
        <svg className="w-3 h-3 text-blue-400 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      </span>
    );
  }
  if (step.status === "awaiting_approval") {
    return (
      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-yellow-800/40 flex items-center justify-center">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3 text-yellow-400">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </span>
    );
  }
  if (step.status === "failed") {
    return (
      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-red-800/40 flex items-center justify-center">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3 text-red-400">
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </span>
    );
  }
  if (step.status === "skipped") {
    return (
      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-zinc-700 flex items-center justify-center">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3 text-zinc-500">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
        </svg>
      </span>
    );
  }
  return (
    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-zinc-800 flex items-center justify-center">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3 text-zinc-600">
        <circle cx={12} cy={12} r={3} />
      </svg>
    </span>
  );
}

// ─── Approval Gate Card ────────────────────────────────────────────────────

function ApprovalGateCard({
  step,
  onApprove,
  onDeny,
}: {
  step: AgentStep;
  onApprove: (stepId: number) => void;
  onDeny: (stepId: number) => void;
}) {
  return (
    <div className="border border-yellow-700/40 bg-yellow-900/10 rounded-lg p-4 mt-3">
      <div className="flex items-start gap-3">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <div className="flex-1">
          <p className="text-sm font-medium text-yellow-300">승인이 필요합니다</p>
          <p className="text-xs text-zinc-400 mt-1">
            {step.approval_message || `"${step.title}" 단계를 실행하려면 승인이 필요합니다.`}
          </p>
          {step.tool_name && (
            <p className="text-xs text-zinc-500 mt-1">
              도구: <code className="bg-zinc-800 px-1 rounded">{step.tool_name}</code>
            </p>
          )}
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => onApprove(step.id)}
              className="px-3 py-1.5 rounded bg-green-700 hover:bg-green-600 text-white text-xs font-medium transition-colors cursor-pointer"
            >
              승인
            </button>
            <button
              onClick={() => onDeny(step.id)}
              className="px-3 py-1.5 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-xs font-medium transition-colors cursor-pointer"
            >
              거부 (건너뜀)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Agent View ───────────────────────────────────────────────────────

export default function AgentView() {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<AgentRun | null>(null);
  const [goal, setGoal] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRuns();
  }, []);

  // Listen for agent events
  useEffect(() => {
    const unsubs = [
      listen<{ run_id: number }>("aiflow://agent-started", async ({ payload }) => {
        const run = await getAgentRunDetail(payload.run_id);
        setRuns((prev) => [run, ...prev.filter((r) => r.id !== run.id)]);
        setSelectedRun(run);
      }),
      listen<{ run_id: number }>("aiflow://agent-step-completed", async ({ payload }) => {
        const run = await getAgentRunDetail(payload.run_id);
        setRuns((prev) => prev.map((r) => (r.id === run.id ? run : r)));
        setSelectedRun((prev) => (prev?.id === run.id ? run : prev));
      }),
      listen<{ run_id: number }>("aiflow://agent-approval-needed", async ({ payload }) => {
        const run = await getAgentRunDetail(payload.run_id);
        setRuns((prev) => prev.map((r) => (r.id === run.id ? run : r)));
        setSelectedRun((prev) => (prev?.id === run.id ? run : prev));
      }),
      listen<{ run_id: number }>("aiflow://agent-step-failed", async ({ payload }) => {
        const run = await getAgentRunDetail(payload.run_id);
        setRuns((prev) => prev.map((r) => (r.id === run.id ? run : r)));
        setSelectedRun((prev) => (prev?.id === run.id ? run : prev));
      }),
    ];
    return () => { unsubs.forEach((u) => u.then((fn) => fn())); };
  }, []);

  async function loadRuns() {
    try {
      setLoading(true);
      const data = await listAgentRuns();
      setRuns(data);
      if (data.length > 0) setSelectedRun(data[0]);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleStart() {
    if (!goal.trim()) return;
    setIsStarting(true);
    setError(null);
    try {
      const run = await startAgentRun({ goal: goal.trim() });
      setRuns((prev) => [run, ...prev]);
      setSelectedRun(run);
      setGoal("");
    } catch (e) {
      setError(String(e));
    } finally {
      setIsStarting(false);
    }
  }

  async function handleApprove(runId: number, stepId: number) {
    try {
      await approveAgentStep({ run_id: runId, step_id: stepId, approved: true });
      const run = await resumeAgentRun(runId);
      setRuns((prev) => prev.map((r) => (r.id === run.id ? run : r)));
      setSelectedRun((prev) => (prev?.id === run.id ? run : prev));
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleDeny(runId: number, stepId: number) {
    try {
      await approveAgentStep({ run_id: runId, step_id: stepId, approved: false });
      const run = await resumeAgentRun(runId);
      setRuns((prev) => prev.map((r) => (r.id === run.id ? run : r)));
      setSelectedRun((prev) => (prev?.id === run.id ? run : prev));
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleCancel(runId: number) {
    try {
      await cancelAgentRun(runId);
      const run = await getAgentRunDetail(runId);
      setRuns((prev) => prev.map((r) => (r.id === run.id ? run : r)));
      setSelectedRun((prev) => (prev?.id === run.id ? run : prev));
    } catch (e) {
      setError(String(e));
    }
  }

  const statusColor = (status: AgentRun["status"]) => {
    switch (status) {
      case "completed": return "text-green-400";
      case "running": return "text-blue-400";
      case "awaiting_approval": return "text-yellow-400";
      case "failed": return "text-red-400";
      case "cancelled": return "text-zinc-500";
      default: return "text-zinc-400";
    }
  };

  const statusLabel = (status: AgentRun["status"]) => {
    switch (status) {
      case "completed": return "완료";
      case "running": return "실행 중";
      case "awaiting_approval": return "승인 대기";
      case "failed": return "실패";
      case "cancelled": return "취소됨";
      default: return status;
    }
  };

  return (
    <div className="flex h-full bg-zinc-950 text-zinc-50">
      {/* Left panel: Run list */}
      <aside className="w-56 border-r border-zinc-800 flex flex-col">
        <div className="p-3 border-b border-zinc-800">
          <span className="text-sm font-semibold text-zinc-200">AI 에이전트</span>
        </div>
        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {loading ? (
            <div className="space-y-2 p-2">
              {[1, 2, 3].map(i => <div key={i} className="h-12 bg-zinc-800 rounded animate-pulse" />)}
            </div>
          ) : runs.length === 0 ? (
            <p className="text-xs text-zinc-600 text-center py-8 px-2">아직 실행 기록이 없습니다</p>
          ) : runs.map((run) => (
            <button
              key={run.id}
              onClick={() => setSelectedRun(run)}
              className={`w-full text-left px-2 py-2 rounded text-sm transition-colors ${
                selectedRun?.id === run.id
                  ? "bg-zinc-700 text-zinc-100"
                  : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
              }`}
            >
              <div className="truncate text-xs font-medium">{run.goal}</div>
              <div className={`text-xs mt-0.5 ${statusColor(run.status)}`}>
                {statusLabel(run.status)} · {run.completed_steps}/{run.total_steps}
              </div>
            </button>
          ))}
        </nav>
      </aside>

      {/* Right panel: Detail + New run */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* New run input */}
        <div className="p-4 border-b border-zinc-800">
          <div className="flex gap-2">
            <input
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleStart()}
              placeholder="에이전트에게 목표를 설명하세요... (예: 코드 리뷰하고 개선사항 정리)"
              disabled={isStarting}
              className="flex-1 px-3 py-2 text-sm bg-zinc-900 border border-zinc-700 rounded focus:border-zinc-500 focus:outline-none placeholder-zinc-600 disabled:opacity-50"
            />
            <button
              onClick={handleStart}
              disabled={isStarting || !goal.trim()}
              className="px-4 py-2 rounded bg-zinc-100 text-zinc-900 hover:bg-white text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              {isStarting ? (
                <span className="flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  실행 중
                </span>
              ) : "실행"}
            </button>
          </div>
          {error && (
            <p className="text-xs text-red-400 mt-2">{error} <button onClick={() => setError(null)} className="underline cursor-pointer">닫기</button></p>
          )}
        </div>

        {/* Run detail */}
        <div className="flex-1 overflow-y-auto p-4">
          {!selectedRun ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-12 h-12 text-zinc-700 mb-3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23-.693L5 14.5m14.8.8l1.402 1.402c1 1 .03 2.798-1.414 2.798H4.212c-1.444 0-2.414-1.798-1.414-2.798L4.2 15.3" />
              </svg>
              <p className="text-zinc-400 text-sm font-medium">위에서 목표를 입력하고 에이전트를 시작하세요</p>
              <p className="text-zinc-600 text-xs mt-1">에이전트가 자동으로 단계를 계획하고 실행합니다</p>
            </div>
          ) : (
            <div>
              {/* Run header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0 mr-4">
                  <h2 className="text-sm font-semibold text-zinc-100 leading-snug">{selectedRun.goal}</h2>
                  <div className="flex items-center gap-3 mt-1">
                    <span className={`text-xs font-medium ${statusColor(selectedRun.status)}`}>
                      {statusLabel(selectedRun.status)}
                    </span>
                    <span className="text-xs text-zinc-500">
                      {selectedRun.completed_steps}/{selectedRun.total_steps} 단계
                    </span>
                    <span className="text-xs text-zinc-500">
                      ${selectedRun.total_cost_usd.toFixed(4)}
                    </span>
                  </div>
                </div>
                {(selectedRun.status === "running" || selectedRun.status === "awaiting_approval") && (
                  <button
                    onClick={() => handleCancel(selectedRun.id)}
                    className="px-2 py-1 rounded border border-zinc-700 text-zinc-400 hover:text-red-400 hover:border-red-800 text-xs transition-colors cursor-pointer flex-shrink-0"
                  >
                    취소
                  </button>
                )}
              </div>

              {/* Progress bar */}
              {selectedRun.total_steps > 0 && (
                <div className="mb-4">
                  <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-zinc-400 rounded-full transition-all"
                      style={{ width: `${(selectedRun.completed_steps / selectedRun.total_steps) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Steps */}
              <div className="space-y-2">
                {selectedRun.steps.map((step) => (
                  <div key={step.id}>
                    <div className="flex items-start gap-2.5 p-3 rounded bg-zinc-900 border border-zinc-800">
                      <StepIcon step={step} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-zinc-200">{step.title}</span>
                          {step.step_type !== "think" && (
                            <span className="text-xs px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">{step.step_type}</span>
                          )}
                        </div>
                        {step.description && (
                          <p className="text-xs text-zinc-500 mt-0.5">{step.description}</p>
                        )}
                        {step.output_text && step.status === "completed" && (
                          <div className="mt-2 p-2 rounded bg-zinc-800/50 text-xs text-zinc-300 leading-relaxed max-h-32 overflow-y-auto">
                            {step.output_text}
                          </div>
                        )}
                        {step.cost_usd > 0 && (
                          <div className="text-xs text-zinc-600 mt-1">${step.cost_usd.toFixed(5)}</div>
                        )}
                      </div>
                    </div>

                    {/* Approval gate inline */}
                    {step.status === "awaiting_approval" && (
                      <ApprovalGateCard
                        step={step}
                        onApprove={(stepId) => handleApprove(selectedRun.id, stepId)}
                        onDeny={(stepId) => handleDeny(selectedRun.id, stepId)}
                      />
                    )}
                  </div>
                ))}
              </div>

              {/* Final output */}
              {selectedRun.status === "completed" && selectedRun.final_output && (
                <div className="mt-4 p-4 rounded-lg bg-zinc-800/30 border border-zinc-700">
                  <h3 className="text-xs font-medium text-zinc-400 uppercase mb-2">최종 결과</h3>
                  <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
                    {selectedRun.final_output}
                  </p>
                </div>
              )}

              {/* Error */}
              {selectedRun.status === "failed" && selectedRun.error_msg && (
                <div className="mt-4 p-3 rounded bg-red-900/20 border border-red-800 text-red-400 text-sm">
                  {selectedRun.error_msg}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
