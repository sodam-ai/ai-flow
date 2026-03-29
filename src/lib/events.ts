/**
 * AIFlow 멀티 윈도우 이벤트 상수 — 04_PROJECT_SPEC.md A-3 멀티 윈도우 통신
 * Rust에서 emit_to(label, event) 할 때 사용하는 이벤트 이름과 동기화
 */

export const EVENTS = {
  /** 네트워크 상태 변경 (main → overlay) */
  NETWORK_STATUS: 'aiflow://network-status',
  /** 오버레이 창 토글 (main → overlay) */
  OVERLAY_TOGGLE: 'aiflow://overlay-toggle',
  /** AI 스트리밍 완료 (Rust → main) */
  STREAM_DONE: 'aiflow://stream-done',
  /** 비용 업데이트 (Rust → main) */
  COST_UPDATE: 'aiflow://cost-update',
  /** 단축키 트리거 (Rust → main) */
  SHORTCUT_TRIGGER: 'aiflow://shortcut-trigger',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS];
