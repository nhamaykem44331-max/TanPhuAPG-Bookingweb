import Link from "next/link";

import { BreakdownTable } from "@/components/admin/dashboard/BreakdownTable";
import { StatCard } from "@/components/admin/dashboard/StatCard";
import { ExportButton } from "@/components/admin/ExportButton";
import { REVENUE_REPORT_ROLES } from "@/lib/auth/constants";
import { requireRole } from "@/lib/auth/requireRole";
import { getRevenueReportData, revenueReportQuerySchema, type RevenueReportMode } from "@/lib/reports/revenue";

interface RevenueReportPageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

const MODE_OPTIONS: Array<{ value: RevenueReportMode; label: string; description: string }> = [
  {
    value: "PAYMENT_DATE",
    label: "Ngày thu tiền",
    description: "Góc nhìn kế toán theo dòng tiền thực nhận và hoàn tiền.",
  },
  {
    value: "BOOKING_DATE",
    label: "Ngày tạo booking",
    description: "Góc nhìn vận hành theo thời điểm booking được ghi nhận vào hệ thống.",
  },
  {
    value: "ISSUE_DATE",
    label: "Ngày xuất vé",
    description: "Góc nhìn theo các booking đã issue và thời điểm xác nhận xuất vé.",
  },
] as const;

function singleValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function money(value: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(value)} ₫`;
}

function modeLabel(mode: RevenueReportMode): string {
  return MODE_OPTIONS.find((option) => option.value === mode)?.label || mode;
}

function primaryCards(mode: RevenueReportMode, summary: Awaited<ReturnType<typeof getRevenueReportData>>["summary"]) {
  if (mode === "PAYMENT_DATE") {
    return [
      {
        label: "Thu vào",
        value: money(summary.collected),
        helper: `${summary.paymentCount} payment trong phạm vi báo cáo`,
        tone: "emerald" as const,
      },
      {
        label: "Hoàn tiền",
        value: money(summary.refunded),
        helper: "Tổng refund theo ngày thu tiền",
        tone: "amber" as const,
      },
      {
        label: "Thu thuần",
        value: money(summary.netCashIn),
        helper: "Collected trừ đi refund",
        tone: "navy" as const,
      },
      {
        label: "Booking liên quan",
        value: String(summary.bookingCount),
        helper: `${summary.ticketedCount} booking đã ticketed trong tập liên quan`,
        tone: "slate" as const,
      },
    ];
  }

  return [
    {
      label: mode === "ISSUE_DATE" ? "Gross sale đã issue" : "Gross sale",
      value: money(summary.grossSale),
      helper: `${summary.bookingCount} booking trong phạm vi ${modeLabel(mode).toLowerCase()}`,
      tone: "navy" as const,
    },
    {
      label: "Lợi nhuận",
      value: money(summary.profit),
      helper: `${summary.ticketedCount} booking ticketed`,
      tone: "amber" as const,
    },
    {
      label: "Đã thu",
      value: money(summary.collected),
      helper: `${summary.paymentCount} payment gắn với tập booking này`,
      tone: "emerald" as const,
    },
    {
      label: "Công nợ",
      value: money(summary.outstanding),
      helper: "Số dư còn mở của tập booking đang xem",
      tone: "slate" as const,
    },
  ];
}

function peakTimelineValue(report: Awaited<ReturnType<typeof getRevenueReportData>>): number {
  return report.timeline.reduce((max, point) => {
    const candidate = report.query.mode === "PAYMENT_DATE" ? Math.max(point.collected, point.netCashIn) : Math.max(point.grossSale, point.profit);
    return Math.max(max, candidate);
  }, 0) || 1;
}

export default async function RevenueReportPage({ searchParams }: RevenueReportPageProps) {
  const session = await requireRole(REVENUE_REPORT_ROLES);
  const parsed = revenueReportQuerySchema.parse({
    mode: singleValue(searchParams?.mode),
    from: singleValue(searchParams?.from),
    to: singleValue(searchParams?.to),
    airline: singleValue(searchParams?.airline),
    agentId: singleValue(searchParams?.agentId),
    status: singleValue(searchParams?.status),
    paymentMethod: singleValue(searchParams?.paymentMethod),
  });
  const report = await getRevenueReportData(parsed, {
    userId: session.user.id,
    role: session.user.role,
  });
  const cards = primaryCards(report.query.mode, report.summary);
  const peak = peakTimelineValue(report);

  return (
    <div className="space-y-6">
      <section className="apg-admin-sheet overflow-hidden">
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1.55fr)_380px]">
          <div className="px-5 py-6 lg:px-6">
            <p className="apg-eyebrow">Revenue Reports</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[var(--apg-aviation-navy-deep)] lg:text-4xl">Báo cáo doanh thu 3 mode</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--apg-text-secondary)] lg:text-base">
              Mode mặc định là <strong>ngày thu tiền</strong> để kế toán nhìn dòng tiền trước. Hai mode còn lại giúp
              đội vận hành đối chiếu theo lúc tạo booking hoặc lúc issue.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-2">
              <span className="apg-chip apg-chip-active">{modeLabel(report.query.mode)}</span>
              <span className="apg-chip">From {report.query.from}</span>
              <span className="apg-chip">To {report.query.to}</span>
            </div>
          </div>

          <div className="border-t border-[var(--apg-border-default)] bg-[linear-gradient(180deg,rgba(233,238,242,0.95),rgba(255,255,255,0.98))] px-5 py-5 xl:border-l xl:border-t-0">
            <div className="space-y-3">
              {MODE_OPTIONS.map((option) => (
                <div
                  key={option.value}
                  className={`rounded-[20px] border px-4 py-4 ${
                    option.value === report.query.mode
                      ? "border-[var(--apg-border-strong)] bg-white"
                      : "border-[var(--apg-border-default)] bg-white/70"
                  }`}
                >
                  <div className="text-base font-semibold text-[var(--apg-aviation-navy-deep)]">{option.label}</div>
                  <div className="mt-1 text-sm leading-6 text-[var(--apg-text-secondary)]">{option.description}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="apg-admin-toolbar px-5 py-5 lg:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="apg-eyebrow">Filters</p>
            <h3 className="mt-2 text-2xl font-semibold text-[var(--apg-aviation-navy-deep)]">Khóa phạm vi báo cáo</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--apg-text-secondary)]">
              Cùng một dashboard nhưng thay đổi trục thời gian sẽ cho câu chuyện rất khác. Đây là điểm quan trọng nhất
              của module báo cáo Phase 2.
            </p>
          </div>

          <div className="w-full xl:w-auto">
            <ExportButton
              basePath="/api/admin/reports/revenue/export"
              query={{
                mode: report.query.mode,
                from: report.query.from,
                to: report.query.to,
                airline: report.query.airline,
                agentId: report.query.agentId,
                status: report.query.status,
                paymentMethod: report.query.paymentMethod,
              }}
            />
          </div>
        </div>

        <form className="mt-5 grid gap-3 xl:grid-cols-[220px_180px_180px_160px_200px_200px_auto] xl:items-end">
          <label className="text-sm font-medium text-[var(--apg-text-secondary)]">
            Mode
            <select className="apg-field mt-2" defaultValue={report.query.mode} name="mode">
              {MODE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-medium text-[var(--apg-text-secondary)]">
            Từ ngày
            <input className="apg-field mt-2" defaultValue={report.query.from} name="from" type="date" />
          </label>

          <label className="text-sm font-medium text-[var(--apg-text-secondary)]">
            Đến ngày
            <input className="apg-field mt-2" defaultValue={report.query.to} name="to" type="date" />
          </label>

          <label className="text-sm font-medium text-[var(--apg-text-secondary)]">
            Airline
            <input className="apg-field mt-2" defaultValue={report.query.airline ?? ""} name="airline" placeholder="VN / VJ / QH" />
          </label>

          <label className="text-sm font-medium text-[var(--apg-text-secondary)]">
            Booking status
            <input className="apg-field mt-2" defaultValue={report.query.status ?? ""} name="status" placeholder="HELD / TICKETED" />
          </label>

          <label className="text-sm font-medium text-[var(--apg-text-secondary)]">
            Payment method
            <input className="apg-field mt-2" defaultValue={report.query.paymentMethod ?? ""} name="paymentMethod" placeholder="QR / BANK / CASH" />
          </label>

          <div className="flex items-end gap-3">
            <button className="apg-btn-primary w-full" type="submit">
              Chạy báo cáo
            </button>
            <Link className="apg-btn-secondary inline-flex w-full items-center justify-center" href="/admin/reports/revenue">
              Đặt lại
            </Link>
          </div>
        </form>
      </section>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <StatCard key={card.label} helper={card.helper} label={card.label} tone={card.tone} value={card.value} />
        ))}
      </div>

      <section className="apg-admin-sheet overflow-hidden">
        <div className="border-b border-[var(--apg-border-default)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(238,242,245,0.98))] px-5 py-4 lg:px-6">
          <p className="apg-eyebrow">Timeline</p>
          <h3 className="mt-2 text-2xl font-semibold text-[var(--apg-aviation-navy-deep)]">Nhịp doanh thu theo ngày</h3>
        </div>

        <div className="p-5 lg:p-6">
          <div className="grid gap-3 md:grid-cols-12 md:items-end">
            {report.timeline.map((point) => {
              const primaryValue = report.query.mode === "PAYMENT_DATE" ? point.collected : point.grossSale;
              const secondaryValue = report.query.mode === "PAYMENT_DATE" ? point.netCashIn : point.profit;
              const primaryHeight = Math.max(14, Math.round((primaryValue / peak) * 180));
              const secondaryHeight = secondaryValue > 0 ? Math.max(8, Math.round((secondaryValue / peak) * 140)) : 6;

              return (
                <div key={point.date} className="flex flex-col gap-2">
                  <div className="flex h-[220px] items-end justify-center gap-1 rounded-[18px] border border-[var(--apg-border-default)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,247,249,0.98))] px-2 py-3">
                    <div className="w-3 rounded-full bg-[var(--apg-aviation-navy)]" style={{ height: `${primaryHeight}px` }} />
                    <div className="w-3 rounded-full bg-[var(--apg-brand-gold)]" style={{ height: `${secondaryHeight}px` }} />
                  </div>
                  <div className="text-center text-xs text-[var(--apg-text-secondary)]">{point.date.slice(5)}</div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-[var(--apg-text-secondary)]">
            <span className="inline-flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-[var(--apg-aviation-navy)]" />
              {report.query.mode === "PAYMENT_DATE" ? "Collected" : "Gross sale"}
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-[var(--apg-brand-gold)]" />
              {report.query.mode === "PAYMENT_DATE" ? "Net cash in" : "Profit"}
            </span>
          </div>
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <BreakdownTable
          columns={["Airline", "Bookings", "Gross", "Collected", "Net cash"]}
          eyebrow="Airline Mix"
          rows={report.byAirline.map((row) => [row.key, row.bookingCount, money(row.grossSale), money(row.collected), money(row.netCashIn)])}
          title="Theo hãng bay"
        />
        <BreakdownTable
          columns={["Agent", "Bookings", "Gross", "Collected", "Net cash"]}
          eyebrow="Agent Mix"
          rows={report.byAgent.map((row) => [row.key, row.bookingCount, money(row.grossSale), money(row.collected), money(row.netCashIn)])}
          title="Theo người tạo booking"
        />
      </div>

      <BreakdownTable
        columns={["Method", "Payments", "Collected", "Refunded", "Net cash"]}
        eyebrow="Payment Mix"
        rows={report.byPaymentMethod.map((row) => [row.key, row.paymentCount, money(row.collected), money(row.refunded), money(row.netCashIn)])}
        title="Theo phương thức thanh toán"
      />
    </div>
  );
}
