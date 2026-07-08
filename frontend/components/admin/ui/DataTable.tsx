import Link from "next/link";
import type { ReactNode } from "react";

// HANDOFF I.4 / parity bảng thiết kế: bảng dạng CSS grid (div), header eyebrow + hàng
// viền dưới, hover nền surface-2. Component "trung tính" (không "use client", không hook)
// nên dùng được ở cả Server lẫn Client Component; điều hướng hàng qua `rowHref` (Link).
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
  className?: string;
}

function alignClass(align?: DataTableAlign): string {
  if (align === "right") return "text-right";
  if (align === "center") return "text-center";
  return "text-left";
}

export function DataTable<T>({ columns, rows, getRowKey, rowHref, empty, className }: DataTableProps<T>) {
  const gridTemplateColumns = columns.map((c) => c.width ?? "minmax(0,1fr)").join(" ");
  const rowBase = "grid items-center gap-[14px] border-b border-[var(--line)] px-[22px] py-[15px] text-[13px]";

  function renderCell(row: T, c: DataTableColumn<T>): ReactNode {
    return c.render ? c.render(row) : ((row as Record<string, ReactNode>)[c.key] ?? null);
  }

  // Thẻ dọc cho mobile/tablet: từng ô = [nhãn cột] · [giá trị], viền dưới ngăn hàng.
  function mobileCard(row: T): ReactNode {
    return (
      <div className="flex flex-col gap-[9px] border-b border-[var(--line)] px-[18px] py-[15px] last:border-b-0">
        {columns
          .filter((c) => !c.hideOnMobileCard)
          .map((c) => (
            <div key={c.key} className="flex items-start justify-between gap-3">
              <span className="shrink-0 pt-[3px] text-[10px] font-semibold uppercase leading-none tracking-[1px] text-[var(--ink-faint)]">
                {c.header}
              </span>
              <div className={`min-w-0 text-right ${c.cellClassName ?? ""}`}>{renderCell(row, c)}</div>
            </div>
          ))}
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Header — chỉ desktop (lg+); mobile dùng nhãn trong từng thẻ */}
      <div
        className="hidden gap-[14px] border-b border-[var(--line)] px-[22px] py-[13px] text-[10px] font-semibold uppercase leading-none tracking-[1.5px] text-[var(--ink-faint)] lg:grid"
        style={{ gridTemplateColumns }}
      >
        {columns.map((c) => (
          <div key={c.key} className={`${alignClass(c.align)} ${c.headClassName ?? ""}`}>
            {c.header}
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="px-[22px] py-10 text-center text-[13px] text-[var(--ink-soft)]">
          {empty ?? "Không có dữ liệu."}
        </div>
      ) : (
        rows.map((row) => {
          const desktopCells = columns.map((c) => (
            <div key={c.key} className={`min-w-0 ${alignClass(c.align)} ${c.cellClassName ?? ""}`}>
              {renderCell(row, c)}
            </div>
          ));

          const desktopRow = (
            <div className={`${rowBase} hidden last:border-b-0 lg:grid`} style={{ gridTemplateColumns }}>
              {desktopCells}
            </div>
          );
          const mobileRow = <div className="lg:hidden">{mobileCard(row)}</div>;

          if (rowHref) {
            return (
              <Link
                key={getRowKey(row)}
                href={rowHref(row)}
                className="block cursor-pointer transition-colors hover:bg-[var(--surface-2)]"
              >
                {desktopRow}
                {mobileRow}
              </Link>
            );
          }

          return (
            <div key={getRowKey(row)}>
              {desktopRow}
              {mobileRow}
            </div>
          );
        })
      )}
    </div>
  );
}
