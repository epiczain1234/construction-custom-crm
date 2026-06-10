import type { WeeklyAnalytics, FunnelContact, FollowContact } from "@/lib/analytics";
import { BENCHMARK, COMPANY_NAME, weekOverWeek } from "@/lib/analytics";
import { FunnelTable, type FunnelStage } from "@/components/dashboard/FunnelTable";

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

export function WeeklyMetrics({
  data,
  funnelContacts,
  followContacts,
}: {
  data: WeeklyAnalytics;
  funnelContacts: FunnelContact[];
  followContacts: FollowContact[];
}) {
  const { thisWeek, lastWeek, conversion } = data;
  const onTarget = conversion >= BENCHMARK.appointment;
  const calls = thisWeek.calls;

  // Funnel stages with their benchmark rate (fraction of dials). `raw` rows show a
  // plain count with no benchmark/percentage (follows aren't a fraction of dials).
  // `bucket` makes the count clickable to drill into the contacts behind it.
  const stages: FunnelStage[] = [
    { label: "Calls (contacts)", actual: thisWeek.calls, rate: 1, baseline: true, raw: false, bucket: "calls" },
    { label: "Follows", actual: thisWeek.follows, rate: 0, baseline: true, raw: true, bucket: "follows" },
    { label: "Connected", actual: thisWeek.connected, rate: BENCHMARK.connected, baseline: false, raw: false, bucket: "connected" },
    { label: "Interested", actual: thisWeek.interested, rate: BENCHMARK.interested, baseline: false, raw: false, bucket: "interested" },
    { label: "Appointments", actual: thisWeek.appointments, rate: BENCHMARK.appointment, baseline: false, raw: false, bucket: "appointments" },
  ];

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
        {COMPANY_NAME} — this week
      </h2>

      {/* Headline stats */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-3xl font-semibold text-slate-900">{thisWeek.calls}</div>
          <div className="text-sm text-slate-500">Calls this week</div>
          <div className="mt-1">
            <Delta thisVal={thisWeek.calls} lastVal={lastWeek.calls} />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-3xl font-semibold text-indigo-600">{thisWeek.follows}</div>
          <div className="text-sm text-slate-500">Follows this week</div>
          <div className="mt-1">
            <Delta thisVal={thisWeek.follows} lastVal={lastWeek.follows} />
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

      {/* Funnel: Alexander & Associates vs benchmark — click a count to drill in. */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-sm font-medium text-slate-700">Funnel vs benchmark</h3>
        <FunnelTable calls={calls} stages={stages} contacts={funnelContacts} follows={followContacts} />
      </div>
    </section>
  );
}
