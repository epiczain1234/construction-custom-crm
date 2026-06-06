"use client";

import { useEffect, useRef } from "react";

export function TranscriptPanel({
  finalText,
  interimText,
  listening,
  supported,
  error,
}: {
  finalText: string;
  interimText: string;
  listening: boolean;
  supported: boolean;
  error: string | null;
}) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [finalText, interimText]);

  return (
    <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Live transcript
        </span>
        {listening && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-rose-600">
            <span className="h-2 w-2 animate-pulse rounded-full bg-rose-500" />
            Recording
          </span>
        )}
      </div>

      <div className="min-h-[180px] flex-1 overflow-y-auto px-4 py-3 text-sm leading-relaxed text-slate-700">
        {!supported && (
          <p className="text-amber-700">
            Live transcription needs Chrome (Web Speech API). The rest of call mode still works.
          </p>
        )}
        {error && <p className="text-rose-600">{error}</p>}
        {supported && !finalText && !interimText && !error && (
          <p className="text-slate-400">Press “Let’s Call” to start capturing your side of the call…</p>
        )}
        <span>{finalText}</span>{" "}
        <span className="text-slate-400">{interimText}</span>
        <div ref={endRef} />
      </div>

      <p className="border-t border-slate-100 px-4 py-1.5 text-[11px] text-slate-400">
        Captures your microphone only — not the other person.
      </p>
    </div>
  );
}
