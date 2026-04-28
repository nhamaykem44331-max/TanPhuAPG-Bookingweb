interface BreakdownTableProps {
  title: string;
  columns: string[];
  rows: Array<Array<string | number>>;
  eyebrow?: string;
  emptyMessage?: string;
}

export function BreakdownTable({
  title,
  columns,
  rows,
  eyebrow = "Breakdown",
  emptyMessage = "Chưa có dữ liệu.",
}: BreakdownTableProps) {
  return (
    <section className="apg-admin-sheet overflow-hidden">
      <div className="flex items-center justify-between border-b border-[var(--apg-border-default)] px-4 py-3">
        <div>
          <p className="apg-eyebrow">{eyebrow}</p>
          <h3 className="mt-1 text-sm font-semibold text-[var(--apg-text-primary)]">{title}</h3>
        </div>
        <span className="apg-chip">{rows.length} dòng</span>
      </div>

      <div className="overflow-x-auto">
        <table className="apg-admin-table min-w-full border-collapse text-sm">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column} className="px-3 py-3 font-semibold">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr className="border-t border-[var(--apg-border-default)]">
                <td className="px-3 py-8 text-center text-[var(--apg-text-secondary)]" colSpan={columns.length}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={`${title}-${index}`} className="border-t border-[var(--apg-border-default)]">
                  {row.map((cell, cellIndex) => (
                    <td
                      key={`${title}-${index}-${cellIndex}`}
                      className={`px-3 py-3 ${cellIndex === 0 ? "font-semibold text-[var(--apg-text-primary)]" : "apg-tabular text-[var(--apg-text-secondary)]"}`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
