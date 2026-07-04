"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

interface CustomerBlacklistDialogProps {
  actorId: string;
  customerId: string;
  currentBlacklisted: boolean;
  currentTags: unknown;
}

function tagsObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

export function CustomerBlacklistDialog({
  actorId,
  customerId,
  currentBlacklisted,
  currentTags,
}: CustomerBlacklistDialogProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const nextBlacklisted = !currentBlacklisted;

  async function submit() {
    setError(null);

    if (nextBlacklisted && reason.trim().length < 5) {
      setError("Vui lòng nhập lý do blacklist tối thiểu 5 ký tự.");
      return;
    }

    const now = new Date().toISOString();
    const tags = nextBlacklisted
      ? {
          ...tagsObject(currentTags),
          blacklistReason: reason.trim(),
          blacklistedAt: now,
          blacklistedBy: actorId,
        }
      : {
          ...tagsObject(currentTags),
          unblacklistedAt: now,
          unblacklistedBy: actorId,
        };

    const response = await fetch(`/api/admin/customers/${customerId}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        blacklisted: nextBlacklisted,
        tags,
      }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(data.message || data.error || "Không thể cập nhật blacklist.");
      return;
    }

    setIsOpen(false);
    startTransition(() => router.refresh());
  }

  return (
    <div>
      <button
        className={currentBlacklisted ? "apg-btn-secondary w-full" : "apg-btn-danger w-full"}
        type="button"
        onClick={() => setIsOpen(true)}
      >
        {currentBlacklisted ? "Gỡ blacklist" : "Đánh dấu blacklist"}
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
          <div className="apg-admin-toolbar w-full max-w-2xl px-5 py-5 lg:px-6">
            <p className="apg-eyebrow">Customer Risk</p>
            <h3 className="mt-2 text-2xl font-semibold text-[var(--apg-aviation-navy-deep)]">
              {nextBlacklisted ? "Xác nhận blacklist khách hàng" : "Xác nhận gỡ blacklist"}
            </h3>
            <p className="mt-2 text-sm leading-6 text-[var(--apg-text-secondary)]">
              Thao tác này sẽ được ghi vào AuditLog và cập nhật tags của khách hàng để giữ lịch sử quyết định.
            </p>

            {nextBlacklisted ? (
              <label className="mt-5 block">
                <span className="apg-field-label">Lý do blacklist</span>
                <textarea className="apg-field mt-2 h-auto min-h-[120px] py-3" value={reason} onChange={(event) => setReason(event.target.value)} />
              </label>
            ) : null}

            {error ? <div className="mt-4 rounded-[18px] bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button className="apg-btn-secondary" type="button" onClick={() => setIsOpen(false)}>
                Đóng
              </button>
              <button className={currentBlacklisted ? "apg-btn-primary" : "apg-btn-danger"} disabled={isPending} type="button" onClick={submit}>
                {isPending ? "Đang cập nhật..." : "Xác nhận"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
