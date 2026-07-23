import type { BookingStatus } from "@prisma/client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { CustomerBlacklistDialog } from "@/components/admin/CustomerBlacklistDialog";
import { CustomerForm } from "@/components/admin/CustomerForm";
import { CustomerMergeDialog } from "@/components/admin/CustomerMergeDialog";
import { Btn } from "@/components/admin/ui/Btn";
import { Chip, MiniChip, StatusChip } from "@/components/admin/ui/Chip";
import { DataTable, type DataTableColumn } from "@/components/admin/ui/DataTable";
import { Eyebrow, Panel } from "@/components/admin/ui/Panel";
import { SectionTitle } from "@/components/admin/ui/PageHead";
import { formatDateTime, formatNumber, formatVnd } from "@/lib/admin/ui/format";
import { ADMIN_ROLES, CUSTOMER_MANAGER_ROLES } from "@/lib/auth/constants";
import { requireRole } from "@/lib/auth/requireRole";
import { getAdminCustomerById, type AdminCustomerBooking } from "@/lib/customers/admin";

interface CustomerDetailPageProps {
  params: {
    id: string;
  };
}

// Tiền hiển thị phải khớp mọi màn admin khác nên đi qua helper chung; chỉ nhánh
// ngoại tệ (hiếm) mới ghép thêm mã tiền tệ, vẫn dùng formatNumber chung.
function formatSaleAmount(value: number, currency: string | null | undefined): string {
  return !currency || currency === "VND" ? formatVnd(value) : `${formatNumber(value)} ${currency}`;
}

function displayValue(value: string | null | undefined): string {
  return value && value.trim() ? value : "-";
}

function stringifyTags(tags: unknown): string {
  if (tags === null || tags === undefined) {
    return "{}";
  }

  return JSON.stringify(tags, null, 2);
}

function initials(fullName: string): string {
  return fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "KH";
}

// Ô thông tin dùng lại trong hồ sơ: eyebrow + giá trị. Gom vào một chỗ để mọi ô
// cùng nhịp chữ, khỏi lặp class ở 10 chỗ.
function Info({ label, value, mono }: { label: ReactNode; value: ReactNode; mono?: boolean }) {
  return (
    <div className="rounded-[10px] border border-[var(--line)] bg-[var(--paper2)] px-[16px] py-[12px]">
      <Eyebrow>{label}</Eyebrow>
      <div
        className={`mt-[6px] break-words text-[14px] font-semibold text-[var(--ink)] ${mono ? "ofly-num" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}

// Dòng "nhãn: giá trị" trong panel kiểm soát.
function PaneRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="shrink-0 text-[12.5px] text-[var(--ink3)]">{label}</span>
      <span className="ofly-num min-w-0 truncate text-right text-[13px] font-semibold text-[var(--ink)]">
        {value}
      </span>
    </div>
  );
}

export default async function CustomerDetailPage({ params }: CustomerDetailPageProps) {
  const session = await requireRole(ADMIN_ROLES);
  const detail = await getAdminCustomerById(params.id);

  if (!detail) {
    notFound();
  }

  const { customer, bookings } = detail;
  const canManage = CUSTOMER_MANAGER_ROLES.includes(session.user.role);
  const canMerge = session.user.role === "SUPER_ADMIN";

  const bookingColumns: DataTableColumn<AdminCustomerBooking>[] = [
    {
      key: "pnr",
      header: "BOOKING",
      width: "minmax(0,1fr)",
      render: (booking) => (
        <div className="min-w-0">
          <div className="ofly-num text-[13px] font-bold tracking-[1px] text-[var(--rust)]">
            {booking.pnr || "PENDING"}
          </div>
          <div className="ofly-num mt-[2px] truncate text-[11px] text-[var(--ink4)]">{booking.id.slice(-8)}</div>
        </div>
      ),
    },
    {
      key: "routeSummary",
      header: "HÀNH TRÌNH",
      width: "minmax(0,1.3fr)",
      // Ô bảng theo hợp đồng: thang 13.5px, mã chặng dùng mono cho thẳng cột
      render: (booking) => (
        <span className="ofly-num block truncate text-[13.5px] font-medium tracking-[0.5px] text-[var(--ink)]">
          {booking.routeSummary}
        </span>
      ),
    },
    {
      key: "saleAmount",
      header: "GIÁ BÁN",
      width: "140px",
      align: "right",
      render: (booking) => (
        <span className="ofly-num text-[13.5px] font-bold text-[var(--ink)]">
          {formatSaleAmount(booking.saleAmount, booking.currency)}
        </span>
      ),
    },
    {
      key: "status",
      header: "TRẠNG THÁI",
      width: "168px",
      render: (booking) => <StatusChip status={booking.status as BookingStatus} />,
    },
    {
      key: "createdAt",
      header: "NGÀY TẠO",
      width: "160px",
      render: (booking) => (
        <span className="ofly-num text-[12.5px] text-[var(--ink3)]">{formatDateTime(booking.createdAt)}</span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-[10px]">
        <Link
          className="inline-flex items-center gap-[7px] text-[13px] font-semibold text-[var(--rust)] transition-colors hover:text-[var(--rustLt)]"
          href="/admin/customers"
        >
          <ArrowLeft size={15} strokeWidth={1.9} />
          Quay lại danh sách khách hàng
        </Link>
        <MiniChip tone="muted">
          <span className="ofly-num">Customer ID {customer.id.slice(-8)}</span>
        </MiniChip>
        <Chip tone={customer.blacklisted ? "red" : "ok"}>
          {customer.blacklisted ? "Đang blacklist" : "Hồ sơ hoạt động"}
        </Chip>
      </div>

      <Panel padded={false} className="overflow-hidden">
        <div className="grid xl:grid-cols-[minmax(0,1.55fr)_380px]">
          <div className="px-[20px] py-[22px]">
            <Eyebrow>Customer Desk</Eyebrow>
            <div className="mt-4 flex flex-wrap items-center gap-[14px]">
              <span
                aria-hidden="true"
                className="inline-flex h-[56px] w-[56px] flex-none items-center justify-center rounded-full text-[18px] font-bold tracking-[0.5px]"
                style={{ background: "var(--gradNavy)", color: "#FFFFFF" }}
              >
                {initials(customer.fullName)}
              </span>
              <div className="min-w-0">
                <h2 className="ofly-serif m-0 text-[27px] font-medium leading-[1.1] tracking-[-1px] text-[var(--ink)] sm:text-[31px]">
                  {customer.fullName}
                </h2>
                <p className="m-0 mt-[8px] max-w-[520px] text-[13px] leading-[1.55] text-[var(--ink3)]">
                  Hồ sơ khách hàng nội bộ dùng cho booking, blacklist và merge duplicate.
                </p>
              </div>
            </div>

            <div className="mt-[18px] grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Info label="Điện thoại" value={displayValue(customer.phone)} mono />
              <Info label="Email" value={displayValue(customer.email)} />
              <Info label="Số booking" value={customer.bookingCount} mono />
              <Info label="Tạo lúc" value={formatDateTime(customer.createdAt)} mono />
            </div>
          </div>

          {/* Cột phải kiểu DetailPane của Manager: nền --paper2, tách bằng viền --line */}
          <div className="space-y-3 border-t border-[var(--line)] bg-[var(--paper2)] px-[20px] py-[20px] xl:border-l xl:border-t-0">
            <Panel>
              <Eyebrow>Tác vụ chính</Eyebrow>
              <div className="mt-[14px] flex flex-col gap-[10px]">
                {canManage ? (
                  <CustomerBlacklistDialog
                    actorId={session.user.id}
                    currentBlacklisted={customer.blacklisted}
                    currentTags={customer.tags}
                    customerId={customer.id}
                  />
                ) : (
                  <Btn variant="ghost" full disabled>
                    Chỉ xem hồ sơ
                  </Btn>
                )}
                {canMerge ? (
                  <CustomerMergeDialog
                    disabled={customer.blacklisted}
                    primary={{
                      id: customer.id,
                      fullName: customer.fullName,
                      phone: customer.phone,
                      email: customer.email,
                      bookingCount: customer.bookingCount,
                      blacklisted: customer.blacklisted,
                    }}
                  />
                ) : (
                  <Btn variant="ghost" full disabled>
                    Merge duplicate
                  </Btn>
                )}
              </div>
            </Panel>

            <Panel>
              <Eyebrow>Điểm kiểm soát</Eyebrow>
              <div className="mt-[14px] space-y-[9px]">
                <PaneRow label="CMND / CCCD" value={displayValue(customer.idNumber)} />
                <PaneRow label="Passport" value={displayValue(customer.passport)} />
                <PaneRow label="Ngày sinh" value={displayValue(customer.dob)} />
                <PaneRow label="Created by" value={displayValue(customer.createdById)} />
              </div>
            </Panel>
          </div>
        </div>
      </Panel>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Panel padded={false} className="overflow-hidden">
          <div className="border-b border-[var(--line)] bg-[var(--paper2)] px-[20px] py-[16px]">
            <Eyebrow>Customer Profile</Eyebrow>
            <SectionTitle className="mt-[8px]">Thông tin và tags nội bộ</SectionTitle>
          </div>

          <div className="grid gap-4 p-[20px] lg:grid-cols-2">
            <div className="space-y-3">
              <Info label="Họ tên" value={customer.fullName} />
              <div className="rounded-[10px] border border-[var(--line)] bg-[var(--paper2)] px-[16px] py-[12px]">
                <Eyebrow>Liên hệ</Eyebrow>
                <div className="mt-[9px] space-y-[7px]">
                  <PaneRow label="Điện thoại" value={displayValue(customer.phone)} />
                  <PaneRow label="Email" value={displayValue(customer.email)} />
                </div>
              </div>
              <div className="rounded-[10px] border border-[var(--line)] bg-[var(--paper2)] px-[16px] py-[12px]">
                <Eyebrow>Giấy tờ</Eyebrow>
                <div className="mt-[9px] space-y-[7px]">
                  <PaneRow label="CMND / CCCD" value={displayValue(customer.idNumber)} />
                  <PaneRow label="Passport" value={displayValue(customer.passport)} />
                </div>
              </div>
            </div>

            <aside className="rounded-[10px] border border-[var(--line)] bg-[var(--paper2)] px-[16px] py-[14px]">
              <Eyebrow>Tags JSON</Eyebrow>
              <p className="mt-[10px] text-[13px] leading-[1.55] text-[var(--ink3)]">
                Đây là vùng metadata phục vụ blacklist reason, merge marker và các cờ nghiệp vụ mở rộng trong các sprint sau.
              </p>
              {/* Khối JSON nền navy đặc — chữ trắng là ngoại lệ hex duy nhất được phép */}
              <pre
                className="ofly-mono mt-[14px] max-h-[340px] overflow-auto rounded-[10px] p-[14px] text-[11.5px] leading-[1.7]"
                style={{ background: "var(--navy)", color: "#FFFFFF" }}
              >
                {stringifyTags(customer.tags)}
              </pre>
            </aside>
          </div>
        </Panel>

        <Panel padded={false} className="overflow-hidden">
          <div className="border-b border-[var(--line)] bg-[var(--paper2)] px-[20px] py-[16px]">
            <Eyebrow>Edit Customer</Eyebrow>
            <SectionTitle className="mt-[8px]">Chỉnh sửa hồ sơ</SectionTitle>
          </div>

          <div className="p-[20px]">
            <p className="m-0 mb-[16px] text-[13px] leading-[1.55] text-[var(--ink3)]">
              Toàn bộ thay đổi ở đây sẽ ghi AuditLog theo diff để truy nguyên chính xác field nào đã đổi.
            </p>
            {canManage ? (
              <CustomerForm customer={customer} mode="edit" />
            ) : (
              <div className="ofly-serif rounded-[10px] border border-dashed border-[var(--line2)] px-4 py-[42px] text-center text-[15px] italic text-[var(--ink3)]">
                Role hiện tại chỉ có quyền xem hồ sơ khách hàng.
              </div>
            )}
          </div>
        </Panel>
      </section>

      <Panel padded={false} className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-[var(--line)] bg-[var(--paper2)] px-[20px] py-[16px] lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Eyebrow>Booking History</Eyebrow>
            <SectionTitle className="mt-[8px]">Lịch sử booking của khách hàng</SectionTitle>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <MiniChip tone="rust">{bookings.length} booking liên kết</MiniChip>
            <MiniChip tone="muted">Điều hướng hai chiều sang booking detail</MiniChip>
          </div>
        </div>

        <DataTable
          columns={bookingColumns}
          rows={bookings}
          getRowKey={(booking) => booking.id}
          rowHref={(booking) => `/admin/bookings/${booking.id}`}
          empty="Khách hàng này chưa có booking."
          framed={false}
        />
      </Panel>
    </div>
  );
}
