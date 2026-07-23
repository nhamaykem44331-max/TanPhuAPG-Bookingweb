"use client";

import { Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Btn } from "@/components/admin/ui/Btn";
import { Field, Input } from "@/components/admin/ui/Field";
import { Eyebrow } from "@/components/admin/ui/Panel";

interface MergeCandidate {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  bookingCount: number;
  blacklisted: boolean;
}

interface CustomerMergeDialogProps {
  primary: MergeCandidate;
  disabled?: boolean;
}

function displayValue(value: string | null): string {
  return value && value.trim() ? value : "-";
}

export function CustomerMergeDialog({ primary, disabled }: CustomerMergeDialogProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [candidates, setCandidates] = useState<MergeCandidate[]>([]);
  const [selected, setSelected] = useState<MergeCandidate | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function searchCandidates(nextQuery: string) {
    setQuery(nextQuery);
    setError(null);

    if (nextQuery.trim().length < 2) {
      setCandidates([]);
      return;
    }

    const response = await fetch(`/api/admin/customers?q=${encodeURIComponent(nextQuery)}&limit=10`);
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(data.message || data.error || "Không thể tìm khách hàng.");
      return;
    }

    setCandidates((data.items || []).filter((item: MergeCandidate) => item.id !== primary.id));
  }

  async function submitMerge() {
    if (!selected) {
      setError("Vui lòng chọn khách hàng cần merge.");
      return;
    }

    setError(null);
    const response = await fetch(`/api/admin/customers/${primary.id}/merge`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        mergedCustomerIds: [selected.id],
      }),
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setError(data.message || data.error || "Không thể merge khách hàng.");
      return;
    }

    setIsOpen(false);
    setSelected(null);
    startTransition(() => router.refresh());
  }

  // Khối so sánh Primary / Merged — cùng nhịp với ô thông tin ở hồ sơ khách.
  const paneClass = "rounded-[10px] border border-[var(--line)] bg-[var(--paper2)] px-[16px] py-[14px]";

  return (
    <div>
      <Btn variant="ghost" full disabled={disabled} onClick={() => setIsOpen(true)}>
        Merge duplicate
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
            className="ofly-modal-in max-h-[90vh] w-full max-w-[720px] overflow-y-auto rounded-[14px] border border-[var(--line2)] bg-[var(--paper)]"
            style={{ boxShadow: "0 30px 80px -30px rgba(20,17,16,0.55)" }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] px-[24px] pb-[16px] pt-[22px]">
              <div className="min-w-0">
                <Eyebrow>Customer Merge</Eyebrow>
                <h3 className="ofly-serif m-0 mt-[8px] text-[23px] font-medium leading-[1.2] tracking-[-0.6px] text-[var(--ink)]">
                  Merge khách hàng trùng
                </h3>
              </div>
              {/* Mobile cần vùng bấm tối thiểu 44x44; desktop giữ dáng nút icon vuông 34px. */}
              <button
                type="button"
                aria-label="Đóng"
                onClick={() => setIsOpen(false)}
                className="flex h-[44px] w-[44px] flex-none items-center justify-center rounded-[8px] border border-[var(--line2)] text-[var(--ink2)] transition-colors hover:border-[var(--ink)] hover:text-[var(--ink)] lg:h-[34px] lg:w-[34px]"
              >
                <X size={16} strokeWidth={1.5} />
              </button>
            </div>

            <div className="px-[24px] py-[20px]">
              <p className="m-0 text-[13px] leading-[1.6] text-[var(--ink2)]">
                Chọn một hồ sơ trùng để chuyển toàn bộ booking về khách hàng chính. Thao tác này không thể hoàn tác.
              </p>

              <div className="mt-[18px]">
                <Field label="Tìm theo họ tên, điện thoại hoặc email">
                  <Input
                    placeholder="Nhập ít nhất 2 ký tự"
                    value={query}
                    onChange={(event) => searchCandidates(event.target.value)}
                  />
                </Field>
              </div>

              {candidates.length > 0 ? (
                <div className="mt-4 space-y-2">
                  {candidates.map((candidate) => {
                    const on = selected?.id === candidate.id;
                    return (
                      <button
                        key={candidate.id}
                        type="button"
                        onClick={() => setSelected(candidate)}
                        className="flex w-full items-center gap-[10px] rounded-[10px] border px-[16px] py-[12px] text-left transition-colors"
                        style={{
                          borderColor: on ? "var(--rust)" : "var(--line)",
                          background: on ? "var(--rustTint)" : "var(--paper2)",
                        }}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-semibold text-[var(--ink)]">
                            {candidate.fullName}
                          </span>
                          <span className="ofly-num mt-[3px] block truncate text-[11.5px] text-[var(--ink3)]">
                            {displayValue(candidate.phone)} · {displayValue(candidate.email)} ·{" "}
                            {candidate.bookingCount} booking
                          </span>
                        </span>
                        {on ? (
                          <Check size={15} strokeWidth={1.9} className="flex-none text-[var(--rust)]" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {selected ? (
                <div className="mt-[18px] grid gap-3 md:grid-cols-2">
                  <div className={paneClass}>
                    <Eyebrow>Primary</Eyebrow>
                    <div className="mt-[10px] text-[14px] font-semibold text-[var(--ink)]">{primary.fullName}</div>
                    <div className="mt-[4px] text-[12.5px] text-[var(--ink3)]">
                      <span className="ofly-num">{primary.bookingCount}</span> booking
                    </div>
                  </div>
                  <div className={paneClass}>
                    <Eyebrow>Merged</Eyebrow>
                    <div className="mt-[10px] text-[14px] font-semibold text-[var(--ink)]">{selected.fullName}</div>
                    <div className="mt-[4px] text-[12.5px] text-[var(--ink3)]">
                      <span className="ofly-num">{selected.bookingCount}</span> booking sẽ chuyển về primary
                    </div>
                  </div>
                </div>
              ) : null}

              {selected ? (
                <div
                  className="mt-[18px] rounded-[10px] border px-[16px] py-[12px] text-[13px] leading-[1.6]"
                  style={{
                    color: "var(--red)",
                    background: "color-mix(in srgb, var(--red) 8%, transparent)",
                    borderColor: "color-mix(in srgb, var(--red) 30%, transparent)",
                  }}
                >
                  Thao tác không thể hoàn tác. Tất cả {selected.bookingCount} booking của {selected.fullName} sẽ chuyển về {primary.fullName}.
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
              <Btn variant="danger" disabled={isPending || !selected} onClick={submitMerge}>
                {isPending ? "Đang merge..." : "Xác nhận merge"}
              </Btn>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
