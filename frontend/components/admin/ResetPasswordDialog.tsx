"use client";

import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";

import { Btn } from "@/components/admin/ui/Btn";

interface ResetPasswordDialogProps {
  userId: string;
}

export function ResetPasswordDialog({ userId }: ResetPasswordDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function resetPassword() {
    setIsLoading(true);
    setError(null);
    setTempPassword(null);

    const response = await fetch(`/api/admin/users/${userId}/reset-password`, {
      method: "POST",
    });
    const data = await response.json().catch(() => ({}));

    setIsLoading(false);

    if (!response.ok) {
      setError(data.message || data.error || "Không thể reset mật khẩu.");
      return;
    }

    setTempPassword(data.tempPassword);
  }

  return (
    <div>
      <Btn full type="button" onClick={() => setIsOpen(true)}>
        Reset mật khẩu
      </Btn>

      {isOpen ? (
        // Modal theo Manager (`kit.tsx` → Modal): nền phủ mờ, thẻ bo 14px, đầu/thân/chân tách bằng --line.
        <div
          className="ofly-overlay-in fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: "rgba(20,17,16,0.52)", backdropFilter: "blur(2px)" }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Tạo mật khẩu tạm mới"
            className="ofly-modal-in max-h-[90vh] w-full max-w-[520px] overflow-y-auto rounded-[14px] border border-[var(--line2)] bg-[var(--paper)]"
            style={{ boxShadow: "0 30px 80px -30px rgba(20,17,16,0.55)" }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] px-[24px] pb-[16px] pt-[22px]">
              <div className="min-w-0">
                <div className="ofly-eyebrow text-[var(--ink3)]">Password Reset</div>
                <h3 className="ofly-serif m-0 mt-[8px] text-[23px] font-medium leading-[1.2] tracking-[-0.6px] text-[var(--ink)]">
                  Tạo mật khẩu tạm mới
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Đóng"
                className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[8px] border border-[var(--line2)] text-[var(--ink2)] transition-colors duration-150 hover:text-[var(--ink)]"
              >
                <X size={16} strokeWidth={1.5} />
              </button>
            </div>

            <div className="px-[24px] py-[20px]">
              <p className="m-0 text-[13px] leading-[1.6] text-[var(--ink3)]">
                Mật khẩu tạm chỉ hiển thị đúng một lần trong hộp thoại này và không được ghi vào AuditLog.
              </p>

              {tempPassword ? (
                <div
                  className="mt-[18px] rounded-[12px] border px-[16px] py-[14px]"
                  style={{
                    background: "color-mix(in srgb, var(--amber) 8%, var(--paper))",
                    borderColor: "color-mix(in srgb, var(--amber) 32%, transparent)",
                  }}
                >
                  <div className="flex items-center gap-[8px] text-[12.5px] font-semibold text-[var(--amber)]">
                    <AlertTriangle size={15} strokeWidth={1.5} />
                    Mật khẩu tạm
                  </div>
                  <div className="ofly-num mt-[12px] rounded-[8px] border border-[var(--line)] bg-[var(--paper)] px-[13px] py-[11px] text-[14px] font-bold text-[var(--ink)]">
                    {tempPassword}
                  </div>
                </div>
              ) : null}

              {error ? (
                <div
                  className="mt-[14px] flex items-center gap-[9px] rounded-[12px] border px-[16px] py-[12px] text-[13px]"
                  style={{
                    background: "color-mix(in srgb, var(--red) 8%, var(--paper))",
                    borderColor: "color-mix(in srgb, var(--red) 30%, transparent)",
                    color: "var(--red)",
                  }}
                >
                  <AlertTriangle size={15} strokeWidth={1.5} className="flex-none" />
                  {error}
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap justify-end gap-[10px] border-t border-[var(--line)] px-[24px] py-[16px]">
              <Btn variant="ghost" type="button" onClick={() => setIsOpen(false)}>
                Đóng
              </Btn>
              <Btn variant="rust" type="button" disabled={isLoading} onClick={resetPassword}>
                {isLoading ? "Đang reset..." : "Xác nhận reset"}
              </Btn>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
