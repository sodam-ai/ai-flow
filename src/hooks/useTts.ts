import { useRef, useState, useCallback } from "react";

interface TtsConfig {
  /** Speech rate: 0.5 (slow) – 2.0 (fast). Default: 1.0 */
  rate?: number;
}

/**
 * Web Speech API TTS hook.
 * No API key required — uses Chromium's built-in SpeechSynthesis engine.
 * Works offline in Tauri WebView.
 *
 * @param config - Optional config (rate, etc.)
 */
export function useTts(config?: TtsConfig) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speak = useCallback(
    (text: string) => {
      if (!("speechSynthesis" in window) || !text.trim()) return;

      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate   = Math.max(0.5, Math.min(2.0, config?.rate ?? 1.0));
      utterance.pitch  = 1.0;
      utterance.volume = 1.0;

      utterance.onstart  = () => setIsSpeaking(true);
      utterance.onend    = () => setIsSpeaking(false);
      utterance.onerror  = () => setIsSpeaking(false);
      utterance.onpause  = () => setIsSpeaking(false);
      utterance.onresume = () => setIsSpeaking(true);

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [config?.rate],
  );

  const stop = useCallback(() => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  }, []);

  const isSupported =
    typeof window !== "undefined" && "speechSynthesis" in window;

  return { speak, stop, isSpeaking, isSupported };
}
