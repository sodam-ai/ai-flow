import { useEffect, useState } from "react";
import { GitBranch, Play, Plus, Trash2, ChevronDown, ChevronRight, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import type { Workflow, WorkflowTemplate, WorkflowRun } from "@/types";
import {
  listWorkflows, listWorkflowTemplates, createWorkflow,
  deleteWorkflow, runWorkflow, listWorkflowRuns,
} from "@/lib/ipc/invoke";

const CATEGORY_LABELS: Record<string, string> = {
  writing: "✍️ 글쓰기",
  coding: "💻 코딩",
  translation: "🌐 번역",
  analysis: "📊 분석",
  social: "📱 SNS",
};

const STATUS_ICON = {
  pending:   <Clock size={14} className="text-zinc-400" />,
  running:   <Loader2 size={14} className="text-blue-400 animate-spin" />,
  completed: <CheckCircle2 size={14} className="text-green-400" />,
  failed:    <XCircle size={14} className="text-red-400" />,
};

export default function WorkflowBuilderView() {
  const [tab, setTab] = useState<"mine" | "templates">("mine");
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [expandedRun, setExpandedRun] = useState<number | null>(null);
  const [runInput, setRunInput] = useState("");
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  // 워크플로우 실행 진행 이벤트 수신
  useEffect(() => {
    const unlistens = [
      listen("aiflow://workflow-completed", (_ev: any) => {
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
        name: s.name,
        provider: s.model?.split("-")[0] === "gemini" ? "google" : "anthropic",
        model: s.model ?? "claude-sonnet-4-6",
        user_prompt_template: s.prompt,
      }));
      const wf = await createWorkflow({
        name: tmpl.name,
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
    if (!confirm("이 워크플로우를 삭제하시겠습니까?")) return;
    try {
      await deleteWorkflow(id);
      setWorkflows((prev) => prev.filter((w) => w.id !== id));
      if (selectedWorkflow?.id === id) { setSelectedWorkflow(null); setRuns([]); }
    } catch (e) {
      setError(String(e));
    }
  }

  if (loading) return <div className="flex-1 flex items-center justify-center text-zinc-500">로딩 중...</div>;

  return (
    <div className="flex-1 flex overflow-hidden">
      {/* Left Panel */}
      <div className="w-72 border-r border-zinc-800 flex flex-col">
        {/* Tabs */}
        <div className="flex border-b border-zinc-800">
          {(["mine", "templates"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 px-3 py-2.5 text-sm font-medium transition-colors ${
                tab === t ? "text-violet-400 border-b-2 border-violet-400" : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {t === "mine" ? "내 워크플로우" : "템플릿 15종"}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {tab === "mine" ? (
            <>
              {workflows.length === 0 && (
                <p className="text-xs text-zinc-500 text-center py-8">
                  아직 워크플로우가 없습니다.<br/>
                  템플릿에서 시작해보세요.
                </p>
              )}
              {workflows.map((wf) => (
                <div
                  key={wf.id}
                  onClick={() => handleSelectWorkflow(wf)}
                  className={`group flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                    selectedWorkflow?.id === wf.id
                      ? "bg-violet-600/20 border border-violet-600/30"
                      : "hover:bg-zinc-800"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <GitBranch size={14} className="text-violet-400 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm text-zinc-100 truncate">{wf.name}</p>
                      <p className="text-xs text-zinc-500">{wf.steps.length}단계</p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteWorkflow(wf.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-zinc-700 text-zinc-500 hover:text-red-400 transition"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </>
          ) : (
            // 템플릿 목록 — 카테고리별 그룹화
            Object.entries(
              templates.reduce<Record<string, WorkflowTemplate[]>>((acc, t) => {
                (acc[t.category] ??= []).push(t);
                return acc;
              }, {})
            ).map(([cat, tmplList]) => (
              <div key={cat}>
                <p className="text-xs font-medium text-zinc-500 px-2 py-1.5 uppercase tracking-wider">
                  {CATEGORY_LABELS[cat] ?? cat}
                </p>
                {tmplList.map((tmpl) => (
                  <div
                    key={tmpl.id}
                    onClick={() => handleCreateFromTemplate(tmpl)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer hover:bg-zinc-800 transition-colors"
                    title="클릭하면 이 템플릿으로 워크플로우 생성"
                  >
                    <Plus size={13} className="text-zinc-500 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm text-zinc-200 truncate">{tmpl.name}</p>
                      <p className="text-xs text-zinc-500">{tmpl.steps.length}단계</p>
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Right Panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedWorkflow ? (
          <>
            {/* Workflow Header */}
            <div className="px-6 py-4 border-b border-zinc-800">
              <h2 className="text-base font-semibold text-zinc-100">{selectedWorkflow.name}</h2>
              {selectedWorkflow.description && (
                <p className="text-sm text-zinc-500 mt-0.5">{selectedWorkflow.description}</p>
              )}
              {/* Steps Preview */}
              <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                {selectedWorkflow.steps.map((step, i) => (
                  <span key={step.id} className="flex items-center gap-1">
                    {i > 0 && <ChevronRight size={12} className="text-zinc-600" />}
                    <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-300">{step.name}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Run Input */}
            <div className="px-6 py-4 border-b border-zinc-800 space-y-3">
              <label className="text-xs font-medium text-zinc-400">초기 입력</label>
              <textarea
                value={runInput}
                onChange={(e) => setRunInput(e.target.value)}
                placeholder="워크플로우에 입력할 내용을 여기에 작성하세요..."
                rows={3}
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-600 focus:border-violet-500 focus:outline-none resize-none"
              />
              {error && <p className="text-sm text-red-400">{error}</p>}
              <button
                onClick={handleRunWorkflow}
                disabled={running || !runInput.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
              >
                {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                {running ? "실행 중..." : "워크플로우 실행"}
              </button>
            </div>

            {/* Runs List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">실행 이력</p>
              {runs.length === 0 && (
                <p className="text-sm text-zinc-600 text-center py-8">아직 실행 이력이 없습니다.</p>
              )}
              {runs.map((run) => (
                <div key={run.id} className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
                  <button
                    onClick={() => setExpandedRun(expandedRun === run.id ? null : run.id)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {STATUS_ICON[run.status as keyof typeof STATUS_ICON]}
                      <span className="text-sm text-zinc-300 text-left truncate max-w-64">{run.initial_input}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-zinc-500">${run.total_cost_usd.toFixed(4)}</span>
                      {expandedRun === run.id ? <ChevronDown size={14} className="text-zinc-500" /> : <ChevronRight size={14} className="text-zinc-500" />}
                    </div>
                  </button>
                  {expandedRun === run.id && (
                    <div className="px-4 pb-4 space-y-3 border-t border-zinc-800">
                      {run.step_results.map((step) => (
                        <div key={step.id} className="pt-3">
                          <div className="flex items-center gap-2 mb-1.5">
                            {STATUS_ICON[step.status as keyof typeof STATUS_ICON]}
                            <span className="text-xs font-medium text-zinc-400">단계 {step.step_order + 1}</span>
                          </div>
                          {step.output_text && (
                            <p className="text-sm text-zinc-300 bg-zinc-950 rounded-lg p-3 whitespace-pre-wrap">
                              {step.output_text.slice(0, 500)}{step.output_text.length > 500 ? "..." : ""}
                            </p>
                          )}
                          {step.error_message && (
                            <p className="text-sm text-red-400">{step.error_message}</p>
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
              ))}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8 space-y-4">
            <GitBranch size={40} className="text-zinc-700" />
            <div>
              <p className="text-zinc-400 font-medium">워크플로우를 선택하거나</p>
              <p className="text-zinc-500 text-sm mt-1">템플릿에서 새 워크플로우를 만들어보세요.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
