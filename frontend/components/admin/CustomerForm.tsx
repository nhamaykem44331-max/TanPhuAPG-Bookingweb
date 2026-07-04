"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { AdminCustomerDetailRecord } from "@/lib/customers/admin";

interface CustomerFormProps {
  mode: "create" | "edit";
  customer?: AdminCustomerDetailRecord;
}

type FieldErrors = Record<string, string[] | undefined>;

function stringifyTags(tags: unknown): string {
  if (tags === null || tags === undefined) {
    return "{}";
  }

  return JSON.stringify(tags, null, 2);
}

function valueOrEmpty(value: string | null | undefined): string {
  return value ?? "";
}

export function CustomerForm({ mode, customer }: CustomerFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setFieldErrors({});
    setFormError(null);

    let tags: unknown = undefined;
    const rawTags = String(formData.get("tags") ?? "").trim();

    if (rawTags) {
      try {
        tags = JSON.parse(rawTags);
      } catch {
        setFieldErrors({ tags: ["Tags phải là JSON hợp lệ."] });
        return;
      }
    } else {
      tags = null;
    }

    const payload = {
      fullName: String(formData.get("fullName") ?? ""),
      phone: String(formData.get("phone") ?? ""),
      email: String(formData.get("email") ?? ""),
      idNumber: String(formData.get("idNumber") ?? ""),
      passport: String(formData.get("passport") ?? ""),
      dob: String(formData.get("dob") ?? ""),
      tags,
    };

    const url = mode === "create" ? "/api/admin/customers" : `/api/admin/customers/${customer?.id}`;
    const response = await fetch(url, {
      method: mode === "create" ? "POST" : "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      if (data.fieldErrors) {
        setFieldErrors(data.fieldErrors);
      }
      setFormError(data.message || data.error || "Không thể lưu khách hàng.");
      return;
    }

    startTransition(() => {
      if (mode === "create" && data.customer?.id) {
        router.push(`/admin/customers/${data.customer.id}`);
        return;
      }

      router.refresh();
    });
  }

  return (
    <form action={onSubmit} className="space-y-5">
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="space-y-5">
          <div className="apg-admin-stat px-4 py-4">
            <div className="apg-display text-[11px] uppercase tracking-[0.18em] text-[var(--apg-text-secondary)]">Thông tin cơ bản</div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="apg-field-label">Họ tên</span>
                <input className="apg-field mt-2" defaultValue={valueOrEmpty(customer?.fullName)} name="fullName" />
                {fieldErrors.fullName ? <span className="mt-1 block text-xs text-rose-600">{fieldErrors.fullName[0]}</span> : null}
              </label>

              <label className="block">
                <span className="apg-field-label">Điện thoại</span>
                <input className="apg-field mt-2" defaultValue={valueOrEmpty(customer?.phone)} name="phone" />
                {fieldErrors.phone ? <span className="mt-1 block text-xs text-rose-600">{fieldErrors.phone[0]}</span> : null}
              </label>

              <label className="block">
                <span className="apg-field-label">Email</span>
                <input className="apg-field mt-2" defaultValue={valueOrEmpty(customer?.email)} name="email" type="email" />
                {fieldErrors.email ? <span className="mt-1 block text-xs text-rose-600">{fieldErrors.email[0]}</span> : null}
              </label>

              <label className="block">
                <span className="apg-field-label">Ngày sinh</span>
                <input className="apg-field mt-2" defaultValue={valueOrEmpty(customer?.dob)} name="dob" type="date" />
                {fieldErrors.dob ? <span className="mt-1 block text-xs text-rose-600">{fieldErrors.dob[0]}</span> : null}
              </label>
            </div>
          </div>

          <div className="apg-admin-stat px-4 py-4">
            <div className="apg-display text-[11px] uppercase tracking-[0.18em] text-[var(--apg-text-secondary)]">Giấy tờ định danh</div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <label className="block">
                <span className="apg-field-label">CMND / CCCD</span>
                <input className="apg-field mt-2" defaultValue={valueOrEmpty(customer?.idNumber)} name="idNumber" />
                {fieldErrors.idNumber ? <span className="mt-1 block text-xs text-rose-600">{fieldErrors.idNumber[0]}</span> : null}
              </label>

              <label className="block">
                <span className="apg-field-label">Passport</span>
                <input className="apg-field mt-2" defaultValue={valueOrEmpty(customer?.passport)} name="passport" />
                {fieldErrors.passport ? <span className="mt-1 block text-xs text-rose-600">{fieldErrors.passport[0]}</span> : null}
              </label>
            </div>
          </div>
        </div>

        <aside className="apg-admin-stat px-4 py-4">
          <div className="apg-display text-[11px] uppercase tracking-[0.18em] text-[var(--apg-text-secondary)]">Tags JSON</div>
          <p className="mt-3 text-sm leading-6 text-[var(--apg-text-secondary)]">
            Dùng để lưu metadata nội bộ như blacklist reason, merge marker hoặc các nhãn mở rộng. Chỉ nhập JSON hợp lệ.
          </p>
          <label className="mt-4 block">
            <textarea
              className="apg-field h-auto min-h-[260px] py-3 font-mono text-xs"
              defaultValue={stringifyTags(customer?.tags)}
              name="tags"
              spellCheck={false}
            />
          </label>
          {fieldErrors.tags ? <span className="mt-1 block text-xs text-rose-600">{fieldErrors.tags[0]}</span> : null}
        </aside>
      </div>

      {formError ? (
        <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{formError}</div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <button className="apg-btn-primary" disabled={isPending} type="submit">
          {isPending ? "Đang lưu..." : mode === "create" ? "Tạo khách hàng" : "Lưu thay đổi"}
        </button>
        <p className="text-sm text-[var(--apg-text-secondary)]">
          {mode === "create"
            ? "Sau khi tạo xong hệ thống sẽ chuyển anh sang trang chi tiết của khách hàng mới."
            : "Sau khi lưu xong, trang sẽ tự làm mới để cập nhật hồ sơ và lịch sử thay đổi."}
        </p>
      </div>
    </form>
  );
}
