import { DASHBOARD_VIEWER_ROLES } from "@/lib/auth/constants";
import { requireRole } from "@/lib/auth/requireRole";
import { getDashboardSummary, type DashboardSummary } from "@/lib/dashboard/query";
import { BreakdownTable } from "@/components/admin/dashboard/BreakdownTable";
import { StatCard } from "@/components/admin/dashboard/StatCard";

function money(value: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(value)} ₫`;
}

function percentLabel(value: number): string {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(value)}%`;
}

function visibleRevenueWindow(points: DashboardSummary["revenue30d"]): DashboardSummary["revenue30d"] {
  const nonZero = points.filter((point) => point.sale > 0 || point.profit > 0);

  if (nonZero.length > 0) {
    return nonZero.slice(-14);
  }

  return points.slice(-7);
}

function chartHeight(value: number, peak: number, maxHeight: number): number {
  if (value <= 0) {
    return 3;
  }

  return Math.max(10, Math.round((value / peak) * maxHeight));
}

export default async function AdminDashboardPage() {
  const session = await requireRole(DASHBOARD_VIEWER_ROLES);
  const summary = await getDashboardSummary({
    userId: session.user.id,
    role: session.user.role,
  });
  const recentRevenue = visibleRevenueWindow(summary.revenue30d);
  const hasRevenueData = recentRevenue.some((point) => point.sale > 0 || point.profit > 0);
  const peakRevenue = Math.max(...recentRevenue.map((point) => Math.max(point.sale, point.profit)), 1);
  const topAirlineProfit = Math.max(...summary.byAirline.map((row) => row.profit), 1);
  const agentRows = summary.byAgent.length <= 1 ? [] : summary.byAgent;
  const now = new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date());

  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="apg-eyebrow">Overview</p>
          <h1 className="mt-1 text-lg font-semibold text-[var(--apg-text-primary)]">Dashboard</h1>
          <p className="mt-1 text-sm text-[var(--apg-text-secondary)]">Theo dõi booking, doanh thu, lợi nhuận và công nợ.</p>
        </div>
        <div className="inline-flex w-fit items-center rounded-md border border-[var(--apg-border-default)] bg-[var(--apg-bg-surface)] px-3 py-2 text-xs text-[var(--apg-text-secondary)]">
          {now} · cache 30 giây
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          helper={`Hôm qua ${summary.today.bookingCountYesterday}, delta ${percentLabel(summary.today.deltaPercent)}`}
          label="Booking hôm nay"
          tone="navy"
          value={String(summary.today.bookingCount)}
        />
        <StatCard
          helper={`${summary.week.count} booking HELD/TICKETED trong 7 ngày`}
          label="Doanh thu tuần"
          tone="amber"
          value={money(summary.week.saleAmount)}
        />
        <StatCard
          helper={`${summary.month.bookingCount} booking đã xuất vé trong tháng`}
          label="Lợi nhuận tháng"
          tone="emerald"
          value={money(summary.month.profit)}
        />
        <StatCard
          helper={`${summary.outstanding.bookingCount} booking còn thiếu thanh toán`}
          label="Công nợ hiện tại"
          tone="slate"
          value={money(summary.outstanding.balance)}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
        <section className="apg-admin-sheet overflow-hidden">
          <div className="flex items-center justify-between border-b border-[var(--apg-border-default)] px-4 py-3">
            <div>
              <p className="apg-eyebrow">Timeline</p>
              <h2 className="mt-1 text-sm font-semibold">Doanh thu và lợi nhuận</h2>
            </div>
            <div className="hidden items-center gap-4 text-xs text-[var(--apg-text-secondary)] sm:flex">
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-400" /> Doanh thu
              </span>
              <span className="inline-flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-lime-400" /> Lợi nhuận
              </span>
            </div>
          </div>

          <div className="relative p-4">
            <div className="mb-3 flex items-center justify-between text-[11px] text-[var(--apg-text-muted)]">
              <span>{hasRevenueData ? "Ngày có dữ liệu gần nhất" : "7 ngày gần nhất"}</span>
              <span>Đỉnh: {money(peakRevenue)}</span>
            </div>
            {!hasRevenueData ? (
              <div className="rounded-lg border border-dashed border-[var(--apg-border-default)] bg-[var(--apg-bg-surface-muted)] px-4 py-10 text-center text-sm text-[var(--apg-text-secondary)]">
                Chưa có dữ liệu doanh thu trong kỳ này.
              </div>
            ) : (
              <div
                className="grid h-56 items-end gap-2"
                style={{ gridTemplateColumns: `repeat(${recentRevenue.length}, minmax(22px, 1fr))` }}
              >
                {recentRevenue.map((point) => {
                  const saleHeight = chartHeight(point.sale, peakRevenue, 184);
                  const profitHeight = chartHeight(point.profit, peakRevenue, 160);

                  return (
                    <div key={point.date} className="flex h-full min-w-0 flex-col justify-end gap-2">
                      <div className="flex flex-1 items-end justify-center gap-1 rounded-md border border-[var(--apg-border-default)] bg-[var(--apg-bg-surface-muted)] px-1.5 py-2">
                        <div
                          className={`w-2 rounded-full ${point.sale > 0 ? "bg-amber-400" : "bg-[var(--apg-border-strong)]"}`}
                          style={{ height: `${saleHeight}px` }}
                          title={`${point.date}: ${money(point.sale)}`}
                        />
                        <div
                          className={`w-2 rounded-full ${point.profit > 0 ? "bg-lime-400" : "bg-[var(--apg-border-strong)]"}`}
                          style={{ height: `${profitHeight}px` }}
                          title={`${point.date}: ${money(point.profit)}`}
                        />
                      </div>
                      <div className="truncate text-center text-[10px] text-[var(--apg-text-muted)]">{point.date.slice(5)}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="apg-admin-sheet overflow-hidden">
          <div className="border-b border-[var(--apg-border-default)] px-4 py-3">
            <p className="apg-eyebrow">Airline Mix</p>
            <h2 className="mt-1 text-sm font-semibold">Phân bổ theo hãng bay</h2>
          </div>
          <div className="divide-y divide-[var(--apg-border-default)]">
            {summary.byAirline.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-[var(--apg-text-secondary)]">Chưa có booking để phân bổ.</div>
            ) : (
              summary.byAirline.slice(0, 8).map((row) => {
                const width = Math.max(8, Math.round((row.profit / topAirlineProfit) * 100));

                return (
                  <div key={row.airline} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <div className="font-semibold text-[var(--apg-text-primary)]">{row.airline}</div>
                      <div className="apg-tabular text-xs text-[var(--apg-text-secondary)]">
                        {row.count} booking · {money(row.profit)}
                      </div>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--apg-bg-surface-soft)]">
                      <div className="h-full rounded-full bg-cyan-400" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <BreakdownTable
          columns={["Airline", "Count", "Net", "Markup", "Profit"]}
          eyebrow="Airline"
          rows={summary.byAirline.map((row) => [row.airline, row.count, money(row.netAmount), money(row.markup), money(row.profit)])}
          title="Theo hãng bay"
        />
        <BreakdownTable
          columns={["Agent", "Count", "Sell", "Profit"]}
          emptyMessage="Chưa có nhân viên khác ngoài tài khoản hiện tại."
          eyebrow="Agent"
          rows={agentRows.map((row) => [row.email, row.count, money(row.sellAmount), money(row.profit)])}
          title="Theo nhân viên tạo booking"
        />
      </div>
    </div>
  );
}
