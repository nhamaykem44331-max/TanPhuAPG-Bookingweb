import { AdminAirlineLogo } from "@/components/admin/AdminAirlineLogo";
import { Chip } from "@/components/admin/ui/Chip";
import { DataTable, type DataTableColumn } from "@/components/admin/ui/DataTable";
import { formatDate, formatRoute, formatTime, formatVnd } from "@/lib/admin/ui/format";
import type { Tone } from "@/lib/admin/ui/tones";
import type { AdminBookingRecord } from "@/lib/bookings/admin";

// Bảng PNR dựng lại trên DataTable dùng chung (skin Tân Phú APG) thay vì <table> tự viết —
// một bộ khung bảng duy nhất cho mọi màn admin. Giữ nguyên props và các cột đang hiển thị.

interface BookingTableProps {
  bookings: AdminBookingRecord[];
}

function isHoldOverdue(booking: AdminBookingRecord): boolean {
  return booking.status === "HELD" && !!booking.holdExpiresAt && new Date(booking.holdExpiresAt).getTime() < Date.now();
}

function displayValue(value: string | null | undefined): string {
  return value && value.trim() ? value : "-";
}

// Giữ đúng cách nhóm trạng thái cũ, chỉ đổi từ lớp màu Tailwind sang tone token.
function statusTone(status: string, overdue: boolean): Tone {
  if (overdue || status === "CANCELLED" || status === "PAYMENT_FAILED" || status === "EXPIRED") {
    return "red";
  }

  if (status === "TICKETED") {
    return "ok";
  }

  if (status === "HELD" || status === "PENDING_PAYMENT") {
    return "warn";
  }

  return "muted";
}

function statusLabel(status: string, overdue: boolean): string {
  if (overdue) return "HELD · QUÁ HẠN";

  const labels: Record<string, string> = {
    HELD: "HELD",
    PENDING_PAYMENT: "CHỜ THANH TOÁN",
    TICKETED: "TICKETED",
    EXPIRED: "EXPIRED",
    CANCELLED: "CANCELLED",
    PAYMENT_FAILED: "PAYMENT_FAILED",
  };

  return labels[status] ?? status;
}

function pnrStatusLabel(status: string | null): string {
  if (!status) {
    return "Chưa rõ";
  }

  if (status === "SUCCESS") {
    return "SUCCESS";
  }

  if (status === "PENDING") {
    return "PENDING";
  }

  return status;
}

// Ô hai dòng: dòng trên là giá trị chính, dòng dưới là chú thích mờ.
function Stack({ main, sub, mono }: { main: string; sub: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <div className={`truncate text-[13.5px] font-semibold text-[var(--ink)] ${mono ? "ofly-num" : ""}`}>{main}</div>
      <div className="mt-[2px] truncate text-[11.5px] text-[var(--ink3)]">{sub}</div>
    </div>
  );
}

export function BookingTable({ bookings }: BookingTableProps) {
  const columns: DataTableColumn<AdminBookingRecord>[] = [
    {
      key: "pnr",
      header: "PNR",
      width: "112px",
      render: (booking) => (
        <div className="min-w-0">
          <div className="ofly-num text-[13px] font-semibold text-[var(--rust)]">{booking.pnr}</div>
          <div className="mt-[2px] truncate text-[11px] text-[var(--ink3)]">{pnrStatusLabel(booking.pnrStatus)}</div>
        </div>
      ),
    },
    {
      key: "orderCode",
      header: "MÃ ĐƠN HÀNG",
      width: "150px",
      render: (booking) => (
        <div className="min-w-0">
          <div className="ofly-num truncate text-[13px] font-semibold text-[var(--ink)]">{booking.orderCode}</div>
          <div className="mt-[2px] truncate text-[11.5px] text-[var(--ink3)]">Thanh toán gom theo mã đơn</div>
        </div>
      ),
    },
    {
      key: "customerName",
      header: "TÊN ĐẠI DIỆN",
      width: "minmax(0,1fr)",
      render: (booking) => (
        <div className="min-w-0">
          <div className="truncate text-[13.5px] font-medium text-[var(--ink)]">{displayValue(booking.customerName)}</div>
          <div className="mt-[2px] text-[11.5px] text-[var(--ink3)]">
            <span className="ofly-num">{booking.passengerCount}</span> khách
          </div>
        </div>
      ),
    },
    {
      key: "route",
      header: "HÀNH TRÌNH",
      width: "minmax(0,1.1fr)",
      render: (booking) => (
        <div className="min-w-0">
          <div className="truncate text-[13.5px] font-semibold text-[var(--ink)]">{formatRoute(booking.route)}</div>
          <div className="mt-[3px] flex items-center gap-[6px] text-[11.5px] text-[var(--ink3)]">
            <AdminAirlineLogo code={booking.airline} airline={booking.airline} size={20} />
            <span className="truncate">{displayValue(booking.airline)}</span>
          </div>
        </div>
      ),
    },
    {
      key: "departureDate",
      header: "KHỞI HÀNH",
      width: "112px",
      render: (booking) => (
        <Stack main={formatDate(booking.departureDate, "-")} sub={formatTime(booking.departureDate, "--:--")} mono />
      ),
    },
    {
      key: "sellPrice",
      header: "TỔNG ĐƠN",
      width: "148px",
      align: "right",
      render: (booking) => (
        <div className="min-w-0">
          <div className="ofly-num text-[13.5px] font-semibold text-[var(--ink)]">{formatVnd(booking.sellPrice)}</div>
          <div className="ofly-num mt-[2px] truncate text-[11.5px] text-[var(--ink3)]">
            Net {formatVnd(booking.netPrice)}
          </div>
        </div>
      ),
    },
    {
      key: "markupAmount",
      header: "MARKUP",
      width: "126px",
      align: "right",
      hideOnMobileCard: true,
      render: (booking) => (
        <span className="ofly-num text-[13.5px] font-semibold text-[var(--green)]">
          +{formatVnd(booking.markupAmount)}
        </span>
      ),
    },
    {
      key: "status",
      header: "TRẠNG THÁI ĐƠN",
      width: "176px",
      render: (booking) => {
        const overdue = isHoldOverdue(booking);
        return <Chip tone={statusTone(booking.status, overdue)}>{statusLabel(booking.status, overdue)}</Chip>;
      },
    },
    {
      key: "holdExpiresAt",
      header: "TTL PNR",
      width: "118px",
      hideOnMobileCard: true,
      render: (booking) => {
        const overdue = isHoldOverdue(booking);
        return (
          <div className="min-w-0">
            <div
              className="ofly-num text-[13px] font-semibold"
              style={{ color: overdue ? "var(--red)" : "var(--ink)" }}
            >
              {overdue ? "Quá hạn" : formatTime(booking.holdExpiresAt, "--:--")}
            </div>
            <div className="ofly-num mt-[2px] truncate text-[11.5px] text-[var(--ink3)]">
              {formatDate(booking.holdExpiresAt, "-")}
            </div>
          </div>
        );
      },
    },
    {
      key: "createdAt",
      header: "NGÀY TẠO",
      width: "118px",
      hideOnMobileCard: true,
      render: (booking) => (
        <Stack main={formatDate(booking.createdAt, "-")} sub={formatTime(booking.createdAt, "--:--")} mono />
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={bookings}
      getRowKey={(booking) => booking.pnrRecordId}
      rowHref={(booking) => `/admin/bookings/${booking.id}`}
      empty={
        <>
          <div>Chưa có PNR phù hợp</div>
          <div className="ofly-sans mx-auto mt-[10px] max-w-[420px] text-[13px] not-italic leading-[1.55] text-[var(--ink3)]">
            Nới điều kiện lọc hoặc đổi khoảng ngày để xem thêm PNR trong cùng đơn hàng.
          </div>
        </>
      }
    />
  );
}
