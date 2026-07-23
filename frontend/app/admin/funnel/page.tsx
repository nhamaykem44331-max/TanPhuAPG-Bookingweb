import { Eyebrow, Panel } from "@/components/admin/ui/Panel";
import { StatTile, type StatTileTone } from "@/components/admin/ui/Stat";
import { FilterTab } from "@/components/admin/ui/Tabs";
import { formatNumber } from "@/lib/admin/ui/format";
import { DASHBOARD_VIEWER_ROLES } from "@/lib/auth/constants";
import { requireRole } from "@/lib/auth/requireRole";
import { funnelQuerySchema, getFunnel, type FunnelQuery } from "@/lib/bookings/opsAggregation";

export const dynamic = "force-dynamic";

interface AdminFunnelPageProps {
  searchParams?: Record<string, string | string[] | undefined>;
}

const RANGE_LABELS: Record<FunnelQuery["range"], string> = {
  today: "Hôm nay",
  "7d": "7 ngày",
  "30d": "30 ngày",
};

const RANGE_ORDER: FunnelQuery["range"][] = ["today", "7d", "30d"];

function singleValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function pctOf(value: number, base: number): number {
  return base > 0 ? Math.min(100, (value / base) * 100) : 0;
}

export default async function AdminFunnelPage({ searchParams }: AdminFunnelPageProps) {
  await requireRole(DASHBOARD_VIEWER_ROLES);
  const query = funnelQuerySchema.parse({ range: singleValue(searchParams?.range) });
  const funnel = await getFunnel(query);

  const base = funnel.held;

  const steps = [
    { label: "Giữ chỗ", value: funnel.held },
    { label: "Chờ thanh toán", value: funnel.pendingPayment },
    { label: "Đã thanh toán", value: funnel.paid },
    { label: "Đã xuất vé", value: funnel.ticketed },
  ];

  const heldToPaidLabel = base > 0 ? `${Math.round(pctOf(funnel.paid, base))}%` : "—";
  const cannotIssueLabel = funnel.cannotIssueRate === null ? "—" : `${Math.round(funnel.cannotIssueRate * 100)}%`;
  const avgPaidLabel = funnel.avgPaidToTicketMin === null ? "—" : `${formatNumber(funnel.avgPaidToTicketMin)}′`;

  const kpis: { label: string; value: string; sub: string; tone: StatTileTone }[] = [
    { label: "Giữ chỗ → trả tiền", value: heldToPaidLabel, sub: "tỉ lệ chốt thanh toán", tone: "plain" },
    { label: "Tỉ lệ không xuất được", value: cannotIssueLabel, sub: "trên số đơn đã trả tiền", tone: "rust" },
    { label: "TG trung bình trả → xuất", value: avgPaidLabel, sub: "phút từ lúc trả đến khi xuất vé", tone: "plain" },
    { label: "Bỏ giữa chừng", value: formatNumber(funnel.abandoned), sub: "giữ chỗ nhưng không thanh toán", tone: "amber" },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="ofly-serif text-[12.5px] italic leading-[1.5] text-[var(--ink3)]">
          Phễu chỉ tính các bước đã ghi nhận trên web · bước tìm kiếm đầu phễu chưa theo dõi
        </div>
        {/* Lọc bằng query string → FilterTab render <Link>, giữ nguyên URL cũ */}
        <div className="flex flex-wrap gap-[6px]">
          {RANGE_ORDER.map((range) => (
            <FilterTab
              key={range}
              href={range === "today" ? "/admin/funnel" : `/admin/funnel?range=${range}`}
              active={query.range === range}
            >
              {RANGE_LABELS[range]}
            </FilterTab>
          ))}
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel padded={false} className="px-4 py-5 sm:px-[26px] sm:py-[22px]">
          <Eyebrow className="mb-[18px]">
            Phễu vận hành · {RANGE_LABELS[query.range]} · giữ chỗ → xuất vé
          </Eyebrow>
          <div className="flex flex-col gap-[10px]">
            {steps.map((step, index) => {
              const pct = pctOf(step.value, base);
              return (
                <div
                  key={step.label}
                  className="rounded-[10px] border px-[14px] py-[12px]"
                  style={{
                    background: "var(--rustTint)",
                    borderColor: "color-mix(in srgb, var(--rust) 16%, transparent)",
                  }}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[13.5px] font-semibold text-[var(--ink)]">{step.label}</span>
                    <span className="flex items-baseline gap-[9px]">
                      <span className="ofly-num text-[16px] font-bold text-[var(--ink)]">
                        {formatNumber(step.value)}
                      </span>
                      <span className="ofly-serif text-[21px] font-medium leading-none tracking-[-0.6px] text-[var(--rust)]">
                        {Math.round(pct)}%
                      </span>
                    </span>
                  </div>
                  {/* Rãnh nền --paper để thanh --rust nổi trên khối tint ở cả 2 theme */}
                  <div className="mt-[10px] h-[8px] overflow-hidden rounded-[100px] bg-[var(--paper)]">
                    <div
                      className="h-full rounded-[100px]"
                      style={{
                        width: `${pct}%`,
                        background: "var(--rust)",
                        // Bậc sau nhạt dần → mắt đọc được thứ tự phễu ngay cả khi số gần nhau
                        opacity: Math.max(0.45, 1 - index * 0.13),
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>

        {/* 1 cột trên mobile để nhãn eyebrow dài không phải xuống dòng */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 lg:content-start">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="flex flex-col gap-[6px]">
              <StatTile label={kpi.label} value={kpi.value} tone={kpi.tone} minWidth={0} />
              <span className="px-[2px] text-[11.5px] leading-[1.45] text-[var(--ink3)]">{kpi.sub}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
