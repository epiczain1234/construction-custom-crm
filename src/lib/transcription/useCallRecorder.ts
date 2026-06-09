"use client";

import { useCallback, useState } from "react";
import { useTranscription } from "@/lib/transcription/useTranscription";
import { saveTranscriptNote } from "@/app/actions/activities";
import type { TranscriptPayload } from "@/components/call/CallStatusButtons";

/**
 * Shared recording shell used by both the list-driven call console
 * (CallModeClient) and the per-contact "Log a call" panel. Owns the
 * transcription lifecycle, the captured-transcript payload, and the
 * "save transcript without an outcome" flow — so the two surfaces can't
 * drift apart. Layout/navigation stays with each caller.
 */
export function useCallRecorder({
  contactId,
}: {
  /** the contact a saved transcript should attach to */
  contactId: string | undefined;
}) {
  const [called, setCalled] = useState(false);
  const [savingTranscript, setSavingTranscript] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const t = useTranscription();

  const hasTranscript = !!(t.finalText.trim() || t.interimText.trim());

  const getTranscript = useCallback((): TranscriptPayload | undefined => {
    const text = [t.finalText, t.interimText].filter(Boolean).join(" ").trim();
    if (!text) return undefined;
    return { text, segments: t.segments, durationMs: Math.round(t.durationMs) };
  }, [t.finalText, t.interimText, t.segments, t.durationMs]);

  const startCall = useCallback(() => {
    t.reset();
    t.start();
    setCalled(true);
  }, [t]);

  // Tear down the recorder for the next contact (or after logging an outcome).
  const reset = useCallback(() => {
    t.stop();
    t.reset();
    setCalled(false);
    setSaveError(null);
  }, [t]);

  // Save the recording to the timeline as a note without logging an outcome.
  // Returns true on a confirmed save so the caller can advance/reset — nothing
  // is silently lost on failure.
  const saveTranscriptOnly = useCallback(async (): Promise<boolean> => {
    if (!contactId || savingTranscript) return false;
    const payload = getTranscript();
    if (!payload) return false;
    t.stop();
    setSavingTranscript(true);
    setSaveError(null);
    try {
      await saveTranscriptNote({ contactId, transcript: payload });
      return true;
    } catch {
      setSaveError("Couldn't save the transcript — check your connection and try again.");
      return false;
    } finally {
      setSavingTranscript(false);
    }
  }, [contactId, savingTranscript, getTranscript, t]);

  return {
    t,
    called,
    startCall,
    reset,
    getTranscript,
    hasTranscript,
    saveTranscriptOnly,
    savingTranscript,
    saveError,
  };
}
