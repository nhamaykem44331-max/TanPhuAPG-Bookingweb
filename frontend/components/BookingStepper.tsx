import { Fragment } from "react";

// Thanh tiến trình dùng CHUNG cho cả funnel giữ chỗ → thanh toán, để khách thấy
// một mạch liền: Chọn chuyến → Hành khách → Thanh toán → Hoàn tất.
export type BookingStage = "passenger" | "pay" | "done";

const STEPS = ["Chọn chuyến", "Hành khách", "Thanh toán", "Hoàn tất"];

export default function BookingStepper({ stage }: { stage: BookingStage }) {
  const activeIndex = stage === "passenger" ? 1 : stage === "pay" ? 2 : 3;
  return (
    <ol className="flex items-center gap-1.5 text-[11px] sm:gap-2" aria-label="Tiến trình đặt vé">
      {STEPS.map((label, i) => {
        const done = i < activeIndex;
        const active = i === activeIndex;
        const dim = Math.abs(i - activeIndex) > 1; // mobile: chỉ ẩn nhãn bước KHÔNG kề bước hiện tại
        return (
          <Fragment key={label}>
            <li
              className={`flex items-center gap-1.5 ${done ? "text-[#1F7A54]" : active ? "font-semibold text-[#0C2740]" : "text-slate-400"}`}
              aria-current={active ? "step" : undefined}
            >
              <span
                className={`grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] ${done ? "bg-[#1F7A54] text-white" : active ? "bg-[#0C2740] text-white" : "bg-slate-200 text-slate-500"}`}
              >
                {done ? (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 13l4 4L19 7" /></svg>
                ) : (
                  i + 1
                )}
              </span>
              <span className={dim ? "hidden sm:inline" : ""}>{label}</span>
            </li>
            {i < STEPS.length - 1 ? <li aria-hidden className={`h-px flex-1 ${done ? "bg-[#1F7A54]/40" : "bg-slate-200"}`} /> : null}
          </Fragment>
        );
      })}
    </ol>
  );
}
