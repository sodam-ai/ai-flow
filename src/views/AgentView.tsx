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
  isTauri,
} from "@/lib/ipc/invoke";
import DesktopOnly from "@/components/shared/DesktopOnly";
import {
  Brain,
  Globe,
  Link,
  FileText,
  Database,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  SkipForward,
  Loader2,
  Circle,
  ChevronDown,
  ChevronRight,
  Play,
  Square,
  Bot,
  Zap,
} from "lucide-react";

// ─── Tool metadata ─────────────────────────────────────────────────────────

const TOOL_META: Record<
  string,
  { label: string; color: string; bg: string; border: string; Icon: typeof Brain }
> = {
  think:      { label: "분석",   color: "text-violet-300", bg: "bg-violet-900/20", border: "border-violet-700/30", Icon: Brain },
  search_web: { label: "웹검색", color: "text-sky-300",    bg: "bg-sky-900/20",    border: "border-sky-700/30",    Icon: Globe },
  read_url:   { label: "URL읽기",color: "text-cyan-300",   bg: "bg-cyan-900/20",   border: "border-cyan-700/30",   Icon: Link },
  write_file: { label: "파일쓰기",color:"text-amber-300",  bg: "bg-amber-900/20",  border: "border-amber-700/30",  Icon: FileText },
  search_kb:  { label: "KB검색", color: "text-emerald-300",bg: "bg-emerald-900/20",border: "border-emerald-700/30",Icon: Database },
  action:     { label: "실행",   color: "text-zinc-300",   bg: "bg-zinc-800/40",   border: "border-zinc-700/30",   Icon: Zap },
};
const defaultTool = { label: "단계", color: "text-zinc-400", bg: "bg-zinc-800/30", border: "border-zinc-700/20", Icon: Circle };

function getToolMeta(step: AgentStep) {
  return TOOL_META[step.step_type] ?? TOOL_META[step.tool_name ?? ""] ?? defaultTool;
}

// ─── Step status icon ──────────────────────────────────────────────────────

const STEP_STATUS_META: Record<string, { icon: React.ReactNode; label: string }> = {
  completed:         { icon: <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" aria-hidden="true" />, label: "완료" },
  running:           { icon: <Loader2 className="w-4 h-4 text-blue-400 animate-spin flex-shrink-0" aria-hidden="true" />, label: "실행 중" },
  awaiting_approval: { icon: <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" aria-hidden="true" />, label: "승인 대기" },
  failed:            { icon: <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" aria-hidden="true" />, label: "실패" },
  skipped:           { icon: <SkipForward className="w-4 h-4 text-zinc-500 flex-shrink-0" aria-hidden="true" />, label: "건너뜀" },
};
const defaultStepStatus = { icon: <Circle className="w-4 h-4 text-zinc-600 flex-shrink-0" aria-hidden="true" />, label: "대기" };

function StepStatusIcon({ status }: { status: AgentStep["status"] }) {
  const meta = STEP_STATUS_META[status] ?? defaultStepStatus;
  return (
    <>
      {meta.icon}
      <span className="sr-only">{meta.label}</span>
    </>
  );
}

// ─── Step tool metadata badge ──────────────────────────────────────────────

function ToolBadge({ step }: { step: AgentStep }) {
  const meta = getToolMeta(step);
  return (
    <span
      aria-label={meta.label}
      className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-md border ${meta.bg} ${meta.border} ${meta.color}`}
    >
      <meta.Icon className="w-2.5 h-2.5" aria-hidden="true" />
      {meta.label}
    </span>
  );
}

// ─── Step tool args preview ────────────────────────────────────────────────

function ToolArgsPreview({ step }: { step: AgentStep }) {
  if (!step.tool_args) return null;
  try {
    const args = JSON.parse(step.tool_args);
    if (step.step_type === "search_web" && args.query) {
      return (
        <div className="flex items-center gap-1 mt-1">
          <Globe className="w-3 h-3 text-sky-500 flex-shrink-0" aria-hidden="true" />
          <span className="text-xs text-sky-400 truncate">"{args.query}"</span>
        </div>
      );
    }
    if (step.step_type === "read_url" && args.url) {
      return (
        <div className="flex items-center gap-1 mt-1 min-w-0">
          <Link className="w-3 h-3 text-cyan-500 flex-shrink-0" aria-hidden="true" />
          <span className="text-xs text-cyan-400 truncate">{args.url}</span>
        </div>
      );
    }
    if (step.step_type === "write_file" && args.path) {
      return (
        <div className="flex items-center gap-1 mt-1">
          <FileText className="w-3 h-3 text-amber-500 flex-shrink-0" aria-hidden="true" />
          <span className="text-xs text-amber-400 truncate font-mono">{args.path}</span>
        </div>
      );
    }
    if (step.step_type === "search_kb" && args.query) {
      return (
        <div className="flex items-center gap-1 mt-1">
          <Database className="w-3 h-3 text-emerald-500 flex-shrink-0" aria-hidden="true" />
          <span className="text-xs text-emerald-400 truncate">"{args.query}"</span>
        </div>
      );
    }
  } catch {
    // silently ignore parse errors
  }
  return null;
}

// ─── Step card ─────────────────────────────────────────────────────────────

function StepCard({
  step,
  onApprove,
  onDeny,
}: {
  step: AgentStep;
  onApprove?: (stepId: number) => void;
  onDeny?: (stepId: number) => void;
}) {
  const [expanded, setExpanded] = useState(step.status === "awaiting_approval");
  const hasOutput = Boolean(step.output_text) && step.status === "completed";
  const isActive = step.status === "running" || step.status === "awaiting_approval";

  return (
    <div
      role="listitem"
      className={`rounded-lg border transition-colors ${
        isActive
          ? "border-zinc-600 bg-zinc-800/60"
          : step.status === "failed"
          ? "border-red-800/50 bg-red-900/5"
          : step.status === "skipped"
          ? "border-zinc-800 bg-zinc-900/40 opacity-60"
          : "border-zinc-800 bg-zinc-900/60"
      }`}
    >
      {/* Header row */}
      <div className="flex items-start gap-2.5 px-3 py-2.5">
        <div className="mt-0.5">
          <StepStatusIcon status={step.status} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-zinc-200 leading-snug">{step.title}</span>
            <ToolBadge step={step} />
            {step.cost_usd > 0 && (
              <span className="text-[10px] text-zinc-600 ml-auto">${step.cost_usd.toFixed(5)}</span>
            )}
          </div>
          {step.description && (
            <p className="text-xs text-zinc-500 mt-0.5 leading-relaxed line-clamp-2">{step.description}</p>
          )}
          <ToolArgsPreview step={step} />
        </div>

        {/* Expand toggle for output */}
        {hasOutput && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="ml-1 p-0.5 text-zinc-600 hover:text-zinc-400 transition-colors flex-shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500/50 rounded"
            aria-label={expanded ? "결과 접기" : "결과 펼치기"}
            aria-expanded={expanded}
          >
            {expanded ? (
              <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
            )}
          </button>
        )}
      </div>

      {/* Output area */}
      {hasOutput && expanded && (
        <div className="px-3 pb-3">
          <div className="rounded-md bg-zinc-800/60 border border-zinc-700/40 p-2.5 text-xs text-zinc-300 leading-relaxed max-h-40 overflow-y-auto font-mono whitespace-pre-wrap">
            {step.output_text}
          </div>
        </div>
      )}

      {/* Approval gate */}
      {step.status === "awaiting_approval" && onApprove && onDeny && (
        <div className="px-3 pb-3">
          <div role="alert" className="rounded-md border border-amber-700/40 bg-amber-900/10 p-3">
            <p className="text-xs text-amber-300 font-medium mb-1">승인이 필요합니다</p>
            <p className="text-xs text-zinc-400 mb-3 leading-relaxed">
              {step.approval_message || `"${step.title}" 단계를 실행하려면 승인이 필요합니다.`}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => onApprove(step.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-green-700 hover:bg-green-600 text-white text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400"
                aria-label={`"${step.title}" 단계 승인`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                승인
              </button>
              <button
                onClick={() => onDeny(step.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                aria-label={`"${step.title}" 단계 건너뜀`}
              >
                <SkipForward className="w-3.5 h-3.5" aria-hidden="true" />
                건너뜀
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Run status helpers ─────────────────────────────────────────────────────

function statusColor(status: AgentRun["status"]) {
  switch (status) {
    case "completed":        return "text-green-400";
    case "running":          return "text-blue-400";
    case "awaiting_approval":return "text-amber-400";
    case "failed":           return "text-red-400";
    case "cancelled":        return "text-zinc-500";
    default:                 return "text-zinc-400";
  }
}
function statusLabel(status: AgentRun["status"]) {
  switch (status) {
    case "completed":        return "완료";
    case "running":          return "실행 중";
    case "awaiting_approval":return "승인 대기";
    case "failed":           return "실패";
    case "cancelled":        return "취소됨";
    default:                 return status;
  }
}
function statusDot(status: AgentRun["status"]) {
  switch (status) {
    case "completed":        return "bg-green-500";
    case "running":          return "bg-blue-500 animate-pulse";
    case "awaiting_approval":return "bg-amber-500 animate-pulse";
    case "failed":           return "bg-red-500";
    default:                 return "bg-zinc-600";
  }
}

// ─── Tool capability chips ─────────────────────────────────────────────────

const AVAILABLE_TOOLS = [
  { type: "search_web",  Icon: Globe,     label: "웹 검색",  desc: "DuckDuckGo 즉시 답변 검색" },
  { type: "read_url",    Icon: Link,      label: "URL 읽기", desc: "웹 페이지 텍스트 추출 (https)" },
  { type: "write_file",  Icon: FileText,  label: "파일 쓰기",desc: "로컬 파일 생성 (승인 필요)" },
  { type: "search_kb",   Icon: Database,  label: "KB 검색",  desc: "지식베이스 FTS 검색" },
  { type: "think",       Icon: Brain,     label: "분석",     desc: "AI 추론 및 계획" },
];

// ─── Main AgentView ─────────────────────────────────────────────────────────

export default function AgentView() {
  if (!isTauri) return <DesktopOnly label="에이전트는 데스크톱 앱에서만 사용할 수 있습니다" />;
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<AgentRun | null>(null);
  const [goal, setGoal] = useState("");
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showToolsHelp, setShowToolsHelp] = useState(false);

  useEffect(() => { loadRuns(); }, []);

  // Listen for agent lifecycle events
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
      listen<{ run_id: number }>("aiflow://agent-cost-limit", async ({ payload }) => {
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
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  }

  async function handleStart() {
    if (!goal.trim() || isStarting) return;
    setIsStarting(true);
    setError(null);
    try {
      const run = await startAgentRun({ goal: goal.trim() });
      setRuns((prev) => [run, ...prev]);
      setSelectedRun(run);
      setGoal("");
    } catch (e) { setError(String(e)); }
    finally { setIsStarting(false); }
  }

  async function handleApprove(runId: number, stepId: number) {
    try {
      await approveAgentStep({ run_id: runId, step_id: stepId, approved: true });
      const run = await resumeAgentRun(runId);
      setRuns((prev) => prev.map((r) => (r.id === run.id ? run : r)));
      setSelectedRun((prev) => (prev?.id === run.id ? run : prev));
    } catch (e) { setError(String(e)); }
  }

  async function handleDeny(runId: number, stepId: number) {
    try {
      await approveAgentStep({ run_id: runId, step_id: stepId, approved: false });
      const run = await resumeAgentRun(runId);
      setRuns((prev) => prev.map((r) => (r.id === run.id ? run : r)));
      setSelectedRun((prev) => (prev?.id === run.id ? run : prev));
    } catch (e) { setError(String(e)); }
  }

  async function handleCancel(runId: number) {
    try {
      await cancelAgentRun(runId);
      const run = await getAgentRunDetail(runId);
      setRuns((prev) => prev.map((r) => (r.id === run.id ? run : r)));
      setSelectedRun((prev) => (prev?.id === run.id ? run : prev));
    } catch (e) { setError(String(e)); }
  }

  const isRunActive =
    selectedRun?.status === "running" || selectedRun?.status === "awaiting_approval";

  return (
    <div className="flex h-full bg-zinc-950 text-zinc-50">

      {/* ── Left sidebar: run history ────────────────────────────────── */}
      <aside className="w-56 border-r border-zinc-800 flex flex-col flex-shrink-0">
        {/* Header */}
        <div className="h-10 px-3 border-b border-zinc-800 flex items-center gap-2">
          <Bot className="w-3.5 h-3.5 text-violet-400" aria-hidden="true" />
          <span className="text-xs font-semibold text-zinc-200">AI 에이전트</span>
        </div>

        {/* Run list */}
        <nav className="flex-1 overflow-y-auto p-1.5 space-y-0.5 min-h-0" aria-label="에이전트 실행 기록">
          {loading ? (
            <div
              role="status"
              aria-live="polite"
              aria-label="에이전트 기록 로딩 중"
              className="space-y-1.5 p-1.5"
            >
              <p className="sr-only">에이전트 실행 기록을 불러오는 중입니다...</p>
              {[1, 2, 3].map((i) => (
                <div key={i} aria-hidden="true" className="h-14 rounded-md bg-zinc-800/60 animate-pulse" />
              ))}
            </div>
          ) : runs.length === 0 ? (
            <div role="status" className="flex flex-col items-center justify-center py-10 px-3 text-center">
              <Bot className="w-8 h-8 text-zinc-700 mb-2" aria-hidden="true" />
              <p className="text-xs text-zinc-600">실행 기록 없음</p>
            </div>
          ) : (
            runs.map((run) => (
              <button
                key={run.id}
                onClick={() => setSelectedRun(run)}
                aria-current={selectedRun?.id === run.id ? "true" : undefined}
                aria-label={`${run.goal.slice(0, 40)} — ${statusLabel(run.status)}`}
                className={`w-full text-left px-2.5 py-2 rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500/50 ${
                  selectedRun?.id === run.id
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200"
                }`}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${statusDot(run.status)}`} aria-hidden="true" />
                  <span className="text-[11px] font-medium text-zinc-300 truncate flex-1">
                    {run.goal.length > 28 ? run.goal.slice(0, 28) + "…" : run.goal}
                  </span>
                </div>
                <div className="flex items-center justify-between pl-3">
                  <span className={`text-[10px] ${statusColor(run.status)}`}>
                    {statusLabel(run.status)}
                  </span>
                  <span className="text-[10px] text-zinc-600">
                    {run.completed_steps}/{run.total_steps}
                  </span>
                </div>
              </button>
            ))
          )}
        </nav>
      </aside>

      {/* ── Main panel ──────────────────────────────────────────────── */}
      <main className="flex-1 flex flex-col overflow-hidden min-w-0">

        {/* New run input */}
        <div className="px-4 py-3 border-b border-zinc-800 space-y-2">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <label htmlFor="agent-goal-input" className="sr-only">
                에이전트 목표 입력
              </label>
              <input
                id="agent-goal-input"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleStart()}
                placeholder="에이전트에게 목표를 설명하세요… (예: 최신 AI 뉴스 검색해서 요약해줘)"
                disabled={isStarting}
                maxLength={2000}
                aria-describedby={goal.length > 1800 ? "goal-char-count" : undefined}
                className="w-full px-3 py-2 text-sm bg-zinc-900 border border-zinc-700 rounded-lg focus:border-violet-600 focus:ring-1 focus:ring-violet-600/30 focus:outline-none placeholder-zinc-600 disabled:opacity-50 pr-12 transition-colors"
              />
              {goal.length > 1800 && (
                <span
                  id="goal-char-count"
                  aria-live="polite"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-amber-500"
                >
                  {goal.length}/2000
                </span>
              )}
            </div>
            <button
              onClick={handleStart}
              disabled={isStarting || !goal.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white text-sm font-medium transition-colors cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
              aria-label="에이전트 실행"
            >
              {isStarting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
              ) : (
                <Play className="w-3.5 h-3.5" aria-hidden="true" />
              )}
              {isStarting ? "계획 중…" : "실행"}
            </button>
          </div>

          {/* Tool chips */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[10px] text-zinc-600">사용 가능한 도구:</span>
            {AVAILABLE_TOOLS.map((tool) => {
              const meta = TOOL_META[tool.type] ?? defaultTool;
              return (
                <span
                  key={tool.type}
                  aria-label={`${tool.label}: ${tool.desc}`}
                  className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border cursor-default ${meta.bg} ${meta.border} ${meta.color}`}
                >
                  <tool.Icon className="w-2.5 h-2.5" aria-hidden="true" />
                  {tool.label}
                </span>
              );
            })}
            <button
              onClick={() => setShowToolsHelp((v) => !v)}
              className="text-[10px] text-zinc-600 hover:text-zinc-400 underline cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500/50 rounded"
              aria-expanded={showToolsHelp}
              aria-label={showToolsHelp ? "도구 설명 숨기기" : "도구 설명 자세히 보기"}
            >
              {showToolsHelp ? "숨기기" : "자세히"}
            </button>
          </div>

          {showToolsHelp && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 space-y-1.5">
              {AVAILABLE_TOOLS.map((tool) => {
                const meta = TOOL_META[tool.type] ?? defaultTool;
                return (
                  <div key={tool.type} className="flex items-start gap-2">
                    <tool.Icon className={`w-3 h-3 mt-0.5 flex-shrink-0 ${meta.color}`} aria-hidden="true" />
                    <div>
                      <span className={`text-[11px] font-medium ${meta.color}`}>{tool.label}</span>
                      <span className="text-[11px] text-zinc-600"> — {tool.desc}</span>
                    </div>
                  </div>
                );
              })}
              <p className="text-[10px] text-zinc-600 pt-1 border-t border-zinc-800">
                에이전트가 목표에 따라 자동으로 적합한 도구를 선택합니다.
                파일 쓰기는 실행 전 사용자 승인이 필요합니다.
              </p>
            </div>
          )}

          {error && (
            <div
              role="alert"
              aria-live="assertive"
              className="flex items-center gap-2 px-3 py-2 rounded-md bg-red-900/20 border border-red-800/50"
            >
              <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" aria-hidden="true" />
              <p className="text-xs text-red-400 flex-1">{error}</p>
              <button
                onClick={() => setError(null)}
                className="text-xs text-red-500 hover:text-red-300 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-500/50 rounded px-0.5"
                aria-label="오류 닫기"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {/* Run detail */}
        <div className="flex-1 overflow-y-auto p-4 min-h-0">
          {!selectedRun ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3">
              <div className="w-14 h-14 rounded-2xl bg-zinc-800/60 border border-zinc-700/40 flex items-center justify-center">
                <Bot className="w-7 h-7 text-zinc-600" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-400">에이전트를 시작해 보세요</p>
                <p className="text-xs text-zinc-600 mt-1 max-w-xs">
                  목표를 입력하면 AI가 자동으로 단계를 계획하고<br />
                  웹 검색, URL 읽기, 파일 작성 등의 도구를 활용해 실행합니다
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 justify-center mt-1">
                {[
                  "최신 AI 뉴스 검색해서 요약",
                  "Python 비동기 패턴 조사",
                  "README 파일 작성",
                ].map((ex) => (
                  <button
                    key={ex}
                    onClick={() => setGoal(ex)}
                    className="text-xs px-2.5 py-1 rounded-full border border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-violet-500/50"
                  >
                    {ex}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4 max-w-2xl">

              {/* Run header */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h2 className="text-sm font-semibold text-zinc-100 leading-snug">{selectedRun.goal}</h2>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${statusDot(selectedRun.status)}`} aria-hidden="true" />
                      <span className={`text-xs font-medium ${statusColor(selectedRun.status)}`}>
                        {statusLabel(selectedRun.status)}
                      </span>
                    </div>
                    <span className="text-xs text-zinc-600">
                      {selectedRun.completed_steps} / {selectedRun.total_steps} 단계
                    </span>
                    {selectedRun.total_cost_usd > 0 && (
                      <span className="text-xs text-zinc-600">
                        ${selectedRun.total_cost_usd.toFixed(4)}
                      </span>
                    )}
                  </div>
                </div>
                {isRunActive && (
                  <button
                    onClick={() => handleCancel(selectedRun.id)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-zinc-700 text-zinc-400 hover:text-red-400 hover:border-red-800/60 text-xs transition-colors cursor-pointer flex-shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-500/50"
                    aria-label="에이전트 실행 취소"
                  >
                    <Square className="w-3 h-3" aria-hidden="true" />
                    취소
                  </button>
                )}
              </div>

              {/* Progress bar */}
              {selectedRun.total_steps > 0 && (
                <div className="space-y-1">
                  <div
                    role="progressbar"
                    aria-valuenow={selectedRun.completed_steps}
                    aria-valuemin={0}
                    aria-valuemax={selectedRun.total_steps}
                    aria-label="에이전트 진행률"
                    className="h-1 bg-zinc-800 rounded-full overflow-hidden"
                  >
                    <div
                      aria-hidden="true"
                      className={`h-full rounded-full transition-all duration-500 ${
                        selectedRun.status === "failed" ? "bg-red-500" :
                        selectedRun.status === "completed" ? "bg-green-500" : "bg-violet-500"
                      }`}
                      style={{
                        width: `${selectedRun.total_steps > 0
                          ? (selectedRun.completed_steps / selectedRun.total_steps) * 100
                          : 0}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Steps */}
              <div role="list" aria-label="에이전트 실행 단계" className="space-y-1.5">
                {selectedRun.steps.map((step) => (
                  <StepCard
                    key={step.id}
                    step={step}
                    onApprove={
                      step.status === "awaiting_approval"
                        ? (stepId) => handleApprove(selectedRun.id, stepId)
                        : undefined
                    }
                    onDeny={
                      step.status === "awaiting_approval"
                        ? (stepId) => handleDeny(selectedRun.id, stepId)
                        : undefined
                    }
                  />
                ))}
              </div>

              {/* Final output */}
              {selectedRun.status === "completed" && selectedRun.final_output && (
                <div role="region" aria-label="최종 결과" className="rounded-lg border border-zinc-700/60 bg-zinc-800/30 p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 mb-2">
                    최종 결과
                  </p>
                  <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">
                    {selectedRun.final_output}
                  </p>
                </div>
              )}

              {/* Error */}
              {selectedRun.status === "failed" && selectedRun.error_msg && (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="flex items-start gap-2.5 rounded-lg border border-red-800/50 bg-red-900/10 p-3"
                >
                  <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <p className="text-sm text-red-300 leading-relaxed">{selectedRun.error_msg}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
