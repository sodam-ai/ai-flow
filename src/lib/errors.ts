/**
 * AIFlow IPC 에러 타입 — 14_ERROR_CATALOG.md SSOT와 동기화
 * Rust IpcError JSON 구조와 1:1 계약 (06_TEST_SPEC.md §11 contract tests)
 */

export const ERROR_CODES = {
  // AI Provider
  AI_001: 'AI_001',
  AI_002: 'AI_002',
  AI_003: 'AI_003',
  AI_004: 'AI_004',
  AI_005: 'AI_005',
  AI_006: 'AI_006',
  AI_007: 'AI_007',
  AI_008: 'AI_008',
  AI_009: 'AI_009',
  // 인증
  AUTH_001: 'AUTH_001',
  AUTH_002: 'AUTH_002',
  AUTH_003: 'AUTH_003',
  AUTH_004: 'AUTH_004',
  AUTH_006: 'AUTH_006',
  // DB
  DB_001: 'DB_001',
  DB_002: 'DB_002',
  DB_003: 'DB_003',
  // 키체인
  KEYCHAIN_001: 'KEYCHAIN_001',
  KEYCHAIN_002: 'KEYCHAIN_002',
  // 네트워크
  NET_001: 'NET_001',
  NET_002: 'NET_002',
  // 취소
  CANCEL_001: 'CANCEL_001',
  // 시스템
  SYS_001: 'SYS_001',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** IPC 에러 페이로드 — Rust IpcError와 계약 일치 */
export interface IpcError {
  code: ErrorCode;
  message: string;
  detail?: string;
}

export function isIpcError(value: unknown): value is IpcError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value &&
    typeof (value as IpcError).code === 'string' &&
    typeof (value as IpcError).message === 'string'
  );
}

/** 에러 코드별 사용자 메시지 (한국어) */
const USER_MESSAGES: Record<string, string> = {
  AI_001: 'API 키가 설정되지 않았습니다. 설정에서 API 키를 입력해주세요.',
  AI_003: 'AI 서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.',
  AI_004: '대화가 너무 길어 모델 한도를 초과했습니다. 새 대화를 시작해주세요.',
  AI_007: '응답 수신이 중단되었습니다. 네트워크 상태를 확인해주세요.',
  AI_009: '로컬 AI가 실행 중이지 않습니다. Ollama를 시작해주세요.',
  AUTH_001: 'API 키가 올바르지 않습니다. 키를 다시 확인해주세요.',
  NET_001: '인터넷 연결이 없습니다. 네트워크 상태를 확인해주세요.',
  NET_002: '요청 시간이 초과되었습니다. 다시 시도해주세요.',
  KEYCHAIN_001: 'API 키 저장에 실패했습니다. 다시 시도해주세요.',
};

export function getErrorMessage(error: IpcError | unknown): string {
  if (isIpcError(error)) {
    return USER_MESSAGES[error.code] ?? error.message;
  }
  if (error instanceof Error) return error.message;
  return '알 수 없는 오류가 발생했습니다.';
}

export class AiFlowError extends Error {
  constructor(
    public readonly ipcError: IpcError,
    message?: string
  ) {
    super(message ?? getErrorMessage(ipcError));
    this.name = 'AiFlowError';
  }
}
