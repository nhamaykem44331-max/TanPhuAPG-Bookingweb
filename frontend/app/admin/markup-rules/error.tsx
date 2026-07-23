"use client";

import { ArrowLeft, RotateCcw } from "lucide-react";
import { useEffect } from "react";

import { Btn, ButtonLink } from "@/components/admin/ui/Btn";
import { SectionTitle } from "@/components/admin/ui/PageHead";
import { Panel } from "@/components/admin/ui/Panel";
import { toneVars } from "@/lib/admin/ui/tones";

interface MarkupRulesErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function MarkupRulesError({ error, reset }: MarkupRulesErrorProps) {
  useEffect(() => {
    console.error("[admin/markup-rules] error boundary caught:", error);
  }, [error]);

  const message = error.message || "Đã có lỗi không xác định khi xử lý markup rule.";
  // Khối chi tiết lỗi lấy màu từ tone red → đọc được ở cả giao diện Ngày và Đêm.
  const danger = toneVars("red");

  return (
    <Panel className="space-y-[16px]">
      <div>
        <SectionTitle>Có lỗi khi xử lý markup rule</SectionTitle>
        <p className="mt-[10px] max-w-[620px] text-[13.5px] leading-[1.6] text-[var(--ink3)]">
          Hệ thống đã bắt được lỗi và không làm crash trang. Bạn có thể thử lại,
          quay về danh sách, hoặc xem chi tiết kỹ thuật bên dưới.
        </p>
      </div>

      <div
        className="rounded-[10px] border px-[16px] py-[13px]"
        style={{ background: danger.bg, borderColor: danger.bd }}
      >
        <div
          className="text-[10.5px] font-semibold uppercase leading-none tracking-[1.2px]"
          style={{ color: danger.fg }}
        >
          Chi tiết lỗi
        </div>
        <p className="mt-[9px] break-words text-[13.5px] leading-[1.55] text-[var(--ink2)]">{message}</p>
        {error.digest ? (
          <p className="mt-[6px] text-[12px] text-[var(--ink3)]">
            Mã lỗi: <span className="ofly-num font-semibold text-[var(--ink2)]">{error.digest}</span>
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-[10px]">
        <Btn variant="rust" onClick={reset} type="button" icon={<RotateCcw size={15} strokeWidth={1.5} />}>
          Thử lại
        </Btn>
        <ButtonLink
          href="/admin/markup-rules"
          variant="ghost"
          icon={<ArrowLeft size={15} strokeWidth={1.5} />}
        >
          Về danh sách rule
        </ButtonLink>
      </div>
    </Panel>
  );
}
