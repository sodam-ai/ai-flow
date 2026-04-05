import { useState, useRef, useCallback } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { transcribeAudio } from "@/lib/ipc/invoke";

type RecordState = "idle" | "requesting" | "recording" | "processing";

interface Props {
  /** Called with the final transcription text when ready */
  onTranscript: (text: string) => void;
  disabled?: boolean;
  /** ISO 639-1 language hint for Whisper ("ko", "en", "ja", …) */
  language?: string;
}

/**
 * Voice input button using MediaRecorder + OpenAI Whisper API.
 *
 * Recording flow:
 * idle → [click] → requesting (mic permission) → recording → [click/auto]
 * → processing (Whisper API) → idle + onTranscript(text)
 *
 * Security: audio bytes are never written to disk; base64 only exists in
 * memory during the IPC call and is freed immediately after.
 */
export default function VoiceRecordButton({
  onTranscript,
  disabled,
  language,
}: Props) {
  const [recordState, setRecordState] = useState<RecordState>("idle");
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Show a temporary error message, auto-dismiss after 4 s */
  const showError = useCallback((msg: string) => {
    setError(msg);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setError(null), 4000);
  }, []);

  /** Release microphone stream immediately */
  const releaseMic = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const startRecording = useCallback(async () => {
    setError(null);
    setRecordState("requesting");

    // Request microphone with optimal settings for speech recognition
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
    } catch {
      setRecordState("idle");
      showError("Microphone access denied");
      return;
    }

    streamRef.current = stream;
    chunksRef.current = [];

    // Prefer WebM/Opus (native Chromium format, Whisper compatible)
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";

    const recorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      // Release mic immediately — don't hold it during API call
      releaseMic();
      setRecordState("processing");

      try {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        chunksRef.current = [];

        // Guard: skip empty/very short recordings
        if (blob.size < 200) {
          showError("Recording too short — try again");
          setRecordState("idle");
          return;
        }

        // Convert Blob → base64 without using FileReader
        // Chunked to avoid call stack overflow on large buffers
        const arrayBuffer = await blob.arrayBuffer();
        const uint8 = new Uint8Array(arrayBuffer);
        let binary = "";
        const CHUNK = 0x8000;
        for (let i = 0; i < uint8.length; i += CHUNK) {
          binary += String.fromCharCode(...uint8.subarray(i, i + CHUNK));
        }
        const base64 = btoa(binary);

        const text = await transcribeAudio(base64, language, "audio/webm");

        if (text.trim()) {
          onTranscript(text.trim());
        } else {
          showError("No speech detected — try speaking louder");
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("VOICE_014")) {
          showError("OpenAI API key not configured");
        } else if (msg.includes("VOICE_004") || msg.includes("Network")) {
          showError("Network error — check your connection");
        } else {
          showError("Transcription failed");
        }
      } finally {
        setRecordState("idle");
      }
    };

    recorder.onerror = () => {
      releaseMic();
      setRecordState("idle");
      showError("Recording error — try again");
    };

    recorder.start();
    setRecordState("recording");
  }, [language, onTranscript, releaseMic, showError]);

  const handleClick = () => {
    if (disabled || recordState === "requesting" || recordState === "processing")
      return;
    if (recordState === "recording") {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // ── Error tooltip shared across states ──────────────────────────────────
  const errorTooltip = error && (
    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
      <div className="whitespace-nowrap bg-red-950/95 border border-red-800/60 text-red-300 text-[11px] px-2.5 py-1 rounded-lg shadow-lg">
        {error}
      </div>
      {/* Arrow */}
      <div className="mx-auto w-2 h-1 overflow-hidden">
        <div className="w-2 h-2 bg-red-950/95 border-red-800/60 rotate-45 translate-y-[-4px] mx-auto" />
      </div>
    </div>
  );

  // ── Processing state ─────────────────────────────────────────────────────
  if (recordState === "processing") {
    return (
      <div className="relative flex items-center justify-center">
        <button
          disabled
          className="p-2.5 rounded-xl text-violet-400 bg-violet-950/30 cursor-wait"
          title="Transcribing audio…"
          aria-label="Transcribing audio"
        >
          <Loader2 className="w-4 h-4 animate-spin" />
        </button>
        {errorTooltip}
      </div>
    );
  }

  // ── Recording state ──────────────────────────────────────────────────────
  if (recordState === "recording") {
    return (
      <div className="relative flex items-center justify-center">
        {/* Animated pulse ring */}
        <span
          className="absolute w-9 h-9 rounded-full bg-red-500/20 animate-ping pointer-events-none"
          aria-hidden="true"
        />
        <button
          onClick={handleClick}
          className="relative p-2.5 rounded-xl text-red-400 bg-red-950/40 hover:bg-red-950/60 transition-colors"
          title="Stop recording"
          aria-label="Stop recording"
        >
          <MicOff className="w-4 h-4" />
        </button>
        {errorTooltip}
      </div>
    );
  }

  // ── Idle / Requesting state ──────────────────────────────────────────────
  return (
    <div className="relative flex items-center justify-center">
      <button
        onClick={handleClick}
        disabled={disabled || recordState === "requesting"}
        className={`p-2.5 rounded-xl transition-colors ${
          recordState === "requesting"
            ? "text-violet-400 bg-violet-950/20 cursor-wait"
            : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed"
        }`}
        title={
          recordState === "requesting"
            ? "Requesting microphone…"
            : "Voice input (Whisper AI)"
        }
        aria-label="Start voice recording"
      >
        <Mic className="w-4 h-4" />
      </button>
      {errorTooltip}
    </div>
  );
}
