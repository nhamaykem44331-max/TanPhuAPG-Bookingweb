import Link from "next/link";
import type { ReactNode } from "react";

// Bảng dữ liệu theo Manager (`kit.tsx` → DataTable): khung bo 12px viền --line,
// header nền --paper2 chữ eyebrow, ô 13.5px màu --ink2, hover hàng nền --paper2.
// Dựng bằng CSS grid (div) chứ không phải <table> để cột co giãn theo track khai báo.
// Component "trung tính" (không "use client", không hook) nên dùng được ở cả Server lẫn
// Client Component; điều hướng hàng qua `rowHref` (Link).
//
// MOBILE (< lg): grid nhiều cột không đủ chỗ (chồng chữ, tràn cột) nên mỗi hàng đổi thành
// một THẺ dọc — từng ô kèm nhãn tiêu đề cột (label trái · giá trị phải). Từ lg trở lên giữ grid.

export type DataTableAlign = "left" | "right" | "center";

export interface DataTableColumn<T> {
  key: string;
  header: ReactNode;
  /** Track CSS grid, vd "104px" hoặc "minmax(0,1.3fr)". Mặc định "minmax(0,1fr)". */
  width?: string;
  align?: DataTableAlign;
  /** Hàm render ô; mặc định đọc trường cùng tên `key`. */
  render?: (row: T) => ReactNode;
  headClassName?: string;
  cellClassName?: string;
  /** Ẩn ô này trong thẻ mobile (vd cột phụ ít quan trọng). Desktop vẫn hiển thị. */
  hideOnMobileCard?: boolean;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowKey: (row: T) => string;
  /** Khi có, mỗi hàng là một <Link> điều hướng tới href này. */
  rowHref?: (row: T) => string;
  empty?: ReactNode;
  /**
   * Tự bọc khung thẻ (nền --paper, viền --line, bo 12px). Mặc định bật.
   * Trang nào đã tự bọc <Panel> thì truyền `framed={false}` để tránh viền lồng viền.
   */
  framed?: boolean;
  className?: string;
}

function alignClass(align?: DataTableAlign): string {
  if (align === "right") return "text-right";
  if (align === "center") return "text-center";
  return "text-left";
}

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  rowHref,
  empty,
  framed = true,
  className,
}: DataTableProps<T>) {
  const gridTemplateColumns = columns.map((c) => c.width ?? "minmax(0,1fr)").join(" ");
  // Viền dưới + hover đặt ở phần tử ngoài cùng của hàng → đúng cho cả desktop lẫn thẻ mobile.
  const rowShell =
    "block border-b border-[var(--line)] transition-[background-color] duration-[120ms] last:border-b-0 hover:bg-[var(--paper2)]";

  function renderCell(row: T, c: DataTableColumn<T>): ReactNode {
    return c.render ? c.render(row) : ((row as Record<string, ReactNode>)[c.key] ?? null);
  }

  // Thẻ dọc cho mobile/tablet: từng ô = [nhãn cột] · [giá trị].
  function mobileCard(row: T): ReactNode {
    return (
      <div className="flex flex-col gap-[9px] px-[18px] py-[13px] lg:hidden">
        {columns
          .filter((c) => !c.hideOnMobileCard)
          .map((c) => (
            <div key={c.key} className="flex items-start justify-between gap-3">
              <span className="shrink-0 pt-[3px] text-[10px] font-semibold uppercase leading-none tracking-[1.2px] text-[var(--ink3)]">
                {c.header}
              </span>
              <div className={`min-w-0 text-right text-[13.5px] text-[var(--ink2)] ${c.cellClassName ?? ""}`}>
                {renderCell(row, c)}
              </div>
            </div>
          ))}
      </div>
    );
  }

  const body = (
    <>
      {/* Header — chỉ desktop (lg+); mobile dùng nhãn trong từng thẻ */}
      <div
        className="hidden gap-[14px] border-b border-[var(--line)] bg-[var(--paper2)] px-[18px] py-[13px] text-[10.5px] font-semibold uppercase leading-none tracking-[1.2px] text-[var(--ink3)] lg:grid"
        style={{ gridTemplateColumns }}
      >
        {columns.map((c) => (
          <div key={c.key} className={`${alignClass(c.align)} ${c.headClassName ?? ""}`}>
            {c.header}
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="ofly-serif px-[18px] py-[54px] text-center text-[16px] italic text-[var(--ink3)]">
          {empty ?? "Không có dữ liệu."}
        </div>
      ) : (
        rows.map((row) => {
          const desktopRow = (
            <div
              className="hidden items-center gap-[14px] px-[18px] py-[13px] text-[13.5px] text-[var(--ink2)] lg:grid"
              style={{ gridTemplateColumns }}
            >
              {columns.map((c) => (
                <div key={c.key} className={`min-w-0 ${alignClass(c.align)} ${c.cellClassName ?? ""}`}>
                  {renderCell(row, c)}
                </div>
              ))}
            </div>
          );

          if (rowHref) {
            return (
              <Link key={getRowKey(row)} href={rowHref(row)} className={`${rowShell} cursor-pointer`}>
                {desktopRow}
                {mobileCard(row)}
              </Link>
            );
          }

          return (
            <div key={getRowKey(row)} className={rowShell}>
              {desktopRow}
              {mobileCard(row)}
            </div>
          );
        })
      )}
    </>
  );

  return (
    <div
      className={`${
        framed ? "overflow-hidden rounded-[12px] border border-[var(--line)] bg-[var(--paper)]" : ""
      } ${className ?? ""}`}
    >
      {body}
    </div>
  );
}
