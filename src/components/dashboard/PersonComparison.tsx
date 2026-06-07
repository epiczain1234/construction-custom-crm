import type { PersonWeekStats } from "@/lib/analytics";

const METRICS: { label: string; valueOf: (p: PersonWeekStats) => number }[] = [
  { label: "Calls made", valueOf: (p) => p.calls },
  { label: "Appointments set", valueOf: (p) => p.appointments },
];

export function PersonComparison({ people }: { people: PersonWeekStats[] }) {
  if (people.length === 0) return null;

  // Per metric, the leading value — used to bold whoever's ahead.
  const leaders = METRICS.map((m) => Math.max(...people.map(m.valueOf)));

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
        Head-to-head — this week
      </h2>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
              <th className="px-4 py-2 font-medium">Person</th>
              {METRICS.map((m) => (
                <th key={m.label} className="px-4 py-2 text-right font-medium">
                  {m.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.userId} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 font-medium text-slate-700">{p.name}</td>
                {METRICS.map((m, i) => {
                  const v = m.valueOf(p);
                  const isLeader = v > 0 && v === leaders[i];
                  return (
                    <td
                      key={m.label}
                      className={`px-4 py-3 text-right tabular-nums ${
                        isLeader ? "font-bold text-slate-900" : "text-slate-500"
                      }`}
                    >
                      {v}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
