import type { ReactNode } from "react";
import Link from "next/link";

import {
  AreaChart,
  BarList,
  ColumnChart,
  DonutChart,
  Gauge,
  type BarListItem,
  type DonutSegment,
} from "@/components/admin/ui/Charts";
import { Eyebrow, Panel } from "@/components/admin/ui/Panel";
import { formatNumber, formatRoute } from "@/lib/admin/ui/format";
import { STATUS_META } from "@/lib/admin/ui/status";
import { toneVars, type Tone } from "@/lib/admin/ui/tones";
import { DASHBOARD_VIEWER_ROLES } from "@/lib/auth/constants";
import { requireRole } from "@/lib/auth/requireRole";
import { getOpsSummary } from "@/lib/bookings/opsAggregation";

export const dynamic = "force-dynamic";

const AVG_FMT = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 });

// "YYYY-MM-DD" → "dd/mm" cho nhãn trục thời gian.
function dayMonth(key: string): string {
  return `${key.slice(8, 10)}/${key.slice(5, 7)}`;
}

interface KpiCardProps {
  label: string;
  value: string;
  sub: string;
  color?: string;
}

function KpiCard({ label, value, sub, color }: KpiCardProps) {
  return (
    <div className="rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-[20px] py-[18px]">
      <div className="ofly-sans text-[10px] font-semibold uppercase leading-none tracking-[1.5px] text-[var(--ink-faint)]">
        {label}
      </div>
      <div className="mt-[12px] ofly-serif text-[36px] font-medium leading-none" style={{ color: color ?? "var(--ink)" }}>
        {value}
      </div>
      <div className="mt-[9px] text-[12px] text-[var(--ink-soft)]">{sub}</div>
    </div>
  );
}

function EmptyChart({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-[120px] items-center justify-center text-center text-[13px] text-[var(--ink-soft)]">
      {children}
    </div>
  );
}

interface AlertDef {
  title: string;
  sub: string;
  tag: string;
  tone: Tone;
  href: string;
}

export default async function AdminDashboardPage() {
  await requireRole(DASHBOARD_VIEWER_ROLES);
  const summary = await getOpsSummary();

  const rustSolid = toneVars("rust").solid;
  const redSolid = toneVars("red").solid;
  const warnSolid = toneVars("warn").solid;

  // ----- KPI -----
  const issuePctLabel = summary.issueRateToday === null ? "—" : `${Math.round(summary.issueRateToday * 100)}%`;
  const avgPaidLabel = summary.avgPaidToTicketMin === null ? "—" : `${formatNumber(summary.avgPaidToTicketMin)}′`;

  // ----- Vé xuất 14 ngày -----
  const ticketSeries = summary.ticketsLast14d.map((point) => point.count);
  const ticketTotal = ticketSeries.reduce((acc, value) => acc + value, 0);
  const ticketAvg = ticketSeries.length > 0 ? ticketTotal / ticketSeries.length : 0;
  const ticketLabels = [0, 4, 9, 13]
    .filter((index) => index < summary.ticketsLast14d.length)
    .map((index) => dayMonth(summary.ticketsLast14d[index].date));
  const hasTickets = ticketTotal > 0;

  // ----- Donut trạng thái -----
  const statusSegments: DonutSegment[] = summary.byStatus
    .filter((row) => row.count > 0)
    .map((row) => ({
      label: STATUS_META[row.status].label,
      value: row.count,
      tone: STATUS_META[row.status].tone,
    }));

  // ----- Gauge SLA: tỉ lệ đơn trong hàng đợi còn trong hạn 30 phút -----
  const onTimeRate = summary.needTicketing > 0 ? (summary.needTicketing - summary.slaBreaches) / summary.needTicketing : null;
  const gaugeTone: Tone =
    onTimeRate === null ? "muted" : onTimeRate >= 0.9 ? "ok" : onTimeRate >= 0.7 ? "warn" : "red";
  const gaugeLabel = onTimeRate === null ? "—" : `${Math.round(onTimeRate * 100)}%`;

  // ----- BarList hãng -----
  const maxAirline = Math.max(...summary.byAirline.map((row) => row.count), 1);
  const airlineItems: BarListItem[] = summary.byAirline.map((row, index) => ({
    label: row.airline,
    value: formatNumber(row.count),
    pct: (row.count / maxAirline) * 100,
    tone: "rust",
    opacity: Math.max(0.4, 1 - index * 0.1),
  }));

  // ----- Cột khung giờ -----
  const hourItems = summary.ordersByHour.map((row) => ({ label: row.bucket, value: row.count }));
  const hasHours = summary.ordersByHour.some((row) => row.count > 0);

  // ----- Top chặng (14 ngày) -----
  const maxRoute = Math.max(...summary.topRoutes.map((row) => row.count), 1);
  const routeItems: BarListItem[] = summary.topRoutes.map((row) => ({
    label: formatRoute(row.route),
    value: formatNumber(row.count),
    pct: (row.count / maxRoute) * 100,
    tone: "rust",
  }));

  // ----- Cần xử lý ngay -----
  const alerts: AlertDef[] = [];
  if (summary.slaBreaches > 0) {
    alerts.push({
      title: `${summary.slaBreaches} đơn quá hạn SLA xuất vé`,
      sub: "Cần xuất vé ngay để tránh huỷ chỗ",
      tag: "Khẩn",
      tone: "red",
      href: "/admin/queue",
    });
  }
  if (summary.needTicketing > 0) {
    alerts.push({
      title: `${summary.needTicketing} đơn đang chờ xuất vé`,
      sub: "Trong hàng đợi xuất vé",
      tag: "Xử lý",
      tone: "rust",
      href: "/admin/queue",
    });
  }
  if (summary.heldExpiring > 0) {
    alerts.push({
      title: `${summary.heldExpiring} đơn sắp hết hạn giữ chỗ`,
      sub: "Sắp hết hạn trong 30 phút tới",
      tag: "Theo dõi",
      tone: "warn",
      href: "/admin/bookings?tab=held",
    });
  }
  if (summary.refundPending > 0) {
    alerts.push({
      title: `${summary.refundPending} đơn cần hoàn tiền`,
      sub: "Chờ xử lý hoàn tiền cho khách",
      tag: "Hoàn tiền",
      tone: "plum",
      href: "/admin/bookings?tab=refund",
    });
  }

  return (
    <div>
      <div className="mb-[14px] flex items-center justify-end">
        <div className="ofly-serif text-[11px] italic text-[var(--ink-faint)]">
          Số liệu vận hành kênh web · doanh thu, lợi nhuận &amp; công nợ xem tại RMS
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
        <KpiCard
          label="Cần xuất gấp"
          value={formatNumber(summary.needTicketing)}
          sub="đơn đang chờ xuất vé"
          color={summary.needTicketing > 0 ? rustSolid : undefined}
        />
        <KpiCard
          label="Quá SLA"
          value={formatNumber(summary.slaBreaches)}
          sub="đơn quá hạn 30 phút"
          color={summary.slaBreaches > 0 ? redSolid : undefined}
        />
        <KpiCard
          label="Đang giữ chỗ"
          value={formatNumber(summary.heldActive)}
          sub="đơn chờ khách thanh toán"
          color={summary.heldActive > 0 ? warnSolid : undefined}
        />
        <KpiCard label="Tỉ lệ xuất được" value={issuePctLabel} sub="vé xuất / đã trả · hôm nay" />
        <KpiCard label="TG trả → xuất" value={avgPaidLabel} sub="phút trung bình · hôm nay" />
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-[minmax(0,1.62fr)_minmax(0,1fr)]">
        <Panel>
          <div className="mb-[18px] flex items-start justify-between gap-3">
            <div>
              <Eyebrow>Vé xuất 14 ngày qua</Eyebrow>
              <div className="mt-[8px] ofly-serif text-[13px] text-[var(--ink-soft)]">
                <span className="text-[17px] font-medium text-[var(--ink)]">{formatNumber(ticketTotal)}</span> vé · trung bình{" "}
                <span className="text-[var(--ink)]">{AVG_FMT.format(ticketAvg)}</span>/ngày
              </div>
            </div>
            <div className="hidden gap-4 text-[11px] text-[var(--ink-soft)] sm:flex">
              <span className="inline-flex items-center gap-[6px]">
                <span className="inline-block h-[2.5px] w-[14px] rounded-[2px]" style={{ background: rustSolid }} />
                Vé xuất
              </span>
              <span className="inline-flex items-center gap-[6px]">
                <span className="inline-block w-[14px] border-t-[1.5px] border-dashed border-[var(--ink-faint)]" />
                Trung bình
              </span>
            </div>
          </div>
          {hasTickets ? (
            <AreaChart values={ticketSeries} labels={ticketLabels} tone="rust" />
          ) : (
            <EmptyChart>Chưa có vé xuất trong 14 ngày qua.</EmptyChart>
          )}
        </Panel>

        <Panel>
          <Eyebrow className="mb-[14px]">Phân bổ trạng thái đơn</Eyebrow>
          {statusSegments.length > 0 ? (
            <DonutChart segments={statusSegments} caption="ĐƠN" />
          ) : (
            <EmptyChart>Chưa có đơn nào.</EmptyChart>
          )}
        </Panel>
      </div>

      <div className="mb-5 grid gap-5 lg:grid-cols-3">
        <Panel>
          <Eyebrow>Xuất đúng hạn SLA</Eyebrow>
          <Gauge value={onTimeRate ?? 0} tone={gaugeTone} valueLabel={gaugeLabel} caption="đúng hạn 30 phút" />
        </Panel>
        <Panel>
          <Eyebrow className="mb-[18px]">Đơn xuất theo hãng</Eyebrow>
          {airlineItems.length > 0 ? <BarList items={airlineItems} /> : <EmptyChart>Chưa có dữ liệu hãng.</EmptyChart>}
        </Panel>
        <Panel>
          <Eyebrow className="mb-[16px]">Lượng đơn theo khung giờ</Eyebrow>
          {hasHours ? <ColumnChart items={hourItems} tone="rust" /> : <EmptyChart>Chưa có đơn hôm nay.</EmptyChart>}
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.62fr)_minmax(0,1fr)]">
        <Panel>
          <Eyebrow className="mb-[4px]">Cần xử lý ngay</Eyebrow>
          {alerts.length > 0 ? (
            <div>
              {alerts.map((alert) => {
                const tone = toneVars(alert.tone);
                return (
                  <Link
                    key={alert.title}
                    href={alert.href}
                    className="flex items-center gap-[14px] border-b border-[var(--line)] py-[14px] transition last:border-b-0 hover:opacity-70"
                  >
                    <span className="h-[9px] w-[9px] flex-none rounded-full" style={{ background: tone.solid }} />
                    <div className="flex-1">
                      <div className="text-[13px] font-medium">{alert.title}</div>
                      <div className="mt-[2px] text-[11px] text-[var(--ink-soft)]">{alert.sub}</div>
                    </div>
                    <span className="text-[11px] font-semibold" style={{ color: tone.fg }}>
                      {alert.tag}
                    </span>
                    <span className="text-[var(--ink-faint)]">›</span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="py-[28px] text-center text-[13px] text-[var(--ink-soft)]">Không có việc cần xử lý gấp.</div>
          )}
        </Panel>
        <Panel>
          <Eyebrow className="mb-[18px]">Top chặng bay · 14 ngày</Eyebrow>
          {routeItems.length > 0 ? <BarList items={routeItems} /> : <EmptyChart>Chưa có chặng bay nào.</EmptyChart>}
        </Panel>
      </div>
    </div>
  );
}
