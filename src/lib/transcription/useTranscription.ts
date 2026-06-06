"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Minimal typings for the (non-standard) Web Speech API.
interface SpeechRecognitionAlternative {
  transcript: string;
}
interface SpeechRecognitionResult {
  isFinal: boolean;
  0: SpeechRecognitionAlternative;
}
interface SpeechRecognitionEvent {
  resultIndex: number;
  results: { length: number; [index: number]: SpeechRecognitionResult };
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface TranscriptSegment {
  text: string;
  isFinal: boolean;
  at: number; // ms since capture start
}

export interface UseTranscription {
  supported: boolean;
  listening: boolean;
  error: string | null;
  /** finalized transcript so far */
  finalText: string;
  /** current interim (not yet final) text */
  interimText: string;
  segments: TranscriptSegment[];
  durationMs: number;
  start: () => void;
  stop: () => void;
  reset: () => void;
}

/**
 * Real-time speech-to-text via the browser Web Speech API (free, Chrome).
 * Captures the LOCAL microphone only — not the other party on the call.
 * The return shape is provider-agnostic so a streaming provider (Deepgram /
 * OpenAI) can be dropped in later behind the same interface.
 */
export function useTranscription(lang = "en-US"): UseTranscription {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [finalText, setFinalText] = useState("");
  const [interimText, setInterimText] = useState("");
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [durationMs, setDurationMs] = useState(0);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const wantListeningRef = useRef(false);

  useEffect(() => {
    setSupported(getRecognitionCtor() !== null);
  }, []);

  const stop = useCallback(() => {
    wantListeningRef.current = false;
    recognitionRef.current?.stop();
    setListening(false);
    if (startedAtRef.current !== null) {
      setDurationMs(performance.now() - startedAtRef.current);
    }
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setError("Speech recognition isn't supported in this browser. Use Chrome.");
      return;
    }
    setError(null);
    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;
    startedAtRef.current = performance.now();

    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const result = e.results[i];
        const text = result[0].transcript;
        const at = startedAtRef.current ? performance.now() - startedAtRef.current : 0;
        if (result.isFinal) {
          setFinalText((prev) => (prev ? prev + " " : "") + text.trim());
          setSegments((prev) => [...prev, { text: text.trim(), isFinal: true, at }]);
        } else {
          interim += text;
        }
      }
      setInterimText(interim);
    };

    rec.onerror = (ev) => {
      // "no-speech"/"aborted" are routine; surface the rest.
      if (ev.error !== "no-speech" && ev.error !== "aborted") {
        setError(`Transcription error: ${ev.error}`);
      }
    };

    rec.onend = () => {
      // Chrome stops after silence; restart if we still want to listen.
      if (wantListeningRef.current) {
        try {
          rec.start();
        } catch {
          /* already starting */
        }
      } else {
        setListening(false);
      }
    };

    recognitionRef.current = rec;
    wantListeningRef.current = true;
    try {
      rec.start();
      setListening(true);
    } catch {
      setError("Couldn't start the microphone.");
    }
  }, [lang]);

  const reset = useCallback(() => {
    setFinalText("");
    setInterimText("");
    setSegments([]);
    setDurationMs(0);
    startedAtRef.current = null;
  }, []);

  // Clean up on unmount.
  useEffect(() => {
    return () => {
      wantListeningRef.current = false;
      recognitionRef.current?.stop();
    };
  }, []);

  return {
    supported,
    listening,
    error,
    finalText,
    interimText,
    segments,
    durationMs,
    start,
    stop,
    reset,
  };
}
