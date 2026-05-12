import { OBSERVABILITY_VIEWER_ROLES } from "@/lib/auth/constants";
import { requireRole } from "@/lib/auth/requireRole";
import { getWebVitalsSnapshot, type WebVitalMetricSummary, type WebVitalPathSummary } from "@/lib/analytics/webVitals";
import { getPersistentWebVitalsSnapshot } from "@/lib/analytics/webVitalsPersistence";

function metricValue(name: string, value: number | null): string {
  if (value === null) return "—";
  if (name === "CLS") return value.toFixed(3);
  return `${Math.round(value).toLocaleString("vi-VN")} ms`;
}

function timeLabel(timestamp: number): string {
  if (!timestamp) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(timestamp));
}

function toneForMetric(row: WebVitalMetricSummary): string {
  if (row.poor > 0) return "border-rose-200 bg-rose-50 text-rose-700";
  if (row.needsImprovement > 0) return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-emerald-200 bg-emerald-50 text-emerald-700";
}

function MetricCard({ row }: { row: WebVitalMetricSummary }) {
  return (
    <article className={`rounded-[var(--apg-radius-lg)] border px-4 py-4 ${toneForMetric(row)}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.12em] opacity-70">{row.name}</div>
          <div className="mt-1 text-2xl font-black">{metricValue(row.name, row.p75)}</div>
        </div>
        <div className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold">{row.count} mẫu</div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div>Good: <span className="font-bold">{row.good}</span></div>
        <div>Warn: <span className="font-bold">{row.needsImprovement}</span></div>
        <div>Poor: <span className="font-bold">{row.poor}</span></div>
      </div>
    </article>
  );
}

function PathRow({ row }: { row: WebVitalPathSummary }) {
  return (
    <tr className="border-b border-[var(--apg-border-default)] last:border-b-0">
      <td className="max-w-[260px] truncate px-4 py-3 font-semibold text-[var(--apg-text-primary)]">{row.path}</td>
      <td className="px-4 py-3 text-right apg-tabular">{row.count}</td>
      <td className="px-4 py-3 text-right apg-tabular">{metricValue("LCP", row.lcpP75)}</td>
      <td className="px-4 py-3 text-right apg-tabular">{metricValue("INP", row.inpP75)}</td>
      <td className="px-4 py-3 text-right apg-tabular">{metricValue("CLS", row.clsP75)}</td>
      <td className="px-4 py-3 text-right text-[var(--apg-text-secondary)]">{timeLabel(row.latestTimestamp)}</td>
    </tr>
  );
}

export default async function WebVitalsPage() {
  await requireRole(OBSERVABILITY_VIEWER_ROLES);
  const snapshot = (await getPersistentWebVitalsSnapshot()) || getWebVitalsSnapshot();

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="apg-eyebrow">Observability</p>
          <h1 className="mt-1 text-lg font-semibold text-[var(--apg-text-primary)]">Web Vitals</h1>
          <p className="mt-1 text-sm text-[var(--apg-text-secondary)]">
            Theo dõi các metric LCP, INP, CLS, FCP và TTFB gần nhất từ trình duyệt người dùng.
          </p>
        </div>
        <div className="inline-flex w-fit items-center rounded-md border border-[var(--apg-border-default)] bg-[var(--apg-bg-surface)] px-3 py-2 text-xs text-[var(--apg-text-secondary)]">
          {snapshot.total} mẫu · {timeLabel(Date.parse(snapshot.generatedAt))}
        </div>
      </section>

      <div className="rounded-[var(--apg-radius-lg)] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
        Collector đang ưu tiên đọc dữ liệu bền từ Postgres. Nếu migration chưa chạy hoặc DB tạm lỗi, dashboard tự fallback về bộ nhớ runtime gần nhất.
      </div>

      {snapshot.byMetric.length === 0 ? (
        <section className="apg-admin-sheet px-4 py-12 text-center text-sm text-[var(--apg-text-secondary)]">
          Chưa có Web Vitals. Mở trang public một lần trong browser để reporter gửi beacon về `/api/analytics/web-vitals`.
        </section>
      ) : (
        <>
          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {snapshot.byMetric.map((row) => <MetricCard key={row.name} row={row} />)}
          </section>

          <section className="apg-admin-sheet overflow-hidden">
            <div className="border-b border-[var(--apg-border-default)] px-4 py-3">
              <p className="apg-eyebrow">Path Breakdown</p>
              <h2 className="mt-1 text-sm font-semibold">p75 theo route</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="apg-admin-table min-w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left">Path</th>
                    <th className="px-4 py-3 text-right">Mẫu</th>
                    <th className="px-4 py-3 text-right">LCP p75</th>
                    <th className="px-4 py-3 text-right">INP p75</th>
                    <th className="px-4 py-3 text-right">CLS p75</th>
                    <th className="px-4 py-3 text-right">Mới nhất</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.byPath.map((row) => <PathRow key={row.path} row={row} />)}
                </tbody>
              </table>
            </div>
          </section>

          <section className="apg-admin-sheet overflow-hidden">
            <div className="border-b border-[var(--apg-border-default)] px-4 py-3">
              <p className="apg-eyebrow">Recent</p>
              <h2 className="mt-1 text-sm font-semibold">80 mẫu gần nhất</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="apg-admin-table min-w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left">Metric</th>
                    <th className="px-4 py-3 text-right">Value</th>
                    <th className="px-4 py-3 text-left">Rating</th>
                    <th className="px-4 py-3 text-left">Path</th>
                    <th className="px-4 py-3 text-right">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshot.recent.map((record) => (
                    <tr className="border-b border-[var(--apg-border-default)] last:border-b-0" key={`${record.id}-${record.timestamp}`}>
                      <td className="px-4 py-3 font-semibold">{record.name}</td>
                      <td className="px-4 py-3 text-right apg-tabular">{metricValue(record.name, record.value)}</td>
                      <td className="px-4 py-3">{record.rating || "—"}</td>
                      <td className="max-w-[260px] truncate px-4 py-3">{record.path}</td>
                      <td className="px-4 py-3 text-right text-[var(--apg-text-secondary)]">{timeLabel(record.timestamp)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
