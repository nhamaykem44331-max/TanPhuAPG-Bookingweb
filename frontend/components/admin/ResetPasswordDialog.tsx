"use client";

import { useState } from "react";

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
      <button className="apg-btn-primary w-full" type="button" onClick={() => setIsOpen(true)}>
        Reset mật khẩu
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
          <div className="apg-admin-toolbar w-full max-w-2xl px-5 py-5 lg:px-6">
            <p className="apg-eyebrow">Password Reset</p>
            <h3 className="mt-2 text-2xl font-semibold text-[var(--apg-aviation-navy-deep)]">Tạo mật khẩu tạm mới</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--apg-text-secondary)]">
              Mật khẩu tạm chỉ hiển thị đúng một lần trong hộp thoại này và không được ghi vào AuditLog.
            </p>

            {tempPassword ? (
              <div className="mt-5 rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-800">
                <div className="font-medium">Mật khẩu tạm</div>
                <div className="mt-3 rounded-[14px] bg-white px-3 py-3 font-mono font-semibold text-[var(--apg-aviation-navy-deep)]">
                  {tempPassword}
                </div>
              </div>
            ) : null}

            {error ? <div className="mt-4 rounded-[18px] bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button className="apg-btn-secondary" type="button" onClick={() => setIsOpen(false)}>
                Đóng
              </button>
              <button className="apg-btn-primary" disabled={isLoading} type="button" onClick={resetPassword}>
                {isLoading ? "Đang reset..." : "Xác nhận reset"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
