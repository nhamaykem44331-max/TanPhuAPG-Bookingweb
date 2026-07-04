"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";

interface RejectPaymentButtonProps {
  bookingId: string;
  paymentId: string;
  disabled?: boolean;
}

export function RejectPaymentButton({ bookingId, paymentId, disabled = false }: RejectPaymentButtonProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleReject() {
    const confirmed = window.confirm("Đánh dấu payment này là REJECTED?");

    if (!confirmed) {
      return;
    }

    setIsPending(true);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/bookings/${bookingId}/payments/${paymentId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string } | null;
        setMessage(payload?.message || "Không thể chuyển payment sang REJECTED.");
        return;
      }

      startTransition(() => {
        router.refresh();
      });
    } catch {
      setMessage("Kết nối tới API soft-reject payment bị gián đoạn.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        className="apg-btn-danger h-9 px-4 text-xs"
        disabled={disabled || isPending}
        onClick={handleReject}
        type="button"
      >
        {isPending ? "Đang từ chối..." : "Từ chối"}
      </button>
      {message ? <span className="max-w-[180px] text-right text-xs text-rose-600">{message}</span> : null}
    </div>
  );
}
