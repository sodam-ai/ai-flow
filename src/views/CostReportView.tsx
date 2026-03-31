import { useEffect, useState } from "react";
import { DollarSign, TrendingDown, AlertTriangle, Settings } from "lucide-react";
import {
  getCostReport,
  getBudgetStatus,
  setBudget,
  type CostReport,
  type BudgetStatus,
} from "@/lib/ipc/invoke";
import { useToastStore } from "@/stores/toastStore";

export default function CostReportView() {
  const [period, setPeriod] = useState<"week" | "month" | "all">("month");
  const [report, setReport] = useState<CostReport | null>(null);
  const [budget, setBudgetState] = useState<BudgetStatus | null>(null);
  const [editBudget, setEditBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState("");
  const [thresholdInput, setThresholdInput] = useState("");

  useEffect(() => {
    getCostReport(period).then(setReport).catch(() => {});
    getBudgetStatus().then(setBudgetState).catch(() => {});
  }, [period]);

  const handleSaveBudget = async () => {
    const usd = parseFloat(budgetInput);
    const pct = parseInt(thresholdInput);
    if (isNaN(usd) || isNaN(pct)) return;
    try {
      await setBudget(usd, pct);
      const updated = await getBudgetStatus();
      setBudgetState(updated);
      setEditBudget(false);
      useToastStore.getState().addToast("success", "Budget updated");
    } catch (err) {
      useToastStore.getState().addToast("error", String(err));
    }
  };

  const FALLBACK_KRW = 1380;

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-3xl">
      <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
        <DollarSign className="w-5 h-5" />
        Cost Report
      </h2>

      {/* Budget Card */}
      {budget && (
        <div className={`mb-6 p-4 rounded-xl border ${
          budget.isOverBudget
            ? "border-red-600/50 bg-red-950/20"
            : budget.isOverThreshold
              ? "border-amber-600/50 bg-amber-950/20"
              : "border-zinc-800 bg-zinc-900"
        }`}>
          <div className="flex items-center justify-between mb-3">
            <div className="text-sm font-medium flex items-center gap-2">
              {budget.isOverBudget && <AlertTriangle className="w-4 h-4 text-red-400" />}
              Monthly Budget
            </div>
            <button
              onClick={() => {
                setEditBudget(!editBudget);
                setBudgetInput(budget.monthlyBudgetUsd.toString());
                setThresholdInput(budget.alertThresholdPct.toString());
              }}
              className="p-1 hover:bg-zinc-800 rounded"
            >
              <Settings className="w-3.5 h-3.5 text-zinc-500" />
            </button>
          </div>

          {/* Progress bar */}
          <div className="w-full h-3 bg-zinc-800 rounded-full overflow-hidden mb-2">
            <div
              className={`h-full rounded-full transition-all ${
                budget.isOverBudget
                  ? "bg-red-500"
                  : budget.isOverThreshold
                    ? "bg-amber-500"
                    : "bg-emerald-500"
              }`}
              style={{ width: `${Math.min(budget.usagePct, 100)}%` }}
            />
          </div>

          <div className="flex justify-between text-xs">
            <span className="text-zinc-400">
              ${budget.spentThisMonthUsd.toFixed(4)} / ${budget.monthlyBudgetUsd.toFixed(2)}
              <span className="text-zinc-600 ml-1">
                ({(budget.spentThisMonthUsd * FALLBACK_KRW).toFixed(0)}원)
              </span>
            </span>
            <span className={budget.isOverThreshold ? "text-amber-400" : "text-zinc-500"}>
              {budget.usagePct.toFixed(1)}%
            </span>
          </div>

          {editBudget && (
            <div className="mt-3 flex items-center gap-2">
              <input
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                placeholder="Monthly $"
                className="w-24 px-2 py-1 text-xs bg-zinc-800 border border-zinc-700 rounded"
              />
              <input
                value={thresholdInput}
                onChange={(e) => setThresholdInput(e.target.value)}
                placeholder="Alert %"
                className="w-16 px-2 py-1 text-xs bg-zinc-800 border border-zinc-700 rounded"
              />
              <button
                onClick={handleSaveBudget}
                className="px-3 py-1 text-xs bg-zinc-100 text-zinc-900 rounded"
              >
                Save
              </button>
            </div>
          )}
        </div>
      )}

      {/* Period Tabs */}
      <div className="flex gap-1 mb-4">
        {(["week", "month", "all"] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
              period === p
                ? "bg-zinc-100 text-zinc-900"
                : "text-zinc-400 hover:bg-zinc-800"
            }`}
          >
            {p === "week" ? "7 Days" : p === "month" ? "30 Days" : "All Time"}
          </button>
        ))}
      </div>

      {report && (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <SummaryCard
              label="Total Cost"
              value={`$${report.totalCostUsd.toFixed(4)}`}
              sub={`${(report.totalCostUsd * FALLBACK_KRW).toFixed(0)}원`}
            />
            <SummaryCard
              label="Messages"
              value={report.totalMessages.toLocaleString()}
              sub={`avg $${report.avgCostPerMessage.toFixed(5)}/msg`}
            />
            <SummaryCard
              label="Tokens"
              value={((report.totalInputTokens + report.totalOutputTokens) / 1000).toFixed(1) + "K"}
              sub={`in: ${(report.totalInputTokens/1000).toFixed(0)}K / out: ${(report.totalOutputTokens/1000).toFixed(0)}K`}
            />
          </div>

          {/* By Model */}
          <section className="mb-6">
            <h3 className="text-sm font-medium text-zinc-400 mb-2 flex items-center gap-2">
              <TrendingDown className="w-4 h-4" />
              Cost by Model
            </h3>
            <div className="space-y-1.5">
              {report.byModel.map((m) => {
                const pct = report.totalCostUsd > 0
                  ? (m.totalCostUsd / report.totalCostUsd) * 100
                  : 0;
                return (
                  <div key={`${m.providerId}-${m.modelId}`} className="p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">{m.providerId}</span>
                        <span className="text-[10px] text-zinc-500">{m.modelId}</span>
                      </div>
                      <span className="text-xs font-mono">${m.totalCostUsd.toFixed(4)}</span>
                    </div>
                    <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1 text-[10px] text-zinc-500">
                      <span>{m.messageCount} msgs</span>
                      <span>{((m.totalInputTokens + m.totalOutputTokens) / 1000).toFixed(0)}K tok</span>
                      <span>{pct.toFixed(1)}%</span>
                    </div>
                  </div>
                );
              })}
              {report.byModel.length === 0 && (
                <p className="text-xs text-zinc-500 text-center py-4">No data yet</p>
              )}
            </div>
          </section>

          {/* Daily Chart (simple bar representation) */}
          <section className="mb-6">
            <h3 className="text-sm font-medium text-zinc-400 mb-2">Daily Spending</h3>
            <div className="space-y-1">
              {report.byDay.slice(0, 14).map((d) => {
                const maxCost = Math.max(...report.byDay.map((x) => x.totalCostUsd), 0.001);
                const barPct = (d.totalCostUsd / maxCost) * 100;
                return (
                  <div key={d.date} className="flex items-center gap-2 text-xs">
                    <span className="w-20 text-zinc-500 text-[10px] font-mono">{d.date.slice(5)}</span>
                    <div className="flex-1 h-4 bg-zinc-900 rounded overflow-hidden">
                      <div
                        className="h-full bg-emerald-600/60 rounded"
                        style={{ width: `${barPct}%` }}
                      />
                    </div>
                    <span className="w-16 text-right text-zinc-400 font-mono text-[10px]">
                      ${d.totalCostUsd.toFixed(4)}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="p-3 rounded-xl bg-zinc-900 border border-zinc-800">
      <div className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</div>
      <div className="text-lg font-bold mt-0.5">{value}</div>
      <div className="text-[10px] text-zinc-500 mt-0.5">{sub}</div>
    </div>
  );
}
