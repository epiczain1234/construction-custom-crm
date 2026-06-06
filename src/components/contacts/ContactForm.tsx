import Link from "next/link";
import { ContactStatus, ContactType } from "@/generated/prisma/enums";
import { CONTACT_STATUS_LABELS, CONTACT_TYPE_LABELS, SEGMENT_VISIBILITY_LABELS } from "@/lib/labels";

interface ContactFormData {
  id: string;
  firstName: string;
  lastName: string | null;
  company: string | null;
  title: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  type: ContactType;
  status: ContactStatus;
  cadenceDays: number | null;
}

export function ContactForm({
  action,
  segments,
  contact,
  selectedSegmentIds = [],
}: {
  action: (formData: FormData) => void;
  segments: { id: string; name: string; visibility: string }[];
  contact?: ContactFormData;
  selectedSegmentIds?: string[];
}) {
  const isEdit = !!contact;

  return (
    <form action={action} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <Field label="First name *">
          <input name="firstName" required defaultValue={contact?.firstName ?? ""} className={inputCls} />
        </Field>
        <Field label="Last name">
          <input name="lastName" defaultValue={contact?.lastName ?? ""} className={inputCls} />
        </Field>
        <Field label="Company">
          <input name="company" defaultValue={contact?.company ?? ""} className={inputCls} />
        </Field>
        <Field label="Title">
          <input name="title" defaultValue={contact?.title ?? ""} className={inputCls} />
        </Field>
        <Field label="Phone">
          <input name="phone" type="tel" defaultValue={contact?.phone ?? ""} className={inputCls} />
        </Field>
        <Field label="Email">
          <input name="email" type="email" defaultValue={contact?.email ?? ""} className={inputCls} />
        </Field>
        <Field label="Type">
          <select name="type" defaultValue={contact?.type ?? ContactType.OTHER} className={inputCls}>
            {Object.entries(CONTACT_TYPE_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </Field>
        <Field label="Follow-up cadence (days)">
          <input
            name="cadenceDays"
            type="number"
            min={1}
            placeholder="e.g. 7"
            defaultValue={contact?.cadenceDays ?? ""}
            className={inputCls}
          />
        </Field>
        {isEdit && (
          <Field label="Status">
            <select name="status" defaultValue={contact.status} className={inputCls}>
              {Object.entries(CONTACT_STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>
        )}
      </div>

      <Field label="Notes">
        <textarea name="notes" rows={3} defaultValue={contact?.notes ?? ""} className={inputCls} />
      </Field>

      <fieldset>
        <legend className="mb-1.5 block text-sm font-medium text-slate-700">Lists</legend>
        {segments.length === 0 ? (
          <p className="text-sm text-slate-400">
            No lists yet — <Link href="/lists/new" className="underline">create one</Link>.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {segments.map((s) => (
              <label
                key={s.id}
                className="flex cursor-pointer items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm has-checked:border-slate-900 has-checked:bg-slate-50"
              >
                <input
                  type="checkbox"
                  name="segmentIds"
                  value={s.id}
                  defaultChecked={selectedSegmentIds.includes(s.id)}
                />
                {s.name}
                <span className="text-xs text-slate-400">
                  {SEGMENT_VISIBILITY_LABELS[s.visibility as keyof typeof SEGMENT_VISIBILITY_LABELS]}
                </span>
              </label>
            ))}
          </div>
        )}
      </fieldset>

      <div className="flex items-center gap-2 pt-2">
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          {isEdit ? "Save changes" : "Create contact"}
        </button>
        <Link
          href={isEdit ? `/contacts/${contact.id}` : "/contacts"}
          className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}

const inputCls =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-900 focus:outline-none";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}
