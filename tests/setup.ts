import '@testing-library/react';

// Tauri API mock — 테스트 환경에서 invoke() 차단
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
  Channel: vi.fn().mockImplementation(() => ({
    onmessage: null,
  })),
}));
