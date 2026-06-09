"use client";

import { useCallback } from "react";
import { CallStatusButtons } from "@/components/call/CallStatusButtons";
import { TranscriptPanel } from "@/components/call/TranscriptPanel";
import { useCallRecorder } from "@/lib/transcription/useCallRecorder";

/**
 * "Log a call" panel for the contact detail page. Same recording shell as the
 * list-driven call console (CallModeClient) via the shared useCallRecorder hook,
 * so a rep can capture a transcript straight from a lead's profile — not only
 * from a call list. revalidatePath in the log/save actions refreshes the
 * timeline; reset() clears the recorder afterward.
 */
export function ContactCallPanel({ contactId }: { contactId: string }) {
  const {
    t,
    called,
    startCall,
    reset,
    getTranscript,
    hasTranscript,
    saveTranscriptOnly,
    savingTranscript,
    saveError,
  } = useCallRecorder({ contactId });

  // Clear the recorder after a save-only so the captured text can't be re-saved;
  // revalidatePath in the action refreshes the timeline.
  const handleSaveTranscript = useCallback(async () => {
    if (await saveTranscriptOnly()) reset();
  }, [saveTranscriptOnly, reset]);

  return (
    <div className="space-y-3">
      {!called ? (
        <button
          onClick={startCall}
          className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          ▶︎ Let&apos;s Call
        </button>
      ) : (
        <button
          onClick={() => t.stop()}
          disabled={!t.listening}
          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
        >
          ⏹ Stop recording
        </button>
      )}

      {(called || hasTranscript) && (
        <TranscriptPanel
          finalText={t.finalText}
          interimText={t.interimText}
          listening={t.listening}
          supported={t.supported}
          error={t.error}
        />
      )}

      {saveError && (
        <div className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
          ⚠️ {saveError}
        </div>
      )}

      {hasTranscript && (
        <button
          onClick={handleSaveTranscript}
          disabled={savingTranscript}
          title="Save the recording to this contact's timeline without logging a call outcome"
          className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50"
        >
          {savingTranscript ? "Saving…" : "💾 Save transcript"}
        </button>
      )}

      <CallStatusButtons contactId={contactId} getTranscript={getTranscript} onLogged={reset} />
    </div>
  );
}
