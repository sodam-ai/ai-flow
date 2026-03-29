import { useState, type FormEvent } from 'react';
import { useSettingsStore } from '@/stores/settingsStore';
import { getErrorMessage } from '@/lib/errors';
import type { ProviderId } from '@/types';

const PROVIDERS: { id: ProviderId; name: string; placeholder: string }[] = [
  { id: 'openai', name: 'OpenAI', placeholder: 'sk-proj-...' },
  { id: 'anthropic', name: 'Anthropic', placeholder: 'sk-ant-...' },
  { id: 'google', name: 'Google AI', placeholder: 'AIza...' },
  { id: 'ollama', name: 'Ollama (로컬)', placeholder: 'http://localhost:11434' },
];

export default function SettingsView() {
  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-2xl mx-auto w-full">
      <h2 className="text-lg font-semibold mb-6">API 키 설정</h2>
      <p className="text-sm text-[hsl(var(--muted-foreground))] mb-6">
        API 키는 Windows Credential Manager에 안전하게 저장됩니다.
        앱 데이터베이스나 네트워크로 전송되지 않습니다.
      </p>
      <div className="space-y-4">
        {PROVIDERS.map((p) => (
          <ProviderKeyRow key={p.id} providerId={p.id} name={p.name} placeholder={p.placeholder} />
        ))}
      </div>
    </div>
  );
}

function ProviderKeyRow({
  providerId,
  name,
  placeholder,
}: {
  providerId: ProviderId;
  name: string;
  placeholder: string;
}) {
  const { apiKeyStatuses, setApiKey, deleteApiKey } = useSettingsStore();
  const status = apiKeyStatuses[providerId];
  const [inputKey, setInputKey] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSave = async (e: FormEvent) => {
    e.preventDefault();
    if (!inputKey.trim()) return;

    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      await setApiKey(providerId, inputKey.trim());
      setInputKey('');
      setIsEditing(false);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`${name} API 키를 삭제하시겠습니까?`)) return;
    setError(null);
    try {
      await deleteApiKey(providerId);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  };

  return (
    <div className="border border-[hsl(var(--border))] rounded-lg p-4 bg-[hsl(var(--card))]">
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="font-medium text-sm">{name}</span>
          {status?.isSet && status.maskedPreview && (
            <span className="ml-2 text-xs text-[hsl(var(--muted-foreground))] font-mono">
              {status.maskedPreview}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {status?.isSet ? (
            <>
              <span className="text-xs text-green-500 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                연결됨
              </span>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="text-xs px-2 py-1 rounded border border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))] transition-colors"
              >
                변경
              </button>
              <button
                onClick={handleDelete}
                className="text-xs px-2 py-1 rounded border border-red-800 text-red-400 hover:bg-red-900/20 transition-colors"
              >
                삭제
              </button>
            </>
          ) : (
            <span className="text-xs text-[hsl(var(--muted-foreground))]">미설정</span>
          )}
          {success && (
            <span className="text-xs text-green-500">저장 완료</span>
          )}
        </div>
      </div>

      {/* 키 입력 폼 — 미설정이거나 변경 모드일 때 표시 */}
      {(!status?.isSet || isEditing) && (
        <form onSubmit={handleSave} className="flex gap-2">
          <input
            type="password"
            value={inputKey}
            onChange={(e) => setInputKey(e.target.value)}
            placeholder={placeholder}
            autoComplete="off"
            className="flex-1 bg-[hsl(var(--input))] border border-[hsl(var(--border))] rounded px-3 py-1.5 text-sm font-mono outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
          />
          <button
            type="submit"
            disabled={isSaving || !inputKey.trim()}
            className="px-3 py-1.5 rounded bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-xs font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? '저장 중...' : '저장'}
          </button>
          {isEditing && (
            <button
              type="button"
              onClick={() => { setIsEditing(false); setInputKey(''); }}
              className="px-3 py-1.5 rounded border border-[hsl(var(--border))] text-xs hover:bg-[hsl(var(--accent))]"
            >
              취소
            </button>
          )}
        </form>
      )}

      {error && (
        <p className="mt-2 text-xs text-red-400">{error}</p>
      )}
    </div>
  );
}
