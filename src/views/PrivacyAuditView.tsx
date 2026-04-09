import { useEffect, useState, useCallback } from "react";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  ScrollText,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Info,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { getGlobalPrivacyStats, getAuditLog } from "@/lib/ipc/invoke";
import type { GlobalPrivacyStats, AuditEntry } from "@/lib/ipc/invoke";

type Tab = "privacy" | "audit";

const PAGE_SIZE = 50;

// ─── Severity badge ──────────────────────────────────────────────────────────
function SeverityBadge({ severity }: { severity: string }) {
  const s = severity.toUpperCase();
  if (s === "ERROR") {
    return (
      <span
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-900/40 text-red-400"
        aria-label="심각도: 오류"
      >
        <XCircle className="w-3 h-3" aria-hidden="true" />
        ERROR
      </span>
    );
  }
  if (s === "WARN" || s === "WARNING") {
    return (
      <span
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-900/40 text-amber-400"
        aria-label="심각도: 경고"
      >
        <AlertTriangle className="w-3 h-3" aria-hidden="true" />
        WARN
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-800 text-zinc-500"
      aria-label="심각도: 정보"
    >
      <Info className="w-3 h-3" aria-hidden="true" />
      INFO
    </span>
  );
}

// ─── PII type label ──────────────────────────────────────────────────────────
const PII_LABELS: Record<string, string> = {
  phone:       "전화번호",
  email:       "이메일",
  ssn:         "주민등록번호",
  account:     "계좌번호",
  credit_card: "카드번호",
  address:     "주소",
  name:        "이름",
};

// ─── Stat Card ───────────────────────────────────────────────────────────────
function StatCard({
  icon,
  label,
  value,
  sub,
  valueClass = "text-zinc-100",
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub: string;
  valueClass?: string;
}) {
  return (
    // role=figure provides a semantic container; aria-label gives the full context
    <figure
      role="figure"
      aria-label={`${label}: ${value}`}
      className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 space-y-1"
    >
      <div className="flex items-center gap-2">
        {icon}
        <figcaption className="text-[10px] text-zinc-500 uppercase tracking-wider font-medium">
          {label}
        </figcaption>
      </div>
      <div className={`text-2xl font-bold tabular-nums ${valueClass}`}>{value}</div>
      <div className="text-[10px] text-zinc-600">{sub}</div>
    </figure>
  );
}

// ─── Privacy Tab ─────────────────────────────────────────────────────────────
function PrivacyTab() {
  const [stats, setStats] = useState<GlobalPrivacyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStats(await getGlobalPrivacyStats());
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label="PII 통계 로딩 중"
        className="p-6 space-y-3"
      >
        <p className="sr-only">PII 통계를 불러오는 중입니다...</p>
        {[1, 2, 3].map((i) => (
          <div key={i} aria-hidden="true" className="h-14 rounded-lg bg-zinc-800/50 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="p-6 flex flex-col items-center gap-2 text-center text-xs text-red-400"
      >
        <XCircle className="w-5 h-5 opacity-60" aria-hidden="true" />
        <span>로드 실패: {error}</span>
      </div>
    );
  }

  if (!stats || stats.totalDetections === 0) {
    return (
      <div role="status" className="p-10 text-center">
        <ShieldCheck className="w-8 h-8 text-emerald-600 mx-auto mb-3" aria-hidden="true" />
        <p className="text-sm font-medium text-zinc-400">감지된 PII 없음</p>
        <p className="text-xs text-zinc-600 mt-1">
          대화에서 개인정보가 감지되면 여기에 표시됩니다
        </p>
      </div>
    );
  }

  const maskRate = stats.totalDetections > 0
    ? Math.round((stats.totalMasked / stats.totalDetections) * 100)
    : 100;

  const maskRateColor =
    maskRate >= 90 ? "text-emerald-400" :
    maskRate >= 70 ? "text-amber-400"   :
                     "text-red-400";

  const maskBarColor =
    maskRate >= 90 ? "bg-emerald-500" :
    maskRate >= 70 ? "bg-amber-500"   :
                     "bg-red-500";

  const maskRateMsg =
    maskRate >= 90 ? "개인정보가 안전하게 보호되고 있습니다" :
    maskRate >= 70 ? "일부 개인정보가 마스킹 없이 전송되었습니다" :
                     "많은 개인정보가 마스킹 없이 전송되었습니다";

  return (
    <div className="p-4 space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          icon={<ShieldAlert className="w-4 h-4 text-amber-500" aria-hidden="true" />}
          label="총 감지"
          value={stats.totalDetections.toLocaleString()}
          sub="개인정보 항목"
        />
        <StatCard
          icon={<EyeOff className="w-4 h-4 text-emerald-500" aria-hidden="true" />}
          label="마스킹"
          value={stats.totalMasked.toLocaleString()}
          sub="보호됨"
          valueClass="text-emerald-400"
        />
        <StatCard
          icon={
            <Eye
              className={`w-4 h-4 ${stats.totalSentUnmasked > 0 ? "text-red-400" : "text-zinc-600"}`}
              aria-hidden="true"
            />
          }
          label="미마스킹 전송"
          value={stats.totalSentUnmasked.toLocaleString()}
          sub="사용자 선택"
          valueClass={stats.totalSentUnmasked > 0 ? "text-red-400" : "text-zinc-500"}
        />
      </div>

      {/* Masking rate bar — role=progressbar for screen reader */}
      <div
        className="bg-zinc-900 border border-zinc-800 rounded-xl p-3.5 space-y-2"
        aria-label={`마스킹률: ${maskRate}%`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-zinc-400">마스킹률</span>
          <span className={`text-sm font-bold tabular-nums ${maskRateColor}`}>
            {maskRate}%
          </span>
        </div>

        {/* Accessible progress bar */}
        <div
          role="progressbar"
          aria-valuenow={maskRate}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`마스킹률 ${maskRate}%`}
          className="h-2 bg-zinc-800 rounded-full overflow-hidden"
        >
          <div
            className={`h-full rounded-full transition-all duration-500 ${maskBarColor}`}
            style={{ width: `${maskRate}%` }}
            aria-hidden="true"
          />
        </div>

        <p className="text-[10px] text-zinc-500">{maskRateMsg}</p>
      </div>

      {/* By type — semantic list */}
      {stats.byType.length > 0 && (
        <section aria-labelledby="pii-bytype-heading" className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <h3 id="pii-bytype-heading" className="px-3 py-2 border-b border-zinc-800 text-xs font-medium text-zinc-400">
            유형별 감지 현황
          </h3>
          <ul role="list" className="divide-y divide-zinc-800/60">
            {stats.byType.map((s) => {
              const typeRate = s.totalCount > 0
                ? Math.round((s.maskedCount / s.totalCount) * 100)
                : 100;
              const barColor =
                typeRate >= 90 ? "bg-emerald-600" :
                typeRate >= 70 ? "bg-amber-600"   :
                                 "bg-red-600";
              const rateColor =
                typeRate >= 90 ? "text-emerald-500" :
                typeRate >= 70 ? "text-amber-500"   :
                                 "text-red-500";

              return (
                <li
                  key={s.piiType}
                  aria-label={`${PII_LABELS[s.piiType] ?? s.piiType}: ${s.maskedCount}/${s.totalCount} 마스킹 (${typeRate}%)`}
                  className="px-3 py-2.5 flex items-center gap-3"
                >
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-zinc-300">
                        {PII_LABELS[s.piiType] ?? s.piiType}
                      </span>
                      <span className="text-[10px] text-zinc-500 tabular-nums">
                        {s.maskedCount}/{s.totalCount} 마스킹
                      </span>
                    </div>

                    <div
                      role="progressbar"
                      aria-valuenow={typeRate}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${PII_LABELS[s.piiType] ?? s.piiType} 마스킹률`}
                      className="h-1.5 bg-zinc-800 rounded-full overflow-hidden"
                    >
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${barColor}`}
                        style={{ width: `${typeRate}%` }}
                        aria-hidden="true"
                      />
                    </div>
                  </div>

                  <span className={`text-[10px] font-bold w-8 text-right tabular-nums ${rateColor}`}>
                    {typeRate}%
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}

// ─── Audit Tab ───────────────────────────────────────────────────────────────
function AuditTab() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);
  const [page, setPage]       = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const load = useCallback(async (p: number) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getAuditLog(PAGE_SIZE, p * PAGE_SIZE);
      setEntries(data);
      setHasMore(data.length === PAGE_SIZE);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(page); }, [load, page]);

  if (loading) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label="감사 로그 로딩 중"
        className="p-4 space-y-2"
      >
        <p className="sr-only">감사 로그를 불러오는 중입니다...</p>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} aria-hidden="true" className="h-10 rounded bg-zinc-800/50 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div
        role="alert"
        aria-live="assertive"
        className="p-6 flex flex-col items-center gap-2 text-center text-xs text-red-400"
      >
        <XCircle className="w-5 h-5 opacity-60" aria-hidden="true" />
        <span>로드 실패: {error}</span>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div role="status" className="p-10 text-center">
        <ScrollText className="w-8 h-8 text-zinc-700 mx-auto mb-3" aria-hidden="true" />
        <p className="text-sm font-medium text-zinc-500">감사 이벤트 없음</p>
        <p className="text-xs text-zinc-600 mt-1">앱 사용 시 이벤트가 기록됩니다</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {/*
        Semantic <table> — screen readers announce column headers automatically.
        Using table-fixed + col widths mirrors the previous CSS grid layout.
      */}
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-left border-collapse" aria-label="감사 로그">
          <thead className="sticky top-0 z-10 bg-zinc-950 border-b border-zinc-800">
            <tr>
              <th scope="col" className="px-3 py-2 w-12 text-[10px] text-zinc-600 font-medium uppercase tracking-wider">
                ID
              </th>
              <th scope="col" className="px-3 py-2 w-28 text-[10px] text-zinc-600 font-medium uppercase tracking-wider">
                심각도
              </th>
              <th scope="col" className="px-3 py-2 text-[10px] text-zinc-600 font-medium uppercase tracking-wider">
                이벤트 / 상세
              </th>
              <th scope="col" className="px-3 py-2 w-28 text-[10px] text-zinc-600 font-medium uppercase tracking-wider text-right">
                시간
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/40">
            {entries.map((entry) => (
              <tr
                key={entry.id}
                className="hover:bg-zinc-800/30 transition-colors"
              >
                <td className="px-3 py-2 text-[10px] text-zinc-600 font-mono align-top tabular-nums">
                  {entry.id}
                </td>
                <td className="px-3 py-2 align-top">
                  <SeverityBadge severity={entry.severity} />
                </td>
                <td className="px-3 py-2 min-w-0 align-top">
                  <div className="text-[11px] text-zinc-300 font-medium font-mono truncate max-w-xs">
                    {entry.eventType}
                  </div>
                  {entry.detail && (
                    <div className="text-[10px] text-zinc-500 truncate mt-0.5 max-w-xs">
                      {entry.detail}
                    </div>
                  )}
                </td>
                <td className="px-3 py-2 text-[10px] text-zinc-600 font-mono text-right align-top whitespace-nowrap">
                  {new Date(entry.createdAt).toLocaleString("ko-KR", {
                    month: "short", day: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="border-t border-zinc-800 px-3 py-2 flex items-center justify-between shrink-0">
        {/* aria-live="polite" announces page changes to screen readers */}
        <span
          role="status"
          aria-live="polite"
          className="text-[10px] text-zinc-600 tabular-nums"
        >
          페이지 {page + 1} · {entries.length}건
        </span>

        <nav aria-label="감사 로그 페이지 네비게이션" className="flex items-center gap-1">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            aria-label="이전 페이지"
            className="p-1.5 rounded text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 disabled:opacity-30 transition-colors cursor-pointer disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/50"
          >
            <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasMore}
            aria-label="다음 페이지"
            className="p-1.5 rounded text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 disabled:opacity-30 transition-colors cursor-pointer disabled:cursor-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/50"
          >
            <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </nav>
      </div>
    </div>
  );
}

// ─── Main View ───────────────────────────────────────────────────────────────
export default function PrivacyAuditView() {
  const [tab, setTab] = useState<Tab>("privacy");

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2.5">
          <Shield className="w-4 h-4 text-emerald-500" aria-hidden="true" />
          <h1 className="text-sm font-semibold text-zinc-100">개인정보 &amp; 감사</h1>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 font-medium uppercase tracking-wide">
            Read Only
          </span>
        </div>

        {/*
          WCAG ARIA Authoring Practices: Tab pattern
          - role="tablist" wraps all tabs
          - role="tab" + aria-selected + aria-controls on each tab button
          - role="tabpanel" + id + aria-labelledby on each panel
        */}
        <div
          role="tablist"
          aria-label="보기 전환"
          className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-0.5"
        >
          <button
            role="tab"
            id="tab-privacy"
            aria-selected={tab === "privacy"}
            aria-controls="panel-privacy"
            onClick={() => setTab("privacy")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 ${
              tab === "privacy"
                ? "bg-zinc-700 text-zinc-100"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />
            PII 감지
          </button>
          <button
            role="tab"
            id="tab-audit"
            aria-selected={tab === "audit"}
            aria-controls="panel-audit"
            onClick={() => setTab("audit")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 ${
              tab === "audit"
                ? "bg-zinc-700 text-zinc-100"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <ScrollText className="w-3.5 h-3.5" aria-hidden="true" />
            감사 로그
          </button>
        </div>
      </div>

      {/* Tab panels — each always rendered but hidden via hidden attribute (preserves state) */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div
          id="panel-privacy"
          role="tabpanel"
          aria-labelledby="tab-privacy"
          hidden={tab !== "privacy"}
          className="h-full overflow-y-auto"
        >
          {tab === "privacy" && <PrivacyTab />}
        </div>
        <div
          id="panel-audit"
          role="tabpanel"
          aria-labelledby="tab-audit"
          hidden={tab !== "audit"}
          className="h-full flex flex-col min-h-0"
        >
          {tab === "audit" && <AuditTab />}
        </div>
      </div>

      {/* Footer — immutability note */}
      <footer className="px-4 py-2 border-t border-zinc-800 flex items-center gap-1.5 shrink-0">
        <Info className="w-3 h-3 text-zinc-600 flex-shrink-0" aria-hidden="true" />
        <span className="text-[10px] text-zinc-600">
          감사 로그는 변경 불가 (immutable) · 삭제 및 수정 불가
        </span>
      </footer>
    </div>
  );
}
