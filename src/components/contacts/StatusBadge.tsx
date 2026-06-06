import { ContactStatus } from "@/generated/prisma/enums";
import { CONTACT_STATUS_LABELS, CONTACT_STATUS_STYLES } from "@/lib/labels";

export function StatusBadge({ status }: { status: ContactStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${CONTACT_STATUS_STYLES[status]}`}
    >
      {CONTACT_STATUS_LABELS[status]}
    </span>
  );
}
