import type { WeeklyAnalytics } from "@/lib/analytics";
import { weekOverWeek } from "@/lib/analytics";

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
  const { thisWeek, lastWeek, conversion, benchmark } = data;
  const onTarget = conversion >= benchmark;
  const benchmarkAppts = Math.round(thisWeek.calls * benchmark);

  const stages = [
    { label: "Calls (dials)", value: thisWeek.calls, color: "bg-slate-400" },
    { label: "Connected", value: thisWeek.connected, color: "bg-sky-400" },
    { label: "Interested", value: thisWeek.interested, color: "bg-emerald-400" },
    { label: "Appointments", value: thisWeek.appointments, color: onTarget ? "bg-emerald-600" : "bg-rose-500" },
  ];
  const max = Math.max(thisWeek.calls, 1);

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
        Team this week
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
            Benchmark {pct(benchmark)} ·{" "}
            <span className={onTarget ? "text-emerald-700" : "text-rose-600"}>
              {onTarget ? "on / above target" : "below target"}
            </span>
          </div>
        </div>
      </div>

      {/* Funnel vs 3% benchmark */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-700">Funnel</h3>
          <span className="text-xs text-slate-400">
            {benchmark * 100}% benchmark → {benchmarkAppts} appt{benchmarkAppts === 1 ? "" : "s"} from {thisWeek.calls} calls
          </span>
        </div>
        <div className="space-y-2">
          {stages.map((s) => {
            const widthPct = (s.value / max) * 100;
            const isAppt = s.label === "Appointments";
            return (
              <div key={s.label}>
                <div className="mb-0.5 flex items-center justify-between text-xs">
                  <span className="text-slate-600">{s.label}</span>
                  <span className="text-slate-400">
                    {s.value}
                    {thisWeek.calls > 0 && ` · ${((s.value / thisWeek.calls) * 100).toFixed(1)}%`}
                  </span>
                </div>
                <div className="relative h-6 overflow-hidden rounded-md bg-slate-100">
                  <div
                    className={`h-full ${s.color} transition-all`}
                    style={{ width: `${Math.max(widthPct, s.value > 0 ? 2 : 0)}%` }}
                  />
                  {/* benchmark marker on the appointments row */}
                  {isAppt && thisWeek.calls > 0 && (
                    <div
                      className="absolute top-0 h-full border-l-2 border-dashed border-slate-700"
                      style={{ left: `${benchmark * 100}%` }}
                      title={`3% benchmark = ${benchmarkAppts} appointments`}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {thisWeek.calls > 0 && (
          <p className="mt-2 text-xs text-slate-400">
            Dashed line = 3% benchmark. You&apos;re at {pct(conversion)} (
            {thisWeek.appointments} of {thisWeek.calls}).
          </p>
        )}
      </div>
    </section>
  );
}
