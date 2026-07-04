"use client";

import Link from "next/link";
import { useEffect } from "react";

interface MarkupRulesErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function MarkupRulesError({ error, reset }: MarkupRulesErrorProps) {
  useEffect(() => {
    console.error("[admin/markup-rules] error boundary caught:", error);
  }, [error]);

  const message = error.message || "Đã có lỗi không xác định khi xử lý markup rule.";

  return (
    <section className="apg-admin-sheet space-y-4 p-6">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-[var(--apg-text-primary)]">
          Có lỗi khi xử lý markup rule
        </h2>
        <p className="text-sm text-[var(--apg-text-secondary)]">
          Hệ thống đã bắt được lỗi và không làm crash trang. Bạn có thể thử lại,
          quay về danh sách, hoặc xem chi tiết kỹ thuật bên dưới.
        </p>
      </div>

      <div className="rounded-lg border border-[color:rgba(200,76,58,0.25)] bg-[color:rgba(200,76,58,0.06)] px-4 py-3">
        <div className="apg-display text-[11px] uppercase tracking-[0.18em] text-[var(--apg-danger)]">
          Chi tiết lỗi
        </div>
        <p className="mt-2 break-words text-sm text-[var(--apg-text-primary)]">{message}</p>
        {error.digest ? (
          <p className="mt-1 text-xs text-[var(--apg-text-muted)]">
            Mã lỗi: <span className="apg-mono font-semibold">{error.digest}</span>
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3">
        <button className="apg-btn-primary px-4" onClick={reset} type="button">
          ↺ Thử lại
        </button>
        <Link className="apg-btn-secondary inline-flex items-center justify-center px-4" href="/admin/markup-rules">
          ← Về danh sách rule
        </Link>
      </div>
    </section>
  );
}
