import { ContactStage } from "@/generated/prisma/enums";
import { CONTACT_STAGE_LABELS, CONTACT_STAGE_STYLES } from "@/lib/labels";

export function StageBadge({ stage }: { stage: ContactStage }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${CONTACT_STAGE_STYLES[stage]}`}
    >
      {CONTACT_STAGE_LABELS[stage]}
    </span>
  );
}
