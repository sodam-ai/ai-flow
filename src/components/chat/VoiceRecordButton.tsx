import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { transcribeAudio } from "@/lib/ipc/invoke";

type RecordState = "idle" | "requesting" | "recording" | "processing";

/** Hard time limit before auto-stop */
const MAX_DURATION_SEC = 60;
/** Orange countdown warning threshold */
const WARN_THRESHOLD_SEC = 10;
/** 0–255 scale — values below this are treated as silence */
const SILENCE_THRESHOLD = 14;
/** Continuous silence duration before auto-stop (ms) */
const SILENCE_DURATION_MS = 2500;
/** Number of waveform bars to render */
const BAR_COUNT = 8;

interface Props {
  /** Called with the final transcription text when ready */
  onTranscript: (text: string) => void;
  disabled?: boolean;
  /** ISO 639-1 language hint for Whisper; "" = auto-detect */
  language?: string;
}

/**
 * Voice input button with live waveform + silence auto-stop.
 *
 * Recording flow:
 *   idle → [click] → requesting → recording (waveform + countdown)
 *     → [click / silence 2.5s / 60s limit] → processing → idle
 *
 * Security:
 * - Audio bytes never written to disk (base64 only in memory during IPC)
 * - Mic stream released immediately after recording stops
 * - ASVS 4.1.3: 60s / 25 MB hard limit
 * - AudioContext closed on unmount (no resource leaks)
 */
export default function VoiceRecordButton({ onTranscript, disabled, language }: Props) {
  const [recordState, setRecordState] = useState<RecordState>("idle");
  const [secsLeft, setSecsLeft]       = useState(MAX_DURATION_SEC);
  const [waveformBars, setWaveformBars] = useState<number[]>(Array(BAR_COUNT).fill(0));
  const [error, setError]             = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef        = useRef<Blob[]>([]);
  const streamRef        = useRef<MediaStream | null>(null);
  const audioCtxRef      = useRef<AudioContext | null>(null);
  const analyserRef      = useRef<AnalyserNode | null>(null);
  const animFrameRef     = useRef<number | null>(null);
  const silenceStartRef  = useRef<number | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoStopRef      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Prevent double-stop from silence detection + manual click racing
  const stoppingRef      = useRef(false);

  const showError = useCallback((msg: string) => {
    setError(msg);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setError(null), 4000);
  }, []);

  const clearTimers = useCallback(() => {
    if (timerIntervalRef.current) { clearInterval(timerIntervalRef.current); timerIntervalRef.current = null; }
    if (autoStopRef.current)      { clearTimeout(autoStopRef.current);       autoStopRef.current = null; }
  }, []);

  const clearAudioContext = useCallback(() => {
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null; }
    if (audioCtxRef.current)  { audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null; }
    analyserRef.current   = null;
    silenceStartRef.current = null;
    setWaveformBars(Array(BAR_COUNT).fill(0));
  }, []);

  const releaseMic = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const stopRecording = useCallback(() => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    clearTimers();
    clearAudioContext();
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, [clearTimers, clearAudioContext]);

  useEffect(() => {
    return () => {
      clearTimers();
      clearAudioContext();
      releaseMic();
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, [clearTimers, clearAudioContext, releaseMic]);

  const startRecording = useCallback(async () => {
    setError(null);
    stoppingRef.current = false;
    setSecsLeft(MAX_DURATION_SEC);
    setRecordState("requesting");

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

    const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
      ? "audio/webm;codecs=opus"
      : "audio/webm";

    const recorder = new MediaRecorder(stream, { mimeType });
    mediaRecorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      releaseMic();
      clearAudioContext();
      clearTimers();
      setRecordState("processing");

      try {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        chunksRef.current = [];

        if (blob.size < 200) {
          showError("Recording too short — try again");
          setRecordState("idle");
          stoppingRef.current = false;
          return;
        }

        const arrayBuffer = await blob.arrayBuffer();
        const uint8 = new Uint8Array(arrayBuffer);
        let binary = "";
        const CHUNK = 0x8000;
        for (let i = 0; i < uint8.length; i += CHUNK) {
          binary += String.fromCharCode(...uint8.subarray(i, i + CHUNK));
        }
        const base64 = btoa(binary);

        const lang = language && language !== "" ? language : undefined;
        const text = await transcribeAudio(base64, lang, "audio/webm");

        if (text.trim()) {
          onTranscript(text.trim());
        } else {
          showError("No speech detected — try speaking louder");
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("VOICE_014"))      showError("OpenAI API key not configured");
        else if (msg.includes("VOICE_004")) showError("Network error — check connection");
        else if (msg.includes("VOICE_002")) showError("Recording too long (max 25 MB)");
        else                                showError("Transcription failed — try again");
      } finally {
        setRecordState("idle");
        setSecsLeft(MAX_DURATION_SEC);
        stoppingRef.current = false;
      }
    };

    recorder.onerror = () => {
      releaseMic();
      clearAudioContext();
      clearTimers();
      setRecordState("idle");
      setSecsLeft(MAX_DURATION_SEC);
      stoppingRef.current = false;
      showError("Recording error — try again");
    };

    recorder.start();
    setRecordState("recording");

    // ── AudioContext — waveform + silence detection ───────────────────────
    try {
      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const source  = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const bufLen = analyser.frequencyBinCount;
      const freqData = new Uint8Array(bufLen);

      const animate = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(freqData);

        // Waveform bars: sample evenly across frequency bins
        const step = Math.floor(bufLen / BAR_COUNT);
        const bars = Array.from({ length: BAR_COUNT }, (_, i) =>
          freqData[i * step] / 255
        );
        setWaveformBars(bars);

        // Silence detection: average amplitude across all bins
        const avg = freqData.reduce((s, v) => s + v, 0) / bufLen;
        if (avg < SILENCE_THRESHOLD) {
          if (silenceStartRef.current === null) {
            silenceStartRef.current = Date.now();
          } else if (Date.now() - silenceStartRef.current > SILENCE_DURATION_MS) {
            // Cancel animation first to prevent re-entry
            cancelAnimationFrame(animFrameRef.current!);
            animFrameRef.current = null;
            stopRecording();
            return;
          }
        } else {
          silenceStartRef.current = null;
        }

        animFrameRef.current = requestAnimationFrame(animate);
      };
      animFrameRef.current = requestAnimationFrame(animate);
    } catch {
      // AudioContext unavailable — waveform/silence detection disabled,
      // recording continues normally without those features
    }

    // ── Countdown timer ───────────────────────────────────────────────────
    timerIntervalRef.current = setInterval(() => {
      setSecsLeft((prev) => {
        if (prev <= 1) { clearInterval(timerIntervalRef.current!); timerIntervalRef.current = null; return 0; }
        return prev - 1;
      });
    }, 1000);

    autoStopRef.current = setTimeout(() => stopRecording(), MAX_DURATION_SEC * 1000);
  }, [language, onTranscript, releaseMic, clearTimers, clearAudioContext, stopRecording, showError]);

  // Global keyboard shortcut (Alt+Shift+V) → start recording
  // Must be declared after startRecording to satisfy TypeScript's block-scope rules
  useEffect(() => {
    const handler = () => {
      if (!disabled && recordState === "idle") startRecording();
    };
    window.addEventListener("aiflow:voice-start", handler);
    return () => window.removeEventListener("aiflow:voice-start", handler);
  }, [disabled, recordState, startRecording]);

  const handleClick = () => {
    if (disabled || recordState === "requesting" || recordState === "processing") return;
    if (recordState === "recording") stopRecording();
    else startRecording();
  };

  // ── Error tooltip ────────────────────────────────────────────────────────
  const errorTooltip = error && (
    <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
      <div
        role="alert"
        aria-live="assertive"
        className="whitespace-nowrap bg-red-950/95 border border-red-800/60 text-red-300 text-[11px] px-2.5 py-1 rounded-lg shadow-lg"
      >
        {error}
      </div>
    </div>
  );

  // ── Processing ───────────────────────────────────────────────────────────
  if (recordState === "processing") {
    return (
      <div className="relative flex items-center justify-center">
        <button disabled className="p-2.5 rounded-xl text-violet-400 bg-violet-950/30 cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50" aria-label="음성 변환 중…">
          <Loader2 className="w-4 h-4 animate-spin" />
        </button>
        {errorTooltip}
      </div>
    );
  }

  // ── Recording — waveform pill + stop button ──────────────────────────────
  if (recordState === "recording") {
    const isWarning = secsLeft <= WARN_THRESHOLD_SEC;
    const color = isWarning
      ? { ring: "border-orange-800/50", bg: "bg-orange-950/30", bar: "bg-orange-400/80", btn: "text-orange-400 bg-orange-950/40 hover:bg-orange-950/60 border-orange-800/50", badge: "bg-orange-500" }
      : { ring: "border-red-800/50",    bg: "bg-red-950/30",    bar: "bg-red-400/80",    btn: "text-red-400 bg-red-950/40 hover:bg-red-950/60 border-red-800/50",       badge: "bg-red-600/90" };

    return (
      <div className="relative flex items-center">
        {/* Waveform panel */}
        <div className={`flex items-center gap-[3px] px-2.5 h-9 ${color.bg} border ${color.ring} border-r-0 rounded-l-xl`} aria-hidden="true">
          {waveformBars.map((v, i) => (
            <div
              key={i}
              className={`w-[3px] rounded-full ${color.bar} transition-all duration-75`}
              style={{ height: `${Math.max(3, Math.round(v * 22))}px` }}
            />
          ))}
        </div>

        {/* Stop button */}
        <button
          onClick={handleClick}
          className={`relative flex items-center justify-center w-9 h-9 border ${color.btn} border-l-0 rounded-r-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-orange-400/70`}
          aria-label={`녹음 중지, ${secsLeft}초 남음`}
        >
          <MicOff className="w-3.5 h-3.5" />
          <span className={`absolute -top-1.5 -right-1.5 text-[9px] font-mono font-bold px-1 rounded-full leading-4 text-white ${color.badge}`}>
            {secsLeft}
          </span>
        </button>
        {errorTooltip}
      </div>
    );
  }

  // ── Idle / Requesting ────────────────────────────────────────────────────
  return (
    <div className="relative flex items-center justify-center">
      <button
        onClick={handleClick}
        disabled={disabled || recordState === "requesting"}
        className={`p-2.5 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 ${
          recordState === "requesting"
            ? "text-violet-400 bg-violet-950/20 cursor-wait"
            : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed"
        }`}
        aria-label={
          recordState === "requesting"
            ? "마이크 권한 요청 중…"
            : `음성 입력 시작${language && language !== "" ? ` (${language.toUpperCase()})` : ""}`
        }
      >
        <Mic className="w-4 h-4" />
      </button>
      {errorTooltip}
    </div>
  );
}
