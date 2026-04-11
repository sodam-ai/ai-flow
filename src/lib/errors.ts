/**
 * toUserMessage — ASVS 7.4.1 / V7 Error Handling
 *
 * Converts any thrown value into a safe, user-facing Korean message.
 * Strips Rust internal paths, OS file paths, and stack traces that
 * could leak application internals to the UI.
 *
 * Usage:
 *   catch (e) { addToast("error", toUserMessage(e)); }
 *   catch (e) { setError(toUserMessage(e)); }
 */

// Known Rust/Tauri error code prefixes → human-readable Korean messages
const KNOWN_CODES: Array<[RegExp, string]> = [
  [/__TAURI__|TAURI_INTERNALS|ipc.*not.*defined|not.*defined.*ipc|reading.*invoke|invoke.*undefined|properties of undefined/i, "데스크톱 앱에서만 사용할 수 있는 기능입니다"],
  [/not found|not_found|NotFound/i, "항목을 찾을 수 없습니다"],
  [/permission denied|PERMISSION_DENIED|forbidden/i, "권한이 없습니다"],
  [/api key|api_key|ApiKey|keychain/i, "API 키를 확인해 주세요"],
  [/network|connection|timeout|ECONNREFUSED/i, "네트워크 연결을 확인해 주세요"],
  [/budget|over_budget/i, "월 예산 한도를 초과했습니다"],
  [/rate limit|rate_limit|429/i, "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요"],
  [/cancelled|canceled/i, "작업이 취소되었습니다"],
  [/invalid|validation|VAL_\d+/i, "입력값을 확인해 주세요"],
  [/database|sqlite|DB_/i, "데이터 처리 중 오류가 발생했습니다"],
  [/AI_001|AI_002|AI_003/i, "AI 응답 중 오류가 발생했습니다"],
];

// Patterns that indicate internal implementation details — strip before display
const SENSITIVE_PATTERNS = [
  // Rust source paths: "at src/commands/chat.rs:142"
  /\bat\s+\S+\.rs:\d+/g,
  // OS file paths (Windows + Unix)
  /[A-Za-z]:\\[^\s,'"]+/g,
  /\/(?:home|Users|var|tmp|opt|usr)\/[^\s,'"]+/g,
  // Stack frames
  /\s+at\s+\w+::\w+/g,
  // Tauri internal error wrappers
  /tauri::Error::/g,
  /\(os error \d+\)/g,
];

export function toUserMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);

  // Check for known error patterns first (most specific wins)
  for (const [pattern, message] of KNOWN_CODES) {
    if (pattern.test(raw)) return message;
  }

  // Strip sensitive implementation details, then trim
  let cleaned = raw;
  for (const re of SENSITIVE_PATTERNS) {
    cleaned = cleaned.replace(re, "");
  }
  cleaned = cleaned.replace(/\s{2,}/g, " ").trim();

  // If nothing meaningful remains after stripping, return generic message
  if (!cleaned || cleaned.length < 4) {
    return "작업 중 오류가 발생했습니다. 다시 시도해 주세요";
  }

  // Cap display length — prevent huge Rust error blobs in the UI
  const MAX_DISPLAY = 120;
  return cleaned.length > MAX_DISPLAY
    ? `${cleaned.slice(0, MAX_DISPLAY)}…`
    : cleaned;
}
