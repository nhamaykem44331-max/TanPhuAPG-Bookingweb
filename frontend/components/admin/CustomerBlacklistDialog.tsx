"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Btn } from "@/components/admin/ui/Btn";
import { Field, Textarea } from "@/components/admin/ui/Field";
import { Eyebrow } from "@/components/admin/ui/Panel";

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
      <Btn variant={currentBlacklisted ? "secondary" : "danger"} full onClick={() => setIsOpen(true)}>
        {currentBlacklisted ? "Gỡ blacklist" : "Đánh dấu blacklist"}
      </Btn>

      {isOpen ? (
        // Dáng Modal của Manager: overlay mờ + hộp bo 14px, viền --line2, đổ bóng sâu.
        <div
          className="ofly-overlay-in fixed inset-0 z-50 flex items-center justify-center p-6 backdrop-blur-[2px]"
          style={{ background: "rgba(20,17,16,0.52)" }}
          onMouseDown={() => setIsOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="ofly-modal-in max-h-[90vh] w-full max-w-[560px] overflow-y-auto rounded-[14px] border border-[var(--line2)] bg-[var(--paper)]"
            style={{ boxShadow: "0 30px 80px -30px rgba(20,17,16,0.55)" }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] px-[24px] pb-[16px] pt-[22px]">
              <div className="min-w-0">
                <Eyebrow>Customer Risk</Eyebrow>
                <h3 className="ofly-serif m-0 mt-[8px] text-[23px] font-medium leading-[1.2] tracking-[-0.6px] text-[var(--ink)]">
                  {nextBlacklisted ? "Xác nhận blacklist khách hàng" : "Xác nhận gỡ blacklist"}
                </h3>
              </div>
              <button
                type="button"
                aria-label="Đóng"
                onClick={() => setIsOpen(false)}
                className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[8px] border border-[var(--line2)] text-[var(--ink2)] transition-colors hover:border-[var(--ink)] hover:text-[var(--ink)]"
              >
                <X size={16} strokeWidth={1.5} />
              </button>
            </div>

            <div className="px-[24px] py-[20px]">
              <p className="m-0 text-[13px] leading-[1.6] text-[var(--ink2)]">
                Thao tác này sẽ được ghi vào AuditLog và cập nhật tags của khách hàng để giữ lịch sử quyết định.
              </p>

              {nextBlacklisted ? (
                <div className="mt-[18px]">
                  <Field label="Lý do blacklist" required>
                    <Textarea
                      className="min-h-[120px]"
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                    />
                  </Field>
                </div>
              ) : null}

              {error ? (
                <div
                  className="mt-4 rounded-[10px] border px-[16px] py-[12px] text-[13px]"
                  style={{
                    color: "var(--red)",
                    background: "color-mix(in srgb, var(--red) 8%, transparent)",
                    borderColor: "color-mix(in srgb, var(--red) 30%, transparent)",
                  }}
                >
                  {error}
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap justify-end gap-[10px] border-t border-[var(--line)] px-[24px] py-[16px]">
              <Btn variant="ghost" onClick={() => setIsOpen(false)}>
                Đóng
              </Btn>
              <Btn
                variant={currentBlacklisted ? "primary" : "danger"}
                disabled={isPending}
                onClick={submit}
              >
                {isPending ? "Đang cập nhật..." : "Xác nhận"}
              </Btn>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
