import Link from "next/link";

import { Eyebrow, Panel } from "@/components/admin/ui/Panel";
import { formatNumber } from "@/lib/admin/ui/format";
import { toneVars } from "@/lib/admin/ui/tones";
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
  const rustSolid = toneVars("rust").solid;
  const warnSolid = toneVars("warn").solid;

  const steps = [
    { label: "Giữ chỗ", value: funnel.held },
    { label: "Chờ thanh toán", value: funnel.pendingPayment },
    { label: "Đã thanh toán", value: funnel.paid },
    { label: "Đã xuất vé", value: funnel.ticketed },
  ];

  const heldToPaidLabel = base > 0 ? `${Math.round(pctOf(funnel.paid, base))}%` : "—";
  const cannotIssueLabel = funnel.cannotIssueRate === null ? "—" : `${Math.round(funnel.cannotIssueRate * 100)}%`;
  const avgPaidLabel = funnel.avgPaidToTicketMin === null ? "—" : `${formatNumber(funnel.avgPaidToTicketMin)}′`;

  const kpis = [
    { label: "Giữ chỗ → trả tiền", value: heldToPaidLabel, sub: "tỉ lệ chốt thanh toán", color: "var(--ink)" },
    { label: "Tỉ lệ không xuất được", value: cannotIssueLabel, sub: "trên số đơn đã trả tiền", color: rustSolid },
    { label: "TG trung bình trả → xuất", value: avgPaidLabel, sub: "phút từ lúc trả đến khi xuất vé", color: "var(--ink)" },
    { label: "Bỏ giữa chừng", value: formatNumber(funnel.abandoned), sub: "giữ chỗ nhưng không thanh toán", color: warnSolid },
  ];

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="ofly-serif text-[11px] italic text-[var(--ink-faint)]">
          Phễu chỉ tính các bước đã ghi nhận trên web · bước tìm kiếm đầu phễu chưa theo dõi
        </div>
        <div className="flex flex-wrap gap-[6px]">
          {RANGE_ORDER.map((range) => {
            const active = query.range === range;
            return (
              <Link
                key={range}
                href={{ pathname: "/admin/funnel", query: range === "today" ? {} : { range } }}
                className="inline-flex min-h-[40px] items-center rounded-[8px] border px-[16px] py-[10px] text-[13px] font-medium leading-none transition"
                style={
                  active
                    ? { borderColor: "var(--rust)", background: "var(--rust)", color: "#F5F1EA" }
                    : { borderColor: "var(--line)", background: "var(--surface)", color: "var(--ink-soft)" }
                }
              >
                {RANGE_LABELS[range]}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel padded={false} className="px-4 py-5 sm:px-[30px] sm:py-[26px]">
          <Eyebrow className="mb-[24px]">
            Phễu vận hành · {RANGE_LABELS[query.range]} · giữ chỗ → xuất vé
          </Eyebrow>
          {steps.map((step, index) => (
            <div key={step.label} className="mb-5 last:mb-0">
              <div className="mb-[8px] flex items-baseline justify-between">
                <span className="text-[14px] font-medium">{step.label}</span>
                <span>
                  <span className="ofly-serif text-[19px] font-medium">{formatNumber(step.value)}</span>{" "}
                  <span className="text-[12px] text-[var(--ink-soft)]">{Math.round(pctOf(step.value, base))}%</span>
                </span>
              </div>
              <div className="h-[9px] overflow-hidden rounded-[5px] bg-[var(--surface-2)]">
                <div
                  className="h-full rounded-[5px]"
                  style={{
                    width: `${pctOf(step.value, base)}%`,
                    background: rustSolid,
                    opacity: Math.max(0.35, 1 - index * 0.13),
                  }}
                />
              </div>
            </div>
          ))}
        </Panel>

        <div className="flex flex-col gap-4">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="rounded-[10px] border border-[var(--line)] bg-[var(--surface)] px-[22px] py-[20px]">
              <div className="ofly-sans text-[10px] font-semibold uppercase leading-none tracking-[1.5px] text-[var(--ink-faint)]">
                {kpi.label}
              </div>
              <div className="mt-[10px] ofly-serif text-[30px] font-medium leading-none" style={{ color: kpi.color }}>
                {kpi.value}
              </div>
              <div className="mt-[5px] text-[12px] text-[var(--ink-soft)]">{kpi.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
