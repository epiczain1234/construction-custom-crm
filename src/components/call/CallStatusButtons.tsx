"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CallOutcome } from "@/generated/prisma/enums";
import { OUTCOME_BUTTONS } from "@/lib/labels";
import { logCall, type LogCallInput } from "@/app/actions/activities";

export interface TranscriptPayload {
  text: string;
  segments?: unknown;
  durationMs?: number;
}

export function CallStatusButtons({
  contactId,
  enableKeyboard = false,
  getTranscript,
  onLogged,
}: {
  contactId: string;
  /** bind number keys 1-7 to the outcomes (use in call mode only) */
  enableKeyboard?: boolean;
  /** called right before logging to grab any captured transcript */
  getTranscript?: () => TranscriptPayload | undefined;
  /** fired after a successful log (e.g. advance to next contact) */
  onLogged?: (outcome: CallOutcome) => void;
}) {
  const [note, setNote] = useState("");
  const [pendingOutcome, setPendingOutcome] = useState<CallOutcome | null>(null);
  const [callbackDate, setCallbackDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const noteRef = useRef(note);
  noteRef.current = note;

  const submit = useCallback(
    async (outcome: CallOutcome, callbackIso?: string | null) => {
      setBusy(true);
      setError(null);
      try {
        const t = getTranscript?.();
        const input: LogCallInput = {
          contactId,
          outcome,
          note: noteRef.current || undefined,
          callbackDate: callbackIso ?? null,
          transcript: t && t.text.trim() ? t : undefined,
        };
        await logCall(input);
        // Only clear + advance on a confirmed save, so nothing is silently lost.
        setNote("");
        setPendingOutcome(null);
        setCallbackDate("");
        onLogged?.(outcome);
      } catch {
        setError("Couldn't save that — check your connection and tap the outcome again.");
      } finally {
        setBusy(false);
      }
    },
    [contactId, getTranscript, onLogged],
  );

  const handleClick = useCallback(
    (outcome: CallOutcome, needsDate?: boolean) => {
      if (busy) return;
      if (needsDate) {
        setPendingOutcome(outcome);
        return;
      }
      void submit(outcome);
    },
    [busy, submit],
  );

  useEffect(() => {
    if (!enableKeyboard) return;
    const onKey = (e: KeyboardEvent) => {
      // don't hijack typing in the note box / inputs
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT" || pendingOutcome) return;
      const btn = OUTCOME_BUTTONS.find((b) => b.key === e.key);
      if (btn) {
        e.preventDefault();
        handleClick(btn.outcome, btn.needsDate);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enableKeyboard, handleClick, pendingOutcome]);

  return (
    <div className="space-y-3">
      {error && (
        <div className="rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-medium text-rose-700">
          ⚠️ {error}
        </div>
      )}
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="Quick note about the call…"
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-900 focus:outline-none"
      />

      {pendingOutcome ? (
        <div className="rounded-lg border border-violet-200 bg-violet-50 p-3">
          <p className="mb-2 text-sm font-medium text-violet-900">
            {pendingOutcome === "APPOINTMENT_SET"
              ? "When's the appointment?"
              : pendingOutcome === "INTERESTED"
                ? "Soonest to call them back?"
                : "When should we call back?"}
          </p>
          <div className="flex items-center gap-2">
            <input
              type="datetime-local"
              value={callbackDate}
              onChange={(e) => setCallbackDate(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            />
            <button
              disabled={busy || !callbackDate}
              onClick={() => submit(pendingOutcome, new Date(callbackDate).toISOString())}
              className="rounded-md bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {pendingOutcome === "APPOINTMENT_SET" ? "Save appointment" : "Save callback"}
            </button>
            <button
              disabled={busy}
              onClick={() => { setPendingOutcome(null); setCallbackDate(""); }}
              className="rounded-md px-3 py-2 text-sm text-slate-500 hover:bg-slate-100"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {OUTCOME_BUTTONS.map((b) => (
            <button
              key={b.outcome}
              disabled={busy}
              onClick={() => handleClick(b.outcome, b.needsDate)}
              className={`flex flex-col items-center justify-center rounded-lg px-3 py-3 text-sm font-semibold text-white transition-colors disabled:opacity-50 ${b.className}`}
            >
              <span>{b.label}</span>
              {enableKeyboard && <span className="mt-0.5 text-xs opacity-70">[{b.key}]</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
