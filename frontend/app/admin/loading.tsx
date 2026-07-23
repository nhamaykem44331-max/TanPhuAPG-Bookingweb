// Suspense fallback dùng chung cho MỌI điều hướng giữa các trang /admin: sidebar +
// topbar (thuộc layout) đứng yên, chỉ vùng nội dung hiện khung xương trong lúc server
// render trang đích. Không có file này thì router phải chờ đủ RSC payload mới vẽ —
// bấm sidebar xong UI đứng im, chính là cảm giác "lag" khi chuyển mục.
// Dáng ghost theo skin Manager: khối --paper3 bo góc trên nền thẻ --paper, nhịp ofly-pulse.

function Ghost({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`ofly-pulse rounded-[6px] bg-[var(--paper3)] ${className ?? ""}`}
      style={style}
      aria-hidden="true"
    />
  );
}

export default function AdminLoading() {
  return (
    <div aria-busy="true" aria-label="Đang tải trang">
      {/* Hàng đầu: mô tả trang (trái) + dải StatTile (phải) — khớp bố cục chung của các màn */}
      <div className="mb-[22px] flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-[220px]">
          <Ghost className="mb-[10px] h-[13px] w-[320px] max-w-full" />
          <Ghost className="h-[13px] w-[240px] max-w-full" />
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-[10px]">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-[10px] border border-[var(--line)] bg-[var(--paper)] px-4 py-[10px]"
              style={{ minWidth: 118 }}
            >
              <Ghost className="mb-2 h-[9px] w-[64px]" />
              <Ghost className="h-[18px] w-[42px]" />
            </div>
          ))}
        </div>
      </div>

      {/* Dải filter tab */}
      <div className="mb-[14px] flex items-center gap-2">
        {[88, 104, 96].map((w, i) => (
          <Ghost key={i} className="h-[40px]" style={{ width: w, borderRadius: 9 }} />
        ))}
      </div>

      {/* Bảng dữ liệu: khung Panel + header --paper2 + các hàng ghost */}
      <div className="overflow-hidden rounded-[12px] border border-[var(--line)] bg-[var(--paper)]">
        <div className="flex items-center gap-[14px] border-b border-[var(--line)] bg-[var(--paper2)] px-[18px] py-[13px]">
          {[110, 150, 90, 120, 80].map((w, i) => (
            <Ghost key={i} className="h-[10px]" style={{ width: w }} />
          ))}
        </div>
        {[0, 1, 2, 3, 4, 5].map((row) => (
          <div
            key={row}
            className="flex items-center gap-[14px] border-b border-[var(--line)] px-[18px] py-[16px] last:border-b-0"
          >
            <Ghost className="h-[12px]" style={{ width: 96, opacity: 0.9 - row * 0.08 }} />
            <Ghost className="h-[12px]" style={{ width: 170, opacity: 0.9 - row * 0.08 }} />
            <Ghost className="h-[12px]" style={{ width: 74, opacity: 0.9 - row * 0.08 }} />
            <Ghost className="hidden h-[12px] sm:block" style={{ width: 128, opacity: 0.9 - row * 0.08 }} />
            <Ghost className="ml-auto h-[20px] w-[76px] rounded-full" style={{ opacity: 0.9 - row * 0.08 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
