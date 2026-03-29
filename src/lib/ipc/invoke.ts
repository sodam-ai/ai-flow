import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import { Channel } from '@tauri-apps/api/core';
import { z } from 'zod';
import { isIpcError, AiFlowError, type IpcError } from '@/lib/errors';
import type { StreamChunk as StreamChunkType } from './schemas';

/**
 * type-safe invoke 래퍼 — IpcError를 AiFlowError로 변환
 * Tauri command 호출의 단일 진입점
 */
export async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await tauriInvoke<T>(command, args);
  } catch (error) {
    if (isIpcError(error)) {
      throw new AiFlowError(error as IpcError);
    }
    throw error;
  }
}

/**
 * Zod 검증 포함 invoke — 13_ZOD_SCHEMAS.md invokeValidated() 구현
 * 입력: Zod 스키마로 전처리 검증
 * 출력: Zod 스키마로 런타임 타입 안전성 보장
 */
export async function invokeValidated<TIn, TOut>(
  command: string,
  inputSchema: z.ZodType<TIn>,
  outputSchema: z.ZodType<TOut>,
  args: TIn
): Promise<TOut> {
  const validatedInput = inputSchema.parse(args);
  const raw = await invoke(command, validatedInput as Record<string, unknown>);
  return outputSchema.parse(raw);
}

/** AI 스트리밍 청크 타입 — schemas.ts StreamChunkSchema와 동기화 */
export type StreamChunk = StreamChunkType;

export interface StreamAiArgs {
  conversationId: string;
  providerId: string;
  modelId: string;
  messages: Array<{ role: string; content: string }>;
  /** 활성 페르소나 system_prompt — Rust에서 provider별 포맷으로 주입 */
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
}

/**
 * AI 스트리밍 시작 — Tauri Channel 패턴
 * 반환값: stream_id (취소 시 cancel_stream에 전달)
 */
export function streamAi(
  args: StreamAiArgs,
  onChunk: (chunk: StreamChunk) => void
): { streamId: Promise<string>; cancel: () => void } {
  const channel = new Channel<StreamChunk>();
  channel.onmessage = onChunk;

  let currentStreamId: string | null = null;
  let cancelled = false;

  const streamId = invoke<string>('stream_ai_command', {
    request: {
      conversation_id: args.conversationId,
      provider_id: args.providerId,
      model_id: args.modelId,
      messages: args.messages,
      system_prompt: args.systemPrompt ?? null,
      max_tokens: args.maxTokens ?? null,
      temperature: args.temperature ?? null,
    },
    channel,
  }).then((id) => {
    currentStreamId = id;
    if (cancelled && currentStreamId) {
      invoke('cancel_stream', { stream_id: currentStreamId }).catch(console.error);
    }
    return id;
  });

  const cancel = () => {
    cancelled = true;
    if (currentStreamId) {
      invoke('cancel_stream', { stream_id: currentStreamId }).catch(console.error);
    }
  };

  return { streamId, cancel };
}
