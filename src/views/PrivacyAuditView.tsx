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
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-900/40 text-red-400">
        <XCircle className="w-3 h-3" />
        ERROR
      </span>
    );
  }
  if (s === "WARN" || s === "WARNING") {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-900/40 text-amber-400">
        <AlertTriangle className="w-3 h-3" />
        WARN
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-800 text-zinc-500">
      <Info className="w-3 h-3" />
      INFO
    </span>
  );
}

// ─── PII type label ──────────────────────────────────────────────────────────
const PII_LABELS: Record<string, string> = {
  phone: "전화번호",
  email: "이메일",
  ssn: "주민등록번호",
  account: "계좌번호",
  credit_card: "카드번호",
  address: "주소",
  name: "이름",
};

// ─── Privacy Tab ─────────────────────────────────────────────────────────────
function PrivacyTab() {
  const [stats, setStats] = useState<GlobalPrivacyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const s = await getGlobalPrivacyStats();
      setStats(s);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="p-6 space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 rounded-lg bg-zinc-800/50 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-xs text-red-400">
        <XCircle className="w-5 h-5 mx-auto mb-2 opacity-60" />
        로드 실패: {error}
      </div>
    );
  }

  if (!stats || stats.totalDetections === 0) {
    return (
      <div className="p-10 text-center">
        <ShieldCheck className="w-8 h-8 text-emerald-600 mx-auto mb-3" />
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

  return (
    <div className="p-4 space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert className="w-4 h-4 text-amber-500" />
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">총 감지</span>
          </div>
          <div className="text-2xl font-bold text-zinc-100">{stats.totalDetections.toLocaleString()}</div>
          <div className="text-[10px] text-zinc-600 mt-0.5">개인정보 항목</div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <EyeOff className="w-4 h-4 text-emerald-500" />
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">마스킹</span>
          </div>
          <div className="text-2xl font-bold text-emerald-400">{stats.totalMasked.toLocaleString()}</div>
          <div className="text-[10px] text-zinc-600 mt-0.5">보호됨</div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-1">
            <Eye className={`w-4 h-4 ${stats.totalSentUnmasked > 0 ? "text-red-400" : "text-zinc-600"}`} />
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">미마스킹 전송</span>
          </div>
          <div className={`text-2xl font-bold ${stats.totalSentUnmasked > 0 ? "text-red-400" : "text-zinc-500"}`}>
            {stats.totalSentUnmasked.toLocaleString()}
          </div>
          <div className="text-[10px] text-zinc-600 mt-0.5">사용자 선택</div>
        </div>
      </div>

      {/* Masking rate bar */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-zinc-400">마스킹률</span>
          <span className={`text-sm font-bold ${maskRate >= 90 ? "text-emerald-400" : maskRate >= 70 ? "text-amber-400" : "text-red-400"}`}>
            {maskRate}%
          </span>
        </div>
        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${maskRate >= 90 ? "bg-emerald-500" : maskRate >= 70 ? "bg-amber-500" : "bg-red-500"}`}
            style={{ width: `${maskRate}%` }}
          />
        </div>
        <p className="text-[10px] text-zinc-600 mt-1.5">
          {maskRate >= 90 ? "개인정보가 안전하게 보호되고 있습니다" :
           maskRate >= 70 ? "일부 개인정보가 마스킹 없이 전송되었습니다" :
           "많은 개인정보가 마스킹 없이 전송되었습니다"}
        </p>
      </div>

      {/* By type */}
      {stats.byType.length > 0 && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-3 py-2 border-b border-zinc-800">
            <span className="text-xs font-medium text-zinc-400">유형별 감지 현황</span>
          </div>
          <div className="divide-y divide-zinc-800/60">
            {stats.byType.map((s) => {
              const typeRate = s.totalCount > 0 ? Math.round((s.maskedCount / s.totalCount) * 100) : 100;
              return (
                <div key={s.piiType} className="px-3 py-2.5 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-zinc-300">
                        {PII_LABELS[s.piiType] ?? s.piiType}
                      </span>
                      <span className="text-[10px] text-zinc-500">
                        {s.maskedCount}/{s.totalCount} 마스킹
                      </span>
                    </div>
                    <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${typeRate >= 90 ? "bg-emerald-600" : typeRate >= 70 ? "bg-amber-600" : "bg-red-600"}`}
                        style={{ width: `${typeRate}%` }}
                      />
                    </div>
                  </div>
                  <span className={`text-[10px] font-medium w-8 text-right ${typeRate >= 90 ? "text-emerald-500" : typeRate >= 70 ? "text-amber-500" : "text-red-500"}`}>
                    {typeRate}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Audit Tab ───────────────────────────────────────────────────────────────
function AuditTab() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
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
      <div className="p-4 space-y-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-10 rounded bg-zinc-800/50 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center text-xs text-red-400">
        <XCircle className="w-5 h-5 mx-auto mb-2 opacity-60" />
        로드 실패: {error}
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="p-10 text-center">
        <ScrollText className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
        <p className="text-sm font-medium text-zinc-500">감사 이벤트 없음</p>
        <p className="text-xs text-zinc-600 mt-1">앱 사용 시 이벤트가 기록됩니다</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Table header */}
      <div className="sticky top-0 bg-zinc-950 border-b border-zinc-800 px-3 py-2 grid grid-cols-[auto_120px_1fr_100px] gap-2 text-[10px] text-zinc-600 font-medium uppercase tracking-wider">
        <span>ID</span>
        <span>이벤트</span>
        <span>상세</span>
        <span>시간</span>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto divide-y divide-zinc-800/40">
        {entries.map((entry) => (
          <div
            key={entry.id}
            className="px-3 py-2 grid grid-cols-[auto_120px_1fr_100px] gap-2 items-start hover:bg-zinc-800/30 transition-colors"
          >
            <span className="text-[10px] text-zinc-600 font-mono">{entry.id}</span>
            <div className="flex items-center gap-1.5">
              <SeverityBadge severity={entry.severity} />
            </div>
            <div className="min-w-0">
              <div className="text-[11px] text-zinc-300 font-medium font-mono truncate">
                {entry.eventType}
              </div>
              {entry.detail && (
                <div className="text-[10px] text-zinc-600 truncate mt-0.5">
                  {entry.detail}
                </div>
              )}
            </div>
            <span className="text-[10px] text-zinc-600 font-mono">
              {new Date(entry.createdAt).toLocaleString("ko-KR", {
                month: "short", day: "numeric",
                hour: "2-digit", minute: "2-digit",
              })}
            </span>
          </div>
        ))}
      </div>

      {/* Pagination */}
      <div className="border-t border-zinc-800 px-3 py-2 flex items-center justify-between">
        <span className="text-[10px] text-zinc-600">
          페이지 {page + 1} · {entries.length}건
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            aria-label="이전 페이지"
            className="p-1.5 rounded text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 disabled:opacity-30 transition-colors cursor-pointer disabled:cursor-default"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasMore}
            aria-label="다음 페이지"
            className="p-1.5 rounded text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 disabled:opacity-30 transition-colors cursor-pointer disabled:cursor-default"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
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
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
        <div className="flex items-center gap-2.5">
          <Shield className="w-4 h-4 text-emerald-500" />
          <h2 className="text-sm font-semibold text-zinc-100">개인정보 & 감사</h2>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500 font-medium uppercase tracking-wide">
            Read Only
          </span>
        </div>

        {/* Tabs */}
        <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
          <button
            onClick={() => setTab("privacy")}
            aria-pressed={tab === "privacy"}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              tab === "privacy"
                ? "bg-zinc-700 text-zinc-100"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            PII 감지
          </button>
          <button
            onClick={() => setTab("audit")}
            aria-pressed={tab === "audit"}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer ${
              tab === "audit"
                ? "bg-zinc-700 text-zinc-100"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            <ScrollText className="w-3.5 h-3.5" />
            감사 로그
          </button>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {tab === "privacy" ? <PrivacyTab /> : <AuditTab />}
      </div>

      {/* Footer note */}
      <div className="px-4 py-2 border-t border-zinc-800 flex items-center gap-1.5">
        <Info className="w-3 h-3 text-zinc-600 flex-shrink-0" />
        <span className="text-[10px] text-zinc-600">
          감사 로그는 변경 불가 (immutable) · 삭제 및 수정 불가
        </span>
      </div>
    </div>
  );
}
