import { useRef, useState, useCallback } from "react";

/**
 * Web Speech API TTS hook.
 * No API key required — uses browser's built-in SpeechSynthesis engine.
 * Works offline in Chromium-based WebView (Tauri default).
 */
export function useTts() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speak = useCallback((text: string) => {
    if (!("speechSynthesis" in window) || !text.trim()) return;

    // Cancel any ongoing speech before starting
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    utterance.onpause = () => setIsSpeaking(false);

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }, []);

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
