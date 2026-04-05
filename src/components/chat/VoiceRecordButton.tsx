import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { transcribeAudio } from "@/lib/ipc/invoke";

type RecordState = "idle" | "requesting" | "recording" | "processing";

/** Maximum recording duration in seconds before auto-stop */
const MAX_DURATION_SEC = 60;

/** Seconds remaining at which to show warning color on timer */
const WARN_THRESHOLD_SEC = 10;

interface Props {
  /** Called with the final transcription text when ready */
  onTranscript: (text: string) => void;
  disabled?: boolean;
  /** ISO 639-1 language hint for Whisper ("ko", "en", "ja", …); "" = auto-detect */
  language?: string;
}

/**
 * Voice input button using MediaRecorder + OpenAI Whisper API.
 *
 * Recording flow:
 * idle → [click] → requesting (mic permission) → recording (max 60s)
 *   → [click or timeout] → processing (Whisper API) → idle + onTranscript(text)
 *
 * Security:
 * - Audio bytes are never written to disk — base64 only in memory during IPC call
 * - Mic stream released immediately after recording stops (not held during API call)
 * - 60s hard limit prevents accidental large uploads (ASVS 4.1.3)
 */
export default function VoiceRecordButton({
  onTranscript,
  disabled,
  language,
}: Props) {
  const [recordState, setRecordState] = useState<RecordState>("idle");
  const [secsLeft, setSecsLeft] = useState(MAX_DURATION_SEC);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Show a temporary error message, auto-dismiss after 4 s */
  const showError = useCallback((msg: string) => {
    setError(msg);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setError(null), 4000);
  }, []);

  /** Clear countdown timers */
  const clearTimers = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
  }, []);

  /** Release microphone stream immediately */
  const releaseMic = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const stopRecording = useCallback(() => {
    clearTimers();
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, [clearTimers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimers();
      releaseMic();
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, [clearTimers, releaseMic]);

  const startRecording = useCallback(async () => {
    setError(null);
    setSecsLeft(MAX_DURATION_SEC);
    setRecordState("requesting");

    // Request mic with optimal speech recognition settings
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

    // WebM/Opus is native to Chromium — Whisper compatible
    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";

    const recorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      // Release mic immediately — don't hold during API call
      releaseMic();
      clearTimers();
      setRecordState("processing");

      try {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        chunksRef.current = [];

        if (blob.size < 200) {
          showError("Recording too short — try again");
          setRecordState("idle");
          return;
        }

        // Convert Blob → base64 (chunked to avoid stack overflow on large buffers)
        const arrayBuffer = await blob.arrayBuffer();
        const uint8 = new Uint8Array(arrayBuffer);
        let binary = "";
        const CHUNK = 0x8000;
        for (let i = 0; i < uint8.length; i += CHUNK) {
          binary += String.fromCharCode(...uint8.subarray(i, i + CHUNK));
        }
        const base64 = btoa(binary);

        // Pass language or null for Whisper auto-detect
        const lang = language && language !== "" ? language : undefined;
        const text = await transcribeAudio(base64, lang, "audio/webm");

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
        } else if (msg.includes("VOICE_002")) {
          showError("Recording too long — max 25 MB");
        } else {
          showError("Transcription failed — try again");
        }
      } finally {
        setRecordState("idle");
        setSecsLeft(MAX_DURATION_SEC);
      }
    };

    recorder.onerror = () => {
      releaseMic();
      clearTimers();
      setRecordState("idle");
      setSecsLeft(MAX_DURATION_SEC);
      showError("Recording error — try again");
    };

    recorder.start();
    setRecordState("recording");

    // Countdown timer — tick every second
    timerIntervalRef.current = setInterval(() => {
      setSecsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerIntervalRef.current!);
          timerIntervalRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Auto-stop at MAX_DURATION_SEC
    autoStopRef.current = setTimeout(() => {
      stopRecording();
    }, MAX_DURATION_SEC * 1000);
  }, [language, onTranscript, releaseMic, clearTimers, stopRecording, showError]);

  const handleClick = () => {
    if (disabled || recordState === "requesting" || recordState === "processing")
      return;
    if (recordState === "recording") {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // ── Shared error tooltip ─────────────────────────────────────────────────
  const errorTooltip = error && (
    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
      <div className="whitespace-nowrap bg-red-950/95 border border-red-800/60 text-red-300 text-[11px] px-2.5 py-1 rounded-lg shadow-lg">
        {error}
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
    const isWarning = secsLeft <= WARN_THRESHOLD_SEC;
    return (
      <div className="relative flex items-center justify-center">
        {/* Animated pulse ring */}
        <span
          className={`absolute w-9 h-9 rounded-full animate-ping pointer-events-none ${
            isWarning ? "bg-orange-500/25" : "bg-red-500/20"
          }`}
          aria-hidden="true"
        />
        <button
          onClick={handleClick}
          className={`relative flex flex-col items-center justify-center p-2.5 rounded-xl transition-colors ${
            isWarning
              ? "text-orange-400 bg-orange-950/40 hover:bg-orange-950/60"
              : "text-red-400 bg-red-950/40 hover:bg-red-950/60"
          }`}
          title={`Stop recording (${secsLeft}s left)`}
          aria-label={`Stop recording, ${secsLeft} seconds remaining`}
        >
          <MicOff className="w-4 h-4" />
          {/* Countdown badge */}
          <span
            className={`absolute -top-1.5 -right-1.5 text-[9px] font-mono font-bold px-1 py-0 rounded-full leading-4 ${
              isWarning
                ? "bg-orange-500 text-white"
                : "bg-red-600/80 text-white"
            }`}
          >
            {secsLeft}
          </span>
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
            : `Voice input — ${language && language !== "" ? language.toUpperCase() : "Auto"}`
        }
        aria-label="Start voice recording"
      >
        <Mic className="w-4 h-4" />
      </button>
      {errorTooltip}
    </div>
  );
}
