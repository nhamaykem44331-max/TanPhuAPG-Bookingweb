import { Database } from "lucide-react";

import { Chip, MiniChip } from "@/components/admin/ui/Chip";
import { DataTable, type DataTableColumn } from "@/components/admin/ui/DataTable";
import { SectionTitle } from "@/components/admin/ui/PageHead";
import { Eyebrow, Panel } from "@/components/admin/ui/Panel";
import { StatCard, StatTile } from "@/components/admin/ui/Stat";
import { OBSERVABILITY_VIEWER_ROLES } from "@/lib/auth/constants";
import { requireRole } from "@/lib/auth/requireRole";
import { toneVars, type Tone } from "@/lib/admin/ui/tones";
import {
  getWebVitalsSnapshot,
  type WebVitalMetricSummary,
  type WebVitalPathSummary,
  type WebVitalRating,
  type WebVitalRecord,
} from "@/lib/analytics/webVitals";
import { getPersistentWebVitalsSnapshot } from "@/lib/analytics/webVitalsPersistence";

function metricValue(name: string, value: number | null): string {
  if (value === null) return "—";
  if (name === "CLS") return value.toFixed(3);
  return `${Math.round(value).toLocaleString("vi-VN")} ms`;
}

// StatCard tách số và đơn vị: số lớn Fraunces, đơn vị Fraunces in nghiêng (§2 hợp đồng).
function metricNumber(name: string, value: number | null): string {
  if (value === null) return "—";
  if (name === "CLS") return value.toFixed(3);
  return Math.round(value).toLocaleString("vi-VN");
}

function metricUnit(name: string): string | undefined {
  return name === "CLS" ? undefined : "ms";
}

function timeLabel(timestamp: number): string {
  if (!timestamp) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(timestamp));
}

// Ngưỡng Web Vitals map sang tone chuẩn: có mẫu "poor" → red, có "needs-improvement" → warn, còn lại ok.
function toneForMetric(row: WebVitalMetricSummary): Tone {
  if (row.poor > 0) return "red";
  if (row.needsImprovement > 0) return "warn";
  return "ok";
}

function toneForRating(rating: WebVitalRating): Tone {
  if (rating === "poor") return "red";
  if (rating === "needs-improvement") return "warn";
  return "ok";
}

function MetricCard({ row }: { row: WebVitalMetricSummary }) {
  return (
    <StatCard
      label={row.name}
      value={metricNumber(row.name, row.p75)}
      unit={metricUnit(row.name)}
      sub={`p75 · ${row.count} mẫu`}
      // Viền thẻ đổi theo ngưỡng để nhìn lướt là thấy metric nào đang xấu.
      style={{ borderColor: toneVars(toneForMetric(row)).bd }}
    >
      <div className="mt-[10px] flex flex-wrap items-center gap-[6px]">
        <MiniChip tone="ok">Good {row.good}</MiniChip>
        <MiniChip tone="warn">Warn {row.needsImprovement}</MiniChip>
        <MiniChip tone="red">Poor {row.poor}</MiniChip>
      </div>
    </StatCard>
  );
}

const PATH_COLUMNS: DataTableColumn<WebVitalPathSummary>[] = [
  {
    key: "path",
    header: "Path",
    width: "minmax(0,1.7fr)",
    render: (row) => (
      <span className="ofly-mono block truncate text-[13px] text-[var(--ink)]" title={row.path}>
        {row.path}
      </span>
    ),
  },
  {
    key: "count",
    header: "Mẫu",
    width: "84px",
    align: "right",
    render: (row) => <span className="ofly-num">{row.count}</span>,
  },
  {
    key: "lcp",
    header: "LCP p75",
    width: "116px",
    align: "right",
    render: (row) => <span className="ofly-num">{metricValue("LCP", row.lcpP75)}</span>,
  },
  {
    key: "inp",
    header: "INP p75",
    width: "116px",
    align: "right",
    render: (row) => <span className="ofly-num">{metricValue("INP", row.inpP75)}</span>,
  },
  {
    key: "cls",
    header: "CLS p75",
    width: "108px",
    align: "right",
    render: (row) => <span className="ofly-num">{metricValue("CLS", row.clsP75)}</span>,
  },
  {
    key: "latest",
    header: "Mới nhất",
    width: "168px",
    align: "right",
    render: (row) => <span className="ofly-num text-[var(--ink3)]">{timeLabel(row.latestTimestamp)}</span>,
  },
];

const RECENT_COLUMNS: DataTableColumn<WebVitalRecord>[] = [
  {
    key: "name",
    header: "Metric",
    width: "104px",
    render: (row) => <span className="font-semibold text-[var(--ink)]">{row.name}</span>,
  },
  {
    key: "value",
    header: "Value",
    width: "124px",
    align: "right",
    render: (row) => <span className="ofly-num">{metricValue(row.name, row.value)}</span>,
  },
  {
    key: "rating",
    header: "Rating",
    width: "168px",
    render: (row) =>
      row.rating ? (
        <Chip tone={toneForRating(row.rating)}>{row.rating}</Chip>
      ) : (
        <span className="text-[var(--ink4)]">—</span>
      ),
  },
  {
    key: "path",
    header: "Path",
    width: "minmax(0,1.4fr)",
    render: (row) => (
      <span className="ofly-mono block truncate text-[13px]" title={row.path}>
        {row.path}
      </span>
    ),
  },
  {
    key: "time",
    header: "Time",
    width: "168px",
    align: "right",
    render: (row) => <span className="ofly-num text-[var(--ink3)]">{timeLabel(row.timestamp)}</span>,
  },
];

export default async function WebVitalsPage() {
  await requireRole(OBSERVABILITY_VIEWER_ROLES);
  const snapshot = (await getPersistentWebVitalsSnapshot()) || getWebVitalsSnapshot();

  return (
    <div>
      {/* Topbar của AdminShell đã dựng eyebrow + h1 cho route này → tránh lặp tiêu đề, chỉ còn mô tả + KPI. */}
      <div className="mb-[22px] flex flex-wrap items-end justify-between gap-6">
        <p className="m-0 max-w-[560px] text-[14px] leading-[1.55] text-[var(--ink3)]">
          Theo dõi các metric LCP, INP, CLS, FCP và TTFB gần nhất từ trình duyệt người dùng.
        </p>
        <div className="flex shrink-0 flex-wrap items-center gap-[10px]">
          <StatTile label="Mẫu" value={snapshot.total.toLocaleString("vi-VN")} minWidth={104} />
          {/* Mốc thời gian quá dài cho mono 20px của StatTile nên dựng tile nhỏ riêng, cùng hình khối. */}
          <div className="flex min-w-[176px] flex-col justify-center rounded-[10px] border border-[var(--line)] bg-[var(--paper)] px-[16px] py-[10px]">
            <Eyebrow>Mới nhất</Eyebrow>
            <span className="ofly-num mt-[7px] whitespace-nowrap text-[13px] leading-none text-[var(--ink2)]">
              {timeLabel(Date.parse(snapshot.generatedAt))}
            </span>
          </div>
        </div>
      </div>

      <div
        role="note"
        className="mb-4 flex items-start gap-[10px] rounded-[10px] border px-[14px] py-[10px]"
        style={{
          background: "var(--greenTint)",
          borderColor: "color-mix(in srgb, var(--green) 30%, transparent)",
        }}
      >
        <Database size={16} strokeWidth={1.5} className="mt-[2px] shrink-0" style={{ color: "var(--green)" }} />
        <span className="text-[12.5px] leading-[1.45] text-[var(--ink2)]">
          Collector đang ưu tiên đọc dữ liệu bền từ Postgres. Nếu migration chưa chạy hoặc DB tạm lỗi, dashboard tự fallback về bộ nhớ runtime gần nhất.
        </span>
      </div>

      {snapshot.byMetric.length === 0 ? (
        <Panel padded={false}>
          <div className="ofly-serif px-[18px] py-[54px] text-center text-[16px] italic text-[var(--ink3)]">
            Chưa có Web Vitals. Mở trang public một lần trong browser để reporter gửi beacon về `/api/analytics/web-vitals`.
          </div>
        </Panel>
      ) : (
        <div className="flex flex-col gap-[26px]">
          <section className="grid gap-[12px] md:grid-cols-2 xl:grid-cols-4">
            {snapshot.byMetric.map((row) => <MetricCard key={row.name} row={row} />)}
          </section>

          <section>
            <div className="mb-3">
              <Eyebrow>Path Breakdown</Eyebrow>
              <SectionTitle className="mt-[6px]">p75 theo route</SectionTitle>
            </div>
            <DataTable columns={PATH_COLUMNS} rows={snapshot.byPath} getRowKey={(row) => row.path} />
          </section>

          <section>
            <div className="mb-3">
              <Eyebrow>Recent</Eyebrow>
              <SectionTitle className="mt-[6px]">80 mẫu gần nhất</SectionTitle>
            </div>
            <DataTable
              columns={RECENT_COLUMNS}
              rows={snapshot.recent}
              getRowKey={(row) => `${row.id}-${row.timestamp}`}
            />
          </section>
        </div>
      )}
    </div>
  );
}
