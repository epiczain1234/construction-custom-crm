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

      {/* Funnel: Alexander & Associates vs benchmark, every stage */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-slate-700">Funnel vs benchmark</h3>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <span className="h-2 w-3 rounded-sm bg-slate-500" /> {COMPANY_NAME}
            </span>
            <span className="flex items-center gap-1">
              <span className="h-3 w-0 border-l-2 border-dashed border-slate-700" /> benchmark
            </span>
          </div>
        </div>

        {calls === 0 ? (
          <p className="py-4 text-center text-sm text-slate-400">No calls logged yet this week.</p>
        ) : (
          <div className="space-y-3">
            {stages.map((s) => {
              const benchCount = Math.round(calls * s.rate);
              const actualPct = s.actual / calls;
              const hit = s.baseline || s.actual >= benchCount;
              const fillColor = s.baseline
                ? "bg-slate-400"
                : hit
                  ? "bg-emerald-500"
                  : "bg-rose-500";
              return (
                <div key={s.label}>
                  <div className="mb-0.5 flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-600">{s.label}</span>
                    <span className="text-slate-400">
                      <span className="font-medium text-slate-600">{s.actual}</span> ({pct(actualPct)})
                      {!s.baseline && (
                        <>
                          {" "}vs <span className="font-medium">{benchCount}</span> ({pct(s.rate)})
                          <span className={hit ? "text-emerald-600" : "text-rose-600"}>
                            {" "}{hit ? "▲" : "▼"}
                          </span>
                        </>
                      )}
                    </span>
                  </div>
                  <div className="relative h-6 overflow-hidden rounded-md bg-slate-100">
                    <div
                      className={`h-full ${fillColor} transition-all`}
                      style={{ width: `${Math.max(actualPct * 100, s.actual > 0 ? 2 : 0)}%` }}
                    />
                    {!s.baseline && (
                      <div
                        className="absolute top-0 h-full border-l-2 border-dashed border-slate-700"
                        style={{ left: `${s.rate * 100}%` }}
                        title={`Benchmark: ${benchCount} (${pct(s.rate)})`}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
