/**
 * 명령 팔레트 커맨드 정의
 * 대화, 글로벌 액션, 설정 이동 등
 */
import type { Conversation, ProviderId } from '@/types';

export type CommandCategory = 'action' | 'conversation' | 'settings' | 'provider';

export interface PaletteCommand {
  id: string;
  label: string;
  description?: string;
  category: CommandCategory;
  icon: string;
  keywords?: string[];
}

/** 고정 글로벌 커맨드 목록 */
export const GLOBAL_COMMANDS: PaletteCommand[] = [
  {
    id: 'new-chat',
    label: '새 대화',
    description: '새 대화를 시작합니다',
    category: 'action',
    icon: '💬',
    keywords: ['new', 'chat', 'conversation', '새', '대화'],
  },
  {
    id: 'settings',
    label: '설정',
    description: 'API 키 및 앱 설정',
    category: 'settings',
    icon: '⚙️',
    keywords: ['settings', 'config', '설정', 'api key', 'apikey'],
  },
  {
    id: 'provider-openai',
    label: 'OpenAI (GPT-4o)',
    description: 'GPT-4o 모델로 전환',
    category: 'provider',
    icon: '🤖',
    keywords: ['openai', 'gpt', 'gpt-4o', 'chatgpt'],
  },
  {
    id: 'provider-anthropic',
    label: 'Anthropic (Claude)',
    description: 'Claude Sonnet 4.6 모델로 전환',
    category: 'provider',
    icon: '🧠',
    keywords: ['anthropic', 'claude', 'sonnet'],
  },
  {
    id: 'provider-google',
    label: 'Google (Gemini)',
    description: 'Gemini 1.5 Flash 모델로 전환',
    category: 'provider',
    icon: '✨',
    keywords: ['google', 'gemini', 'flash'],
  },
  {
    id: 'provider-ollama',
    label: 'Ollama (로컬)',
    description: '로컬 Ollama 모델로 전환',
    category: 'provider',
    icon: '🖥️',
    keywords: ['ollama', 'local', '로컬'],
  },
];

/** ProviderId → 기본 모델 ID 매핑 */
export const PROVIDER_DEFAULT_MODELS: Record<ProviderId, string> = {
  openai: 'gpt-4o',
  anthropic: 'claude-sonnet-4-6',
  google: 'gemini-2.0-flash',
  ollama: 'llama3.2',
  mistral: 'mistral-large-latest',
  groq: 'llama-3.3-70b-versatile',
  deepseek: 'deepseek-chat',
  cohere: 'command-r-plus-08-2024',
  xai: 'grok-3-mini',
  azure_openai: 'gpt-4o',
  openai_compatible: 'gpt-4o',
};

/** 대화 목록을 PaletteCommand로 변환 */
export function conversationsToCommands(conversations: Conversation[]): PaletteCommand[] {
  return conversations.map((conv) => ({
    id: `conv-${conv.id}`,
    label: conv.title || '새 대화',
    description: `${conv.providerId} • ${conv.modelId}`,
    category: 'conversation' as CommandCategory,
    icon: '🗨️',
    keywords: [conv.title, conv.providerId, conv.modelId],
  }));
}

/** 커맨드 ID에서 conversationId 추출 */
export function getConversationIdFromCommand(commandId: string): string | null {
  if (commandId.startsWith('conv-')) return commandId.slice(5);
  return null;
}

/** 커맨드 ID에서 providerId 추출 */
export function getProviderIdFromCommand(commandId: string): ProviderId | null {
  const map: Record<string, ProviderId> = {
    'provider-openai': 'openai',
    'provider-anthropic': 'anthropic',
    'provider-google': 'google',
    'provider-ollama': 'ollama',
  };
  return map[commandId] ?? null;
}
