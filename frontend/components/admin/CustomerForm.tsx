"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Btn } from "@/components/admin/ui/Btn";
import { Field, Input, Textarea } from "@/components/admin/ui/Field";
import { Eyebrow } from "@/components/admin/ui/Panel";
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

  // Khối gom nhóm field: viền --line, nền --paper2 — khớp nhịp panel con của Manager.
  const groupClass = "rounded-[10px] border border-[var(--line)] bg-[var(--paper2)] px-[16px] py-[14px]";

  return (
    <form action={onSubmit} className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div className="space-y-4">
          <div className={groupClass}>
            <Eyebrow>Thông tin cơ bản</Eyebrow>
            <div className="mt-[14px] grid gap-4 md:grid-cols-2">
              <Field label="Họ tên" error={fieldErrors.fullName?.[0]}>
                <Input
                  defaultValue={valueOrEmpty(customer?.fullName)}
                  name="fullName"
                  error={Boolean(fieldErrors.fullName)}
                />
              </Field>

              <Field label="Điện thoại" error={fieldErrors.phone?.[0]}>
                <Input
                  defaultValue={valueOrEmpty(customer?.phone)}
                  name="phone"
                  mono
                  error={Boolean(fieldErrors.phone)}
                />
              </Field>

              <Field label="Email" error={fieldErrors.email?.[0]}>
                <Input
                  defaultValue={valueOrEmpty(customer?.email)}
                  name="email"
                  type="email"
                  error={Boolean(fieldErrors.email)}
                />
              </Field>

              <Field label="Ngày sinh" error={fieldErrors.dob?.[0]}>
                <Input
                  defaultValue={valueOrEmpty(customer?.dob)}
                  name="dob"
                  type="date"
                  error={Boolean(fieldErrors.dob)}
                />
              </Field>
            </div>
          </div>

          <div className={groupClass}>
            <Eyebrow>Giấy tờ định danh</Eyebrow>
            <div className="mt-[14px] grid gap-4 md:grid-cols-2">
              <Field label="CMND / CCCD" error={fieldErrors.idNumber?.[0]}>
                <Input
                  defaultValue={valueOrEmpty(customer?.idNumber)}
                  name="idNumber"
                  mono
                  error={Boolean(fieldErrors.idNumber)}
                />
              </Field>

              <Field label="Passport" error={fieldErrors.passport?.[0]}>
                <Input
                  defaultValue={valueOrEmpty(customer?.passport)}
                  name="passport"
                  mono
                  error={Boolean(fieldErrors.passport)}
                />
              </Field>
            </div>
          </div>
        </div>

        <aside className={groupClass}>
          <Eyebrow>Tags JSON</Eyebrow>
          <p className="mt-[10px] text-[13px] leading-[1.55] text-[var(--ink3)]">
            Dùng để lưu metadata nội bộ như blacklist reason, merge marker hoặc các nhãn mở rộng. Chỉ nhập JSON hợp lệ.
          </p>
          <label className="mt-[14px] block">
            <Textarea
              className="ofly-mono min-h-[260px] text-[12px] leading-[1.7]"
              defaultValue={stringifyTags(customer?.tags)}
              name="tags"
              spellCheck={false}
              error={Boolean(fieldErrors.tags)}
            />
          </label>
          {fieldErrors.tags ? (
            <span className="mt-[6px] block text-[12px] text-[var(--red)]">{fieldErrors.tags[0]}</span>
          ) : null}
        </aside>
      </div>

      {formError ? (
        <div
          className="rounded-[10px] border px-[16px] py-[12px] text-[13px]"
          style={{
            color: "var(--red)",
            background: "color-mix(in srgb, var(--red) 8%, transparent)",
            borderColor: "color-mix(in srgb, var(--red) 30%, transparent)",
          }}
        >
          {formError}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-[14px]">
        <Btn variant="rust" disabled={isPending} type="submit">
          {isPending ? "Đang lưu..." : mode === "create" ? "Tạo khách hàng" : "Lưu thay đổi"}
        </Btn>
        <p className="m-0 max-w-[430px] text-[12.5px] leading-[1.5] text-[var(--ink3)]">
          {mode === "create"
            ? "Sau khi tạo xong hệ thống sẽ chuyển anh sang trang chi tiết của khách hàng mới."
            : "Sau khi lưu xong, trang sẽ tự làm mới để cập nhật hồ sơ và lịch sử thay đổi."}
        </p>
      </div>
    </form>
  );
}
