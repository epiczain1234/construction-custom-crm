/** Human date like "Jun 6" or "Jun 6, 2027" if not current year. */
export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  const now = new Date();
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

/** Date + time like "Jun 6, 3:42 PM". */
export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Relative-ish phrasing for due dates: "Overdue 3d", "Today", "in 5d". */
export function formatDue(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const days = Math.round((target.getTime() - start.getTime()) / 86_400_000);
  if (days === 0) return "Today";
  if (days < 0) return `Overdue ${Math.abs(days)}d`;
  if (days === 1) return "Tomorrow";
  return `in ${days}d`;
}
