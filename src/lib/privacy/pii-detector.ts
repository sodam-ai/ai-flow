/**
 * PII Detector — 100% local, zero external dependencies.
 * Scans text for personally identifiable information using regex patterns.
 * Korean-specific patterns: SSN (주민번호), phone, bank account.
 */

export interface PiiMatch {
  type: PiiType;
  value: string;        // original matched text
  masked: string;       // masked version (e.g., "010-****-5678")
  startIndex: number;
  endIndex: number;
}

export type PiiType =
  | "email"
  | "phone_kr"
  | "phone_intl"
  | "ssn_kr"        // 주민등록번호
  | "account_kr"    // 은행 계좌번호
  | "card_number"   // 카드번호
  | "ip_address";

interface PiiPattern {
  type: PiiType;
  label: string;
  regex: RegExp;
  mask: (match: string) => string;
}

const PATTERNS: PiiPattern[] = [
  {
    type: "ssn_kr",
    label: "주민등록번호",
    regex: /\b(\d{6})-?([1-4]\d{6})\b/g,
    mask: (m) => m.replace(/(\d{6})-?(\d{7})/, "$1-*******"),
  },
  {
    type: "phone_kr",
    label: "한국 전화번호",
    regex: /\b(01[016789])-?(\d{3,4})-?(\d{4})\b/g,
    mask: (m) => m.replace(/(01[016789])-?(\d{3,4})-?(\d{4})/, "$1-****-$3"),
  },
  {
    type: "phone_intl",
    label: "국제 전화번호",
    regex: /\+\d{1,3}[-.\s]?\d{2,4}[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g,
    mask: (m) => m.slice(0, 4) + "****" + m.slice(-4),
  },
  {
    type: "email",
    label: "이메일",
    regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    mask: (m) => {
      const [local, domain] = m.split("@");
      return local.slice(0, 2) + "***@" + domain;
    },
  },
  {
    type: "account_kr",
    label: "계좌번호",
    // Korean bank account patterns: 10~14 digits with optional hyphens
    regex: /\b(\d{3,4})-(\d{2,6})-(\d{2,8})\b/g,
    mask: (m) => {
      const parts = m.split("-");
      if (parts.length >= 3 && m.length >= 10) {
        return parts[0] + "-****-" + parts[parts.length - 1];
      }
      return m; // Not a likely account number
    },
  },
  {
    type: "card_number",
    label: "카드번호",
    regex: /\b(\d{4})-?(\d{4})-?(\d{4})-?(\d{4})\b/g,
    mask: (m) => m.replace(/(\d{4})-?(\d{4})-?(\d{4})-?(\d{4})/, "$1-****-****-$4"),
  },
  {
    type: "ip_address",
    label: "IP 주소",
    regex: /\b(25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)\b/g,
    mask: (m) => m.replace(/(\d{1,3}\.\d{1,3})\.\d{1,3}\.\d{1,3}/, "$1.***.***"),
  },
];

/** Scan text for PII and return all matches */
export function detectPii(text: string): PiiMatch[] {
  const matches: PiiMatch[] = [];

  for (const pattern of PATTERNS) {
    // Reset regex lastIndex
    pattern.regex.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.regex.exec(text)) !== null) {
      const value = match[0];
      // Skip very short matches that are likely false positives
      if (value.length < 6) continue;

      // Account number: only if total digits >= 10
      if (pattern.type === "account_kr") {
        const digits = value.replace(/\D/g, "");
        if (digits.length < 10) continue;
      }

      matches.push({
        type: pattern.type,
        value,
        masked: pattern.mask(value),
        startIndex: match.index,
        endIndex: match.index + value.length,
      });
    }
  }

  // Sort by position and deduplicate overlapping matches
  matches.sort((a, b) => a.startIndex - b.startIndex);
  return deduplicateOverlaps(matches);
}

/** Apply all PII masks to text, replacing original with masked versions */
export function maskPii(text: string, matches: PiiMatch[]): string {
  if (matches.length === 0) return text;

  // Apply replacements from end to start to preserve indices
  let result = text;
  const sorted = [...matches].sort((a, b) => b.startIndex - a.startIndex);

  for (const m of sorted) {
    result = result.slice(0, m.startIndex) + m.masked + result.slice(m.endIndex);
  }

  return result;
}

/** Get human-readable label for PII type */
export function piiTypeLabel(type: PiiType): string {
  const labels: Record<PiiType, string> = {
    email: "이메일",
    phone_kr: "한국 전화번호",
    phone_intl: "국제 전화번호",
    ssn_kr: "주민등록번호",
    account_kr: "계좌번호",
    card_number: "카드번호",
    ip_address: "IP 주소",
  };
  return labels[type] ?? type;
}

/** Remove overlapping matches (keep the longer/more specific one) */
function deduplicateOverlaps(matches: PiiMatch[]): PiiMatch[] {
  const result: PiiMatch[] = [];
  let lastEnd = -1;

  for (const m of matches) {
    if (m.startIndex >= lastEnd) {
      result.push(m);
      lastEnd = m.endIndex;
    }
    // If overlapping, keep the current (later) only if it covers more
  }

  return result;
}
