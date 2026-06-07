"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ContactStatus, ContactType } from "@/generated/prisma/enums";
import { StatusBadge } from "@/components/contacts/StatusBadge";
import { CallStatusButtons, type TranscriptPayload } from "@/components/call/CallStatusButtons";
import { TranscriptPanel } from "@/components/call/TranscriptPanel";
import { PreviousNotes, type PreviousNote } from "@/components/contacts/PreviousNotes";
import { useTranscription } from "@/lib/transcription/useTranscription";
import { CONTACT_TYPE_LABELS } from "@/lib/labels";
import { formatDue } from "@/lib/format";

export interface CallContact {
  id: string;
  firstName: string;
  lastName: string | null;
  company: string | null;
  title: string | null;
  phone: string | null;
  notes: string | null;
  type: ContactType;
  status: ContactStatus;
  nextFollowUpAt: string | null;
  previousNotes: PreviousNote[];
}

export function CallModeClient({
  contacts,
  segmentName,
}: {
  contacts: CallContact[];
  segmentName: string;
}) {
  const [index, setIndex] = useState(0);
  const [called, setCalled] = useState(false);
  const t = useTranscription();

  const contact = contacts[index];
  const done = index >= contacts.length;

  const getTranscript = useCallback((): TranscriptPayload | undefined => {
    const text = [t.finalText, t.interimText].filter(Boolean).join(" ").trim();
    if (!text) return undefined;
    return { text, segments: t.segments, durationMs: Math.round(t.durationMs) };
  }, [t.finalText, t.interimText, t.segments, t.durationMs]);

  const advance = useCallback(() => {
    t.stop();
    t.reset();
    setCalled(false);
    setIndex((i) => i + 1);
  }, [t]);

  const startCall = useCallback(() => {
    t.reset();
    t.start();
    setCalled(true);
  }, [t]);

  const name = useMemo(
    () => (contact ? [contact.firstName, contact.lastName].filter(Boolean).join(" ") : ""),
    [contact],
  );

  if (done) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="text-5xl">🎉</div>
        <h1 className="mt-4 text-2xl font-semibold text-slate-900">List complete</h1>
        <p className="mt-1 text-sm text-slate-500">
          You worked through all {contacts.length} contacts in “{segmentName}”.
        </p>
        <div className="mt-6 flex justify-center gap-2">
          <Link href="/dashboard" className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
            Back to dashboard
          </Link>
          <Link href="/call" className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
            Call another list
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <Link href="/call" className="text-sm text-slate-500 hover:underline">
            ← Lists
          </Link>
          <h1 className="text-lg font-semibold text-slate-900">{segmentName}</h1>
        </div>
        <span className="text-sm font-medium text-slate-500">
          {index + 1} / {contacts.length}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Contact + outcomes */}
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-slate-900">{name}</h2>
              <StatusBadge status={contact.status} />
            </div>
            <p className="text-sm text-slate-500">
              {[contact.title, contact.company, CONTACT_TYPE_LABELS[contact.type]]
                .filter(Boolean)
                .join(" · ")}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {contact.phone && (
                <a
                  href={`tel:${contact.phone}`}
                  className="rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-slate-700"
                >
                  📞 {contact.phone}
                </a>
              )}
              <Link
                href={`/contacts/${contact.id}`}
                target="_blank"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
              >
                Open profile ↗
              </Link>
              <span className="text-xs text-slate-400">
                Follow-up: {formatDue(contact.nextFollowUpAt)}
              </span>
            </div>

            {contact.notes && (
              <p className="mt-3 whitespace-pre-wrap rounded-md bg-slate-50 p-2 text-sm text-slate-600">
                {contact.notes}
              </p>
            )}

            <div className="mt-4">
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
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-50"
                >
                  ⏹ Stop recording
                </button>
              )}
            </div>
          </div>

          <PreviousNotes notes={contact.previousNotes} />

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">Log outcome</h3>
              <button
                onClick={advance}
                className="text-xs text-slate-400 hover:text-slate-700"
              >
                Skip →
              </button>
            </div>
            <CallStatusButtons
              key={contact.id}
              contactId={contact.id}
              enableKeyboard
              getTranscript={getTranscript}
              onLogged={advance}
            />
          </div>
        </div>

        {/* Transcript */}
        <TranscriptPanel
          finalText={t.finalText}
          interimText={t.interimText}
          listening={t.listening}
          supported={t.supported}
          error={t.error}
        />
      </div>
    </div>
  );
}
