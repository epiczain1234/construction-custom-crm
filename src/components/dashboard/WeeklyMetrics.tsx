import type { WeeklyAnalytics } from "@/lib/analytics";
import { BENCHMARK, COMPANY_NAME, weekOverWeek } from "@/lib/analytics";

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

function Delta({ thisVal, lastVal }: { thisVal: number; lastVal: number }) {
  const change = weekOverWeek(thisVal, lastVal);
  if (change === null) {
    return <span className="text-xs text-slate-400">vs 0 last week</span>;
  }
  const up = change >= 0;
  return (
    <span className={`text-xs font-medium ${up ? "text-emerald-600" : "text-rose-600"}`}>
      {up ? "▲" : "▼"} {Math.abs(change * 100).toFixed(0)}% vs last wk ({lastVal})
    </span>
  );
}

export function WeeklyMetrics({ data }: { data: WeeklyAnalytics }) {
  const { thisWeek, lastWeek, conversion } = data;
  const onTarget = conversion >= BENCHMARK.appointment;
  const calls = thisWeek.calls;

  // Funnel stages with their benchmark rate (fraction of dials).
  const stages = [
    { label: "Calls (dials)", actual: thisWeek.calls, rate: 1, baseline: true },
    { label: "Connected", actual: thisWeek.connected, rate: BENCHMARK.connected, baseline: false },
    { label: "Interested", actual: thisWeek.interested, rate: BENCHMARK.interested, baseline: false },
    { label: "Appointments", actual: thisWeek.appointments, rate: BENCHMARK.appointment, baseline: false },
  ];

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
        {COMPANY_NAME} — this week
      </h2>

      {/* Headline stats */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-3xl font-semibold text-slate-900">{thisWeek.calls}</div>
          <div className="text-sm text-slate-500">Calls this week</div>
          <div className="mt-1">
            <Delta thisVal={thisWeek.calls} lastVal={lastWeek.calls} />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-3xl font-semibold text-blue-600">{thisWeek.appointments}</div>
          <div className="text-sm text-slate-500">Appointments set</div>
          <div className="mt-1">
            <Delta thisVal={thisWeek.appointments} lastVal={lastWeek.appointments} />
          </div>
        </div>

        <div
          className={`rounded-xl border p-4 ${
            onTarget ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"
          }`}
        >
          <div className={`text-3xl font-semibold ${onTarget ? "text-emerald-700" : "text-rose-600"}`}>
            {pct(conversion)}
          </div>
          <div className="text-sm text-slate-500">Appt conversion</div>
          <div className="mt-1 text-xs font-medium text-slate-500">
            Benchmark {pct(BENCHMARK.appointment)} ·{" "}
            <span className={onTarget ? "text-emerald-700" : "text-rose-600"}>
              {onTarget ? "above target" : "below target"}
            </span>
          </div>
        </div>
      </div>

      {/* Funnel: Alexander & Associates vs benchmark, every stage (numbers only) */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-medium text-slate-700">Funnel vs benchmark</h3>

        {calls === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">No calls logged yet this week.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-4 font-medium">Stage</th>
                <th className="px-2 py-2 text-right font-medium">{COMPANY_NAME}</th>
                <th className="px-2 py-2 text-right font-medium">Benchmark</th>
                <th className="py-2 pl-2 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {stages.map((s) => {
                const benchCount = Math.round(calls * s.rate);
                const actualPct = s.actual / calls;
                const hit = s.baseline || s.actual >= benchCount;
                return (
                  <tr key={s.label} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-4 font-medium text-slate-600">{s.label}</td>
                    <td className="px-2 py-2 text-right tabular-nums text-slate-700">
                      {s.actual} <span className="text-slate-400">({pct(actualPct)})</span>
                    </td>
                    <td className="px-2 py-2 text-right tabular-nums text-slate-500">
                      {s.baseline ? (
                        "—"
                      ) : (
                        <>
                          {benchCount} <span className="text-slate-400">({pct(s.rate)})</span>
                        </>
                      )}
                    </td>
                    <td className="py-2 pl-2 text-right">
                      {s.baseline ? (
                        <span className="text-slate-300">—</span>
                      ) : (
                        <span className={`font-medium ${hit ? "text-emerald-600" : "text-rose-600"}`}>
                          {hit ? "▲ above" : "▼ below"}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
