import { CallOutcome, ContactStage, ContactStatus, ContactType } from "@/generated/prisma/enums";

export const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  CLIENT: "Client",
  GENERAL_CONTRACTOR: "General Contractor",
  SUBCONTRACTOR: "Subcontractor",
  SUPPLIER: "Supplier",
  ARCHITECT: "Architect",
  OTHER: "Other",
};

export const CONTACT_STATUS_LABELS: Record<ContactStatus, string> = {
  NEW: "New",
  ATTEMPTING: "Attempting",
  IN_CONVERSATION: "In conversation",
  INTERESTED: "Interested",
  NOT_INTERESTED: "Not interested",
  CALLBACK: "Callback",
  WON: "Won",
  DEAD: "Dead",
};

export const CONTACT_STAGE_LABELS: Record<ContactStage, string> = {
  COLD_LEAD: "Cold Lead",
  ACTIVE_CLIENT: "Active Client",
  WARM_LEAD: "Warm Lead",
};

// Tailwind classes for the stage badge (mirrors CONTACT_STATUS_STYLES shape).
export const CONTACT_STAGE_STYLES: Record<ContactStage, string> = {
  COLD_LEAD: "bg-slate-100 text-slate-700 ring-slate-200",
  ACTIVE_CLIENT: "bg-blue-100 text-blue-800 ring-blue-200",
  WARM_LEAD: "bg-amber-100 text-amber-800 ring-amber-200",
};

// Active-client milestones. Key is the stable action argument; value is the label.
export const MILESTONE_LABELS = {
  DOCS: "Docs filled out",
  PAYMENT: "Payment collected",
  KICKOFF: "Kickoff scheduled",
  FINISHED_SERVING: "Finished serving",
} as const;

export type MilestoneKey = keyof typeof MILESTONE_LABELS;

// Tailwind classes for the status badge.
export const CONTACT_STATUS_STYLES: Record<ContactStatus, string> = {
  NEW: "bg-slate-100 text-slate-700 ring-slate-200",
  ATTEMPTING: "bg-amber-100 text-amber-800 ring-amber-200",
  IN_CONVERSATION: "bg-sky-100 text-sky-800 ring-sky-200",
  INTERESTED: "bg-emerald-100 text-emerald-800 ring-emerald-200",
  NOT_INTERESTED: "bg-rose-100 text-rose-700 ring-rose-200",
  CALLBACK: "bg-violet-100 text-violet-800 ring-violet-200",
  WON: "bg-green-600 text-white ring-green-700",
  DEAD: "bg-slate-200 text-slate-500 ring-slate-300",
};

export interface OutcomeButton {
  outcome: CallOutcome;
  label: string;
  /** keyboard shortcut digit (1-8) */
  key: string;
  /** tailwind classes for the button */
  className: string;
  /** when true, the UI must collect an explicit callback date first */
  needsDate?: boolean;
}

// Ordered for the call screen; the key doubles as the keyboard shortcut.
// (No Answer was retired — we always leave a voicemail instead.)
export const OUTCOME_BUTTONS: OutcomeButton[] = [
  { outcome: "LEFT_VOICEMAIL", label: "Left Voicemail + Text (recommended)", key: "1", className: "bg-yellow-500 hover:bg-yellow-600" },
  { outcome: "VOICEMAIL_BROKEN", label: "Voicemail Broken", key: "8", className: "bg-orange-500 hover:bg-orange-600" },
  { outcome: "INTERESTED", label: "Interested", key: "2", className: "bg-emerald-600 hover:bg-emerald-700", needsDate: true },
  { outcome: "APPOINTMENT_SET", label: "Appointment Set", key: "3", className: "bg-blue-600 hover:bg-blue-700", needsDate: true },
  { outcome: "CALLBACK_REQUESTED", label: "Callback", key: "4", className: "bg-violet-600 hover:bg-violet-700", needsDate: true },
  { outcome: "NOT_INTERESTED", label: "Not Interested", key: "5", className: "bg-rose-600 hover:bg-rose-700" },
  { outcome: "WRONG_NUMBER", label: "Wrong Number", key: "6", className: "bg-slate-500 hover:bg-slate-600" },
  { outcome: "CLOSED_WON", label: "Closed / Won", key: "7", className: "bg-green-700 hover:bg-green-800" },
];

// Labels for every outcome, including retired ones (NO_ANSWER) so historical
// activities still render correctly in timelines and analytics.
export const CALL_OUTCOME_LABELS: Record<CallOutcome, string> = {
  NO_ANSWER: "No Answer",
  ...Object.fromEntries(OUTCOME_BUTTONS.map((b) => [b.outcome, b.label])),
  // Cleaner label for history/analytics (the button carries the "(recommended)" nudge).
  LEFT_VOICEMAIL: "Left Voicemail + Text",
} as Record<CallOutcome, string>;
