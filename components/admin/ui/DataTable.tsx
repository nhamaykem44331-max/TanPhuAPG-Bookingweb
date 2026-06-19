import Link from "next/link";
import type { ReactNode } from "react";

// HANDOFF I.4 / parity bảng thiết kế: bảng dạng CSS grid (div), header eyebrow + hàng
// viền dưới, hover nền surface-2. Component "trung tính" (không "use client", không hook)
// nên dùng được ở cả Server lẫn Client Component; điều hướng hàng qua `rowHref` (Link).

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

  return (
    <div className={className}>
      <div
        className="grid gap-[14px] border-b border-[var(--line)] px-[22px] py-[13px] text-[10px] font-semibold uppercase leading-none tracking-[1.5px] text-[var(--ink-faint)]"
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
          const cells = columns.map((c) => (
            <div key={c.key} className={`min-w-0 ${alignClass(c.align)} ${c.cellClassName ?? ""}`}>
              {c.render ? c.render(row) : ((row as Record<string, ReactNode>)[c.key] ?? null)}
            </div>
          ));

          if (rowHref) {
            return (
              <Link
                key={getRowKey(row)}
                href={rowHref(row)}
                className={`${rowBase} cursor-pointer transition-colors last:border-b-0 hover:bg-[var(--surface-2)]`}
                style={{ gridTemplateColumns }}
              >
                {cells}
              </Link>
            );
          }

          return (
            <div key={getRowKey(row)} className={`${rowBase} last:border-b-0`} style={{ gridTemplateColumns }}>
              {cells}
            </div>
          );
        })
      )}
    </div>
  );
}
