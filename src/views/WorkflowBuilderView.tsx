import { useEffect, useState } from "react";
import {
  GitBranch, Play, Plus, Trash2, ChevronDown, ChevronRight,
  Clock, CheckCircle2, XCircle, Loader2, AlertCircle, Check, X,
} from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import type { Workflow, WorkflowTemplate, WorkflowRun } from "@/types";
import {
  listWorkflows, listWorkflowTemplates, createWorkflow,
  deleteWorkflow, runWorkflow, listWorkflowRuns,
} from "@/lib/ipc/invoke";

const CATEGORY_LABELS: Record<string, string> = {
  writing:     "✍️ 글쓰기",
  coding:      "💻 코딩",
  translation: "🌐 번역",
  analysis:    "📊 분석",
  social:      "📱 SNS",
};

// Status icons — aria-hidden because status is also conveyed via text labels
const STATUS_ICON: Record<string, React.ReactNode> = {
  pending:   <Clock     size={14} className="text-zinc-400"              aria-hidden="true" />,
  running:   <Loader2   size={14} className="text-blue-400 animate-spin" aria-hidden="true" />,
  completed: <CheckCircle2 size={14} className="text-green-400"          aria-hidden="true" />,
  failed:    <XCircle   size={14} className="text-red-400"               aria-hidden="true" />,
};

const STATUS_LABEL: Record<string, string> = {
  pending:   "대기",
  running:   "실행 중",
  completed: "완료",
  failed:    "실패",
};

export default function WorkflowBuilderView() {
  const [tab, setTab]                         = useState<"mine" | "templates">("mine");
  const [workflows, setWorkflows]             = useState<Workflow[]>([]);
  const [templates, setTemplates]             = useState<WorkflowTemplate[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [runs, setRuns]                       = useState<WorkflowRun[]>([]);
  const [expandedRun, setExpandedRun]         = useState<number | null>(null);
  const [runInput, setRunInput]               = useState("");
  const [running, setRunning]                 = useState(false);
  const [loading, setLoading]                 = useState(true);
  const [error, setError]                     = useState<string | null>(null);
  // Inline confirm replaces window.confirm() — OWASP ASVS 5.1.1
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  async function load() {
    try {
      const [wf, tmpl] = await Promise.all([listWorkflows(), listWorkflowTemplates()]);
      setWorkflows(wf);
      setTemplates(tmpl);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const unlistens = [
      listen("aiflow://workflow-completed", () => {
        setRunning(false);
        load();
        if (selectedWorkflow) loadRuns(selectedWorkflow.id);
      }),
      listen("aiflow://workflow-failed", () => { setRunning(false); }),
    ];
    return () => { unlistens.forEach((p) => p.then((fn) => fn())); };
  }, [selectedWorkflow]);

  async function loadRuns(workflowId: number) {
    try {
      setRuns(await listWorkflowRuns(workflowId));
    } catch {}
  }

  async function handleSelectWorkflow(wf: Workflow) {
    setSelectedWorkflow(wf);
    setExpandedRun(null);
    setConfirmDeleteId(null);
    await loadRuns(wf.id);
  }

  async function handleRunWorkflow() {
    if (!selectedWorkflow || !runInput.trim()) return;
    setRunning(true);
    setError(null);
    try {
      await runWorkflow({ workflow_id: selectedWorkflow.id, initial_input: runInput });
    } catch (e) {
      setError(String(e));
      setRunning(false);
    }
  }

  async function handleCreateFromTemplate(tmpl: WorkflowTemplate) {
    try {
      const steps = tmpl.steps.map((s) => ({
        name:                 s.name,
        provider:             s.model?.split("-")[0] === "gemini" ? "google" : "anthropic",
        model:                s.model ?? "claude-sonnet-4-6",
        user_prompt_template: s.prompt,
      }));
      const wf = await createWorkflow({
        name:        tmpl.name,
        description: tmpl.description,
        template_id: tmpl.id,
        steps,
      });
      setWorkflows((prev) => [wf, ...prev]);
      setTab("mine");
      handleSelectWorkflow(wf);
    } catch (e) {
      setError(String(e));
    }
  }

  async function handleDeleteWorkflow(id: number) {
    try {
      await deleteWorkflow(id);
      setWorkflows((prev) => prev.filter((w) => w.id !== id));
      if (selectedWorkflow?.id === id) { setSelectedWorkflow(null); setRuns([]); }
      setConfirmDeleteId(null);
    } catch (e) {
      setError(String(e));
    }
  }

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex-1 flex items-center justify-center gap-2 text-zinc-500 text-sm"
      >
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        로딩 중...
      </div>
    );
  }

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left Panel — Workflow list + Templates */}
      <div className="w-72 border-r border-zinc-800 flex flex-col shrink-0">

        {/* Tab navigation */}
        <div
          role="tablist"
          aria-label="워크플로우 보기 선택"
          className="flex border-b border-zinc-800"
        >
          {(["mine", "templates"] as const).map((t) => (
            <button
              key={t}
              role="tab"
              aria-selected={tab === t}
              aria-controls={`panel-${t}`}
              id={`tab-wf-${t}`}
              onClick={() => setTab(t)}
              className={`flex-1 px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500/50 ${
                tab === t
                  ? "text-violet-400 border-b-2 border-violet-400"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {t === "mine" ? "내 워크플로우" : "템플릿 15종"}
            </button>
          ))}
        </div>

        {/* Global error (shown in sidebar so it's always visible) */}
        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="mx-2 mt-2 flex items-start gap-1.5 p-2 bg-red-950/40 border border-red-800/50 rounded-lg text-red-400 text-xs"
          >
            <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        {/* Mine panel */}
        <div
          id="panel-mine"
          role="tabpanel"
          aria-labelledby="tab-wf-mine"
          hidden={tab !== "mine"}
          className="flex-1 overflow-y-auto p-2 space-y-1"
        >
          {workflows.length === 0 && (
            <p role="status" className="text-xs text-zinc-500 text-center py-8 leading-relaxed">
              아직 워크플로우가 없습니다.<br />
              템플릿에서 시작해보세요.
            </p>
          )}
          <ul role="list" aria-label="내 워크플로우 목록" className="space-y-1">
            {workflows.map((wf) => {
              const isSelected      = selectedWorkflow?.id === wf.id;
              const isConfirming    = confirmDeleteId === wf.id;

              return (
                <li key={wf.id}>
                  <div
                    className={`group flex items-center justify-between px-3 py-2.5 rounded-lg transition-colors ${
                      isSelected
                        ? "bg-violet-600/20 border border-violet-600/30"
                        : "hover:bg-zinc-800 border border-transparent"
                    }`}
                  >
                    {/* Select button */}
                    <button
                      onClick={() => handleSelectWorkflow(wf)}
                      aria-current={isSelected ? "true" : undefined}
                      aria-label={`${wf.name} 워크플로우 열기 (${wf.steps.length}단계)`}
                      className="flex items-center gap-2 min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500/50 rounded"
                    >
                      <GitBranch size={14} className="text-violet-400 shrink-0" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-sm text-zinc-100 truncate">{wf.name}</p>
                        <p className="text-xs text-zinc-500">{wf.steps.length}단계</p>
                      </div>
                    </button>

                    {/* Inline delete confirm (replaces window.confirm) */}
                    {isConfirming ? (
                      <div
                        role="alert"
                        className="flex items-center gap-1 rounded-md bg-red-950/40 border border-red-800/50 px-1.5 py-1 shrink-0"
                      >
                        <span className="text-[10px] text-red-400 mr-0.5">삭제?</span>
                        <button
                          onMouseDown={(e) => { e.preventDefault(); handleDeleteWorkflow(wf.id); }}
                          aria-label={`${wf.name} 삭제 확인`}
                          className="p-0.5 rounded text-red-400 hover:bg-red-900/50 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-red-500"
                        >
                          <Check size={11} aria-hidden="true" />
                        </button>
                        <button
                          onMouseDown={(e) => { e.preventDefault(); setConfirmDeleteId(null); }}
                          aria-label="삭제 취소"
                          className="p-0.5 rounded text-zinc-500 hover:bg-zinc-700 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-500"
                        >
                          <X size={11} aria-hidden="true" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(wf.id); }}
                        aria-label={`${wf.name} 삭제`}
                        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-red-400 transition shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
                      >
                        <Trash2 size={13} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Templates panel */}
        <div
          id="panel-templates"
          role="tabpanel"
          aria-labelledby="tab-wf-templates"
          hidden={tab !== "templates"}
          className="flex-1 overflow-y-auto p-2"
        >
          {Object.entries(
            templates.reduce<Record<string, WorkflowTemplate[]>>((acc, t) => {
              (acc[t.category] ??= []).push(t);
              return acc;
            }, {})
          ).map(([cat, tmplList]) => (
            <div key={cat} className="mb-2">
              <p className="text-xs font-medium text-zinc-500 px-2 py-1.5 uppercase tracking-wider">
                {CATEGORY_LABELS[cat] ?? cat}
              </p>
              <ul role="list" aria-label={`${CATEGORY_LABELS[cat] ?? cat} 템플릿`} className="space-y-0.5">
                {tmplList.map((tmpl) => (
                  <li key={tmpl.id}>
                    <button
                      onClick={() => handleCreateFromTemplate(tmpl)}
                      aria-label={`${tmpl.name} 템플릿으로 워크플로우 만들기 (${tmpl.steps.length}단계)`}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left cursor-pointer hover:bg-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500/50"
                    >
                      <Plus size={13} className="text-zinc-500 shrink-0" aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-sm text-zinc-200 truncate">{tmpl.name}</p>
                        <p className="text-xs text-zinc-500">{tmpl.steps.length}단계</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedWorkflow ? (
          <>
            {/* Workflow Header */}
            <div className="px-6 py-4 border-b border-zinc-800 shrink-0">
              <h1 className="text-base font-semibold text-zinc-100">{selectedWorkflow.name}</h1>
              {selectedWorkflow.description && (
                <p className="text-sm text-zinc-500 mt-0.5">{selectedWorkflow.description}</p>
              )}
              {/* Steps pipeline — visual only, described by heading */}
              <div
                className="flex items-center gap-1.5 mt-3 flex-wrap"
                aria-label="워크플로우 단계 순서"
                role="list"
              >
                {selectedWorkflow.steps.map((step, i) => (
                  <span key={step.id} className="flex items-center gap-1" role="listitem">
                    {i > 0 && <ChevronRight size={12} className="text-zinc-600" aria-hidden="true" />}
                    <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">
                      {step.name}
                    </span>
                  </span>
                ))}
              </div>
            </div>

            {/* Run Input */}
            <div className="px-6 py-4 border-b border-zinc-800 space-y-3 shrink-0">
              <label
                htmlFor="workflow-run-input"
                className="text-xs font-medium text-zinc-400 block"
              >
                초기 입력
              </label>
              <textarea
                id="workflow-run-input"
                value={runInput}
                onChange={(e) => setRunInput(e.target.value)}
                placeholder="워크플로우에 입력할 내용을 여기에 작성하세요..."
                rows={3}
                maxLength={10000}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-600 focus:border-violet-500 focus:outline-none resize-none focus-visible:ring-1 focus-visible:ring-violet-500/50"
              />

              {/* Error — assertive live region */}
              {error && (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="flex items-start gap-1.5 text-sm text-red-400"
                >
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                  <span>{error}</span>
                </div>
              )}

              <button
                onClick={handleRunWorkflow}
                disabled={running || !runInput.trim()}
                aria-label={running ? "워크플로우 실행 중..." : `${selectedWorkflow.name} 워크플로우 실행`}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400/70"
              >
                {running
                  ? <Loader2 size={14} className="animate-spin" aria-hidden="true" />
                  : <Play size={14} aria-hidden="true" />}
                {running ? "실행 중..." : "워크플로우 실행"}
              </button>
            </div>

            {/* Runs List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">실행 이력</p>

              {runs.length === 0 && (
                <p role="status" className="text-sm text-zinc-600 text-center py-8">
                  아직 실행 이력이 없습니다.
                </p>
              )}

              <ul role="list" aria-label="실행 이력 목록" className="space-y-3">
                {runs.map((run) => {
                  const statusLabel = STATUS_LABEL[run.status] ?? run.status;
                  const isExpanded  = expandedRun === run.id;

                  return (
                    <li key={run.id}>
                      <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
                        {/* Expand/collapse toggle */}
                        <button
                          onClick={() => setExpandedRun(isExpanded ? null : run.id)}
                          aria-expanded={isExpanded}
                          aria-label={`${statusLabel} — ${run.initial_input.slice(0, 50)}${run.initial_input.length > 50 ? "..." : ""} 상세 ${isExpanded ? "숨기기" : "보기"}`}
                          className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800/50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-500/50"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {STATUS_ICON[run.status as keyof typeof STATUS_ICON]}
                            <span className="text-sm text-zinc-300 text-left truncate max-w-64">
                              {run.initial_input}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-xs text-zinc-500 tabular-nums font-mono">
                              ${run.total_cost_usd.toFixed(4)}
                            </span>
                            {isExpanded
                              ? <ChevronDown size={14} className="text-zinc-500" aria-hidden="true" />
                              : <ChevronRight size={14} className="text-zinc-500" aria-hidden="true" />}
                          </div>
                        </button>

                        {/* Step results */}
                        {isExpanded && (
                          <div className="px-4 pb-4 space-y-3 border-t border-zinc-800">
                            {run.step_results.map((step) => (
                              <div key={step.id} className="pt-3">
                                <div className="flex items-center gap-2 mb-1.5">
                                  {STATUS_ICON[step.status as keyof typeof STATUS_ICON]}
                                  <span className="text-xs font-medium text-zinc-400">
                                    단계 {step.step_order + 1}
                                    {" "}
                                    <span className="sr-only">
                                      ({STATUS_LABEL[step.status] ?? step.status})
                                    </span>
                                  </span>
                                </div>
                                {step.output_text && (
                                  <p className="text-sm text-zinc-300 bg-zinc-950 rounded-lg p-3 whitespace-pre-wrap">
                                    {step.output_text.slice(0, 500)}
                                    {step.output_text.length > 500 ? "..." : ""}
                                  </p>
                                )}
                                {step.error_message && (
                                  <p
                                    role="alert"
                                    className="text-sm text-red-400 flex items-center gap-1.5"
                                  >
                                    <XCircle size={13} aria-hidden="true" />
                                    {step.error_message}
                                  </p>
                                )}
                              </div>
                            ))}

                            {run.final_output && (
                              <div className="pt-2 border-t border-zinc-800">
                                <p className="text-xs font-medium text-green-400 mb-1.5">최종 결과</p>
                                <p className="text-sm text-zinc-200 bg-zinc-950 rounded-lg p-3 whitespace-pre-wrap">
                                  {run.final_output}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        ) : (
          /* Empty state */
          <div
            role="status"
            className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4"
          >
            <GitBranch size={40} className="text-zinc-700" aria-hidden="true" />
            <div>
              <p className="text-zinc-400 font-medium">워크플로우를 선택하거나</p>
              <p className="text-zinc-500 text-sm mt-1">
                템플릿에서 새 워크플로우를 만들어보세요.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
