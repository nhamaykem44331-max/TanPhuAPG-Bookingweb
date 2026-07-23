import { Chip } from "@/components/admin/ui/Chip";
import { DataTable, type DataTableColumn } from "@/components/admin/ui/DataTable";
import type { AdminCustomerRecord } from "@/lib/customers/admin";

interface CustomerTableProps {
  customers: AdminCustomerRecord[];
}

function formatDateParts(value: string): { time: string; date: string } {
  const date = new Date(value);

  return {
    time: new Intl.DateTimeFormat("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(date),
    date: new Intl.DateTimeFormat("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(date),
  };
}

// Ô trống dùng gạch ngang dài "—" cho khớp phần còn lại của admin (bookings/payments/handoff).
function displayValue(value: string | null): string {
  return value && value.trim() ? value : "—";
}

function initials(fullName: string): string {
  return fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "KH";
}

// Avatar chữ cái theo Manager (`kit.tsx` → InitialsAvatar): tròn 28px, chữ trắng 700.
// Nền dùng --gradNavy (khối brand) thay vì màu băm theo id — dự án chưa có bảng màu CRM.
function InitialsAvatar({ fullName }: { fullName: string }) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-[28px] w-[28px] flex-none items-center justify-center rounded-full text-[10px] font-bold leading-none"
      style={{ background: "var(--gradNavy)", color: "#FFFFFF" }}
    >
      {initials(fullName)}
    </span>
  );
}

export function CustomerTable({ customers }: CustomerTableProps) {
  const columns: DataTableColumn<AdminCustomerRecord>[] = [
    {
      key: "customer",
      header: "KHÁCH HÀNG",
      width: "minmax(0,1.3fr)",
      render: (customer) => (
        <div className="flex items-center gap-[10px]">
          <InitialsAvatar fullName={customer.fullName} />
          <div className="min-w-0">
            <div className="truncate text-[13.5px] font-semibold text-[var(--ink)]">{customer.fullName}</div>
            <div className="ofly-num mt-[2px] truncate text-[11px] text-[var(--ink4)]">{customer.id.slice(-8)}</div>
          </div>
        </div>
      ),
    },
    {
      key: "contact",
      header: "LIÊN HỆ",
      width: "minmax(0,1.1fr)",
      render: (customer) => (
        <div className="min-w-0">
          <div className="ofly-num truncate text-[13px] font-medium text-[var(--ink)]">
            {displayValue(customer.phone)}
          </div>
          <div className="mt-[2px] truncate text-[11px] text-[var(--ink3)]">{displayValue(customer.email)}</div>
        </div>
      ),
    },
    {
      key: "document",
      header: "GIẤY TỜ",
      width: "minmax(0,0.9fr)",
      render: (customer) => (
        <span className="ofly-num block truncate text-[12.5px] text-[var(--ink2)]">
          {displayValue(customer.idNumber || customer.passport)}
        </span>
      ),
    },
    {
      key: "bookingCount",
      header: "BOOKING",
      width: "96px",
      align: "right",
      render: (customer) => (
        <span className="ofly-num text-[13.5px] font-bold text-[var(--ink)]">{customer.bookingCount}</span>
      ),
    },
    {
      key: "status",
      header: "TRẠNG THÁI",
      width: "138px",
      // Nhãn tiếng Việt cho khớp màn chi tiết khách hàng và các chip trạng thái khác trong admin.
      render: (customer) => (
        <Chip tone={customer.blacklisted ? "red" : "ok"}>{customer.blacklisted ? "Đang blacklist" : "Hoạt động"}</Chip>
      ),
    },
    {
      key: "createdAt",
      header: "NGÀY TẠO",
      width: "116px",
      render: (customer) => {
        const createdAt = formatDateParts(customer.createdAt);
        return (
          <div className="min-w-0">
            <div className="ofly-num text-[12.5px] font-medium text-[var(--ink)]">{createdAt.date}</div>
            <div className="ofly-num mt-[2px] text-[11px] text-[var(--ink3)]">{createdAt.time}</div>
          </div>
        );
      },
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={customers}
      getRowKey={(customer) => customer.id}
      rowHref={(customer) => `/admin/customers/${customer.id}`}
      empty={
        <>
          <div>Chưa có khách hàng phù hợp</div>
          <div className="ofly-sans mt-[10px] text-[13px] not-italic leading-6 text-[var(--ink3)]">
            Thay đổi từ khóa, khoảng ngày hoặc trạng thái blacklist để xem thêm hồ sơ.
          </div>
        </>
      }
    />
  );
}
