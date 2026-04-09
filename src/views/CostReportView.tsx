import { useEffect, useState } from "react";
import { DollarSign, TrendingDown, AlertTriangle, Settings, Loader2, AlertCircle } from "lucide-react";
import {
  getCostReport,
  getBudgetStatus,
  setBudget,
  type CostReport,
  type BudgetStatus,
} from "@/lib/ipc/invoke";
import { useToastStore } from "@/stores/toastStore";

type Period = "week" | "month" | "all";

const PERIOD_LABELS: Record<Period, string> = {
  week:  "7일",
  month: "30일",
  all:   "전체",
};

// Exchange rate fallback — UI display only, not for financial transactions
const FALLBACK_KRW = 1380;

export default function CostReportView() {
  const [period, setPeriod]             = useState<Period>("month");
  const [report, setReport]             = useState<CostReport | null>(null);
  const [budget, setBudgetState]        = useState<BudgetStatus | null>(null);
  const [editBudget, setEditBudget]     = useState(false);
  const [budgetInput, setBudgetInput]   = useState("");
  const [thresholdInput, setThresholdInput] = useState("");
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      getCostReport(period).then(setReport),
      getBudgetStatus().then(setBudgetState),
    ])
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [period]);

  const handleSaveBudget = async () => {
    const usd = parseFloat(budgetInput);
    const pct = parseInt(thresholdInput, 10);
    if (isNaN(usd) || usd < 0 || isNaN(pct) || pct < 0 || pct > 100) return;
    try {
      await setBudget(usd, pct);
      setBudgetState(await getBudgetStatus());
      setEditBudget(false);
      useToastStore.getState().addToast("success", "예산이 업데이트되었습니다");
    } catch (err) {
      useToastStore.getState().addToast("error", String(err));
    }
  };

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
    <div className="flex-1 overflow-y-auto p-6 max-w-3xl space-y-6">

      {/* Page heading */}
      <h1 className="text-xl font-bold flex items-center gap-2 text-zinc-100">
        <DollarSign className="w-5 h-5 text-emerald-400" aria-hidden="true" />
        비용 리포트
      </h1>

      {/* Global error */}
      {error && (
        <div
          role="alert"
          aria-live="assertive"
          className="flex items-start gap-2 p-3 bg-red-950/50 border border-red-800 rounded-lg text-red-400 text-sm"
        >
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {/* Budget Card */}
      {budget && (
        <div
          role={budget.isOverBudget ? "alert" : undefined}
          aria-live={budget.isOverBudget ? "assertive" : undefined}
          aria-label={
            budget.isOverBudget
              ? `예산 초과: $${budget.spentThisMonthUsd.toFixed(4)} / $${budget.monthlyBudgetUsd.toFixed(2)}`
              : `월 예산: $${budget.spentThisMonthUsd.toFixed(4)} / $${budget.monthlyBudgetUsd.toFixed(2)}`
          }
          className={`p-4 rounded-xl border transition-colors ${
            budget.isOverBudget
              ? "border-red-600/50 bg-red-950/20"
              : budget.isOverThreshold
                ? "border-amber-600/50 bg-amber-950/20"
                : "border-zinc-800 bg-zinc-900"
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium flex items-center gap-2 text-zinc-100">
              {budget.isOverBudget && (
                <AlertTriangle className="w-4 h-4 text-red-400" aria-hidden="true" />
              )}
              월 예산
            </div>
            <button
              onClick={() => {
                setEditBudget((prev) => !prev);
                setBudgetInput(budget.monthlyBudgetUsd.toString());
                setThresholdInput(budget.alertThresholdPct.toString());
              }}
              aria-label={editBudget ? "예산 설정 닫기" : "예산 설정 편집"}
              aria-expanded={editBudget}
              className="p-1.5 rounded hover:bg-zinc-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/50"
            >
              <Settings className="w-3.5 h-3.5 text-zinc-500" aria-hidden="true" />
            </button>
          </div>

          {/* Budget progress bar */}
          <div
            role="progressbar"
            aria-valuenow={Math.min(Math.round(budget.usagePct), 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`예산 사용률 ${budget.usagePct.toFixed(1)}%`}
            className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden mb-2"
          >
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                budget.isOverBudget
                  ? "bg-red-500"
                  : budget.isOverThreshold
                    ? "bg-amber-500"
                    : "bg-emerald-500"
              }`}
              style={{ width: `${Math.min(budget.usagePct, 100)}%` }}
              aria-hidden="true"
            />
          </div>

          <div className="flex justify-between text-xs">
            <span className="text-zinc-400 tabular-nums">
              ${budget.spentThisMonthUsd.toFixed(4)} / ${budget.monthlyBudgetUsd.toFixed(2)}
              <span className="text-zinc-600 ml-1">
                ({(budget.spentThisMonthUsd * FALLBACK_KRW).toFixed(0)}원)
              </span>
            </span>
            <span className={`tabular-nums ${budget.isOverThreshold ? "text-amber-400" : "text-zinc-500"}`}>
              {budget.usagePct.toFixed(1)}%
            </span>
          </div>

          {/* Budget edit form */}
          {editBudget && (
            <div className="mt-3 flex items-center gap-2 pt-3 border-t border-zinc-700/50">
              <div>
                <label htmlFor="budget-usd-input" className="sr-only">
                  월 예산 (달러)
                </label>
                <input
                  id="budget-usd-input"
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                  placeholder="월 예산 $"
                  maxLength={10}
                  inputMode="decimal"
                  className="w-24 px-2 py-1 text-xs bg-zinc-800 border border-zinc-700 rounded focus:border-violet-500 focus:outline-none focus-visible:ring-1 focus-visible:ring-violet-500/50"
                />
              </div>
              <div>
                <label htmlFor="budget-threshold-input" className="sr-only">
                  알림 임계값 (%)
                </label>
                <input
                  id="budget-threshold-input"
                  value={thresholdInput}
                  onChange={(e) => setThresholdInput(e.target.value)}
                  placeholder="알림 %"
                  maxLength={3}
                  inputMode="numeric"
                  className="w-16 px-2 py-1 text-xs bg-zinc-800 border border-zinc-700 rounded focus:border-violet-500 focus:outline-none focus-visible:ring-1 focus-visible:ring-violet-500/50"
                />
              </div>
              <button
                onClick={handleSaveBudget}
                aria-label="예산 저장"
                className="px-3 py-1 text-xs bg-zinc-100 text-zinc-900 rounded hover:bg-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300/50"
              >
                저장
              </button>
            </div>
          )}
        </div>
      )}

      {/* Period tabs — role=tablist (controls displayed data) */}
      <div
        role="tablist"
        aria-label="기간 선택"
        className="flex gap-1"
      >
        {(["week", "month", "all"] as const).map((p) => (
          <button
            key={p}
            role="tab"
            aria-selected={period === p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 ${
              period === p
                ? "bg-zinc-100 text-zinc-900 font-medium"
                : "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
            }`}
          >
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {report && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-3" role="list" aria-label="비용 요약">
            <SummaryCard
              label="총 비용"
              value={`$${report.totalCostUsd.toFixed(4)}`}
              sub={`${(report.totalCostUsd * FALLBACK_KRW).toFixed(0)}원`}
            />
            <SummaryCard
              label="메시지"
              value={report.totalMessages.toLocaleString()}
              sub={`평균 $${report.avgCostPerMessage.toFixed(5)}/msg`}
            />
            <SummaryCard
              label="토큰"
              value={((report.totalInputTokens + report.totalOutputTokens) / 1000).toFixed(1) + "K"}
              sub={`입력 ${(report.totalInputTokens/1000).toFixed(0)}K / 출력 ${(report.totalOutputTokens/1000).toFixed(0)}K`}
            />
          </div>

          {/* By Model */}
          <section aria-labelledby="by-model-heading">
            <h2 id="by-model-heading" className="text-sm font-medium text-zinc-400 mb-2 flex items-center gap-2">
              <TrendingDown className="w-4 h-4" aria-hidden="true" />
              모델별 비용
            </h2>
            <ul role="list" className="space-y-1.5">
              {report.byModel.map((m) => {
                const pct = report.totalCostUsd > 0
                  ? (m.totalCostUsd / report.totalCostUsd) * 100
                  : 0;
                return (
                  <li
                    key={`${m.providerId}-${m.modelId}`}
                    aria-label={`${m.providerId} ${m.modelId}: $${m.totalCostUsd.toFixed(4)} (${pct.toFixed(1)}%)`}
                    className="p-3 rounded-lg bg-zinc-900 border border-zinc-800"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-zinc-200">{m.providerId}</span>
                        <span className="text-[10px] text-zinc-500 font-mono">{m.modelId}</span>
                      </div>
                      <span className="text-xs font-mono text-zinc-300 tabular-nums">${m.totalCostUsd.toFixed(4)}</span>
                    </div>

                    <div
                      role="progressbar"
                      aria-valuenow={Math.round(pct)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${m.providerId} ${m.modelId} 비용 비율 ${pct.toFixed(1)}%`}
                      className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden"
                    >
                      <div
                        className="h-full bg-blue-500 rounded-full transition-all duration-300"
                        style={{ width: `${pct}%` }}
                        aria-hidden="true"
                      />
                    </div>

                    <div className="flex justify-between mt-1 text-[10px] text-zinc-500 tabular-nums">
                      <span>{m.messageCount} 메시지</span>
                      <span>{((m.totalInputTokens + m.totalOutputTokens) / 1000).toFixed(0)}K 토큰</span>
                      <span>{pct.toFixed(1)}%</span>
                    </div>
                  </li>
                );
              })}
              {report.byModel.length === 0 && (
                <li>
                  <p role="status" className="text-xs text-zinc-500 text-center py-4">
                    아직 데이터가 없습니다
                  </p>
                </li>
              )}
            </ul>
          </section>

          {/* Daily Chart */}
          <section aria-labelledby="daily-heading">
            <h2 id="daily-heading" className="text-sm font-medium text-zinc-400 mb-2">
              일별 지출
            </h2>
            <ul role="list" className="space-y-1">
              {report.byDay.slice(0, 14).map((d) => {
                const maxCost = Math.max(...report.byDay.map((x) => x.totalCostUsd), 0.001);
                const barPct  = (d.totalCostUsd / maxCost) * 100;
                return (
                  <li
                    key={d.date}
                    className="flex items-center gap-2 text-xs"
                    aria-label={`${d.date}: $${d.totalCostUsd.toFixed(4)}`}
                  >
                    <span className="w-20 text-zinc-500 text-[10px] font-mono shrink-0">
                      {d.date.slice(5)}
                    </span>

                    <div
                      role="progressbar"
                      aria-valuenow={Math.round(barPct)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${d.date} 지출 비율`}
                      className="flex-1 h-4 bg-zinc-900 rounded overflow-hidden"
                    >
                      <div
                        className="h-full bg-emerald-600/60 rounded transition-all duration-200"
                        style={{ width: `${barPct}%` }}
                        aria-hidden="true"
                      />
                    </div>

                    <span className="w-16 text-right text-zinc-400 font-mono text-[10px] tabular-nums shrink-0">
                      ${d.totalCostUsd.toFixed(4)}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}

// ─── Summary Card ─────────────────────────────────────────────────────────────
function SummaryCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div
      role="listitem"
      aria-label={`${label}: ${value}`}
      className="p-3 rounded-xl bg-zinc-900 border border-zinc-800"
    >
      <div className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</div>
      <div className="text-lg font-bold mt-0.5 text-zinc-100 tabular-nums">{value}</div>
      <div className="text-[10px] text-zinc-500 mt-0.5">{sub}</div>
    </div>
  );
}
