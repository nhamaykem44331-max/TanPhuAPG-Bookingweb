"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

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

  return (
    <div>
      <button className="apg-btn-secondary w-full" disabled={disabled} type="button" onClick={() => setIsOpen(true)}>
        Merge duplicate
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4">
          <div className="apg-admin-toolbar max-h-[90vh] w-full max-w-4xl overflow-y-auto px-5 py-5 lg:px-6">
            <p className="apg-eyebrow">Customer Merge</p>
            <h3 className="mt-2 text-2xl font-semibold text-[var(--apg-aviation-navy-deep)]">Merge khách hàng trùng</h3>
            <p className="mt-2 text-sm leading-6 text-[var(--apg-text-secondary)]">
              Chọn một hồ sơ trùng để chuyển toàn bộ booking về khách hàng chính. Thao tác này không thể hoàn tác.
            </p>

            <label className="mt-5 block">
              <span className="apg-field-label">Tìm theo họ tên, điện thoại hoặc email</span>
              <input
                className="apg-field mt-2"
                placeholder="Nhập ít nhất 2 ký tự"
                value={query}
                onChange={(event) => searchCandidates(event.target.value)}
              />
            </label>

            {candidates.length > 0 ? (
              <div className="mt-4 space-y-2">
                {candidates.map((candidate) => (
                  <button
                    key={candidate.id}
                    className={`w-full rounded-[20px] border px-4 py-4 text-left text-sm transition ${
                      selected?.id === candidate.id
                        ? "border-[var(--apg-border-focus)] bg-[var(--apg-bg-surface-soft)]"
                        : "border-[var(--apg-border-default)] bg-white hover:border-[var(--apg-border-focus)]"
                    }`}
                    type="button"
                    onClick={() => setSelected(candidate)}
                  >
                    <span className="font-semibold text-[var(--apg-aviation-navy-deep)]">{candidate.fullName}</span>
                    <span className="ml-2 text-[var(--apg-text-secondary)]">
                      {displayValue(candidate.phone)} · {displayValue(candidate.email)} · {candidate.bookingCount} booking
                    </span>
                  </button>
                ))}
              </div>
            ) : null}

            {selected ? (
              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <div className="apg-admin-stat px-4 py-4">
                  <div className="apg-display text-[11px] uppercase tracking-[0.18em] text-[var(--apg-text-secondary)]">Primary</div>
                  <div className="mt-3 font-semibold text-[var(--apg-aviation-navy-deep)]">{primary.fullName}</div>
                  <div className="mt-1 text-sm text-[var(--apg-text-secondary)]">{primary.bookingCount} booking</div>
                </div>
                <div className="apg-admin-stat px-4 py-4">
                  <div className="apg-display text-[11px] uppercase tracking-[0.18em] text-[var(--apg-text-secondary)]">Merged</div>
                  <div className="mt-3 font-semibold text-[var(--apg-aviation-navy-deep)]">{selected.fullName}</div>
                  <div className="mt-1 text-sm text-[var(--apg-text-secondary)]">{selected.bookingCount} booking sẽ chuyển về primary</div>
                </div>
              </div>
            ) : null}

            {selected ? (
              <div className="mt-5 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-700">
                Thao tác không thể hoàn tác. Tất cả {selected.bookingCount} booking của {selected.fullName} sẽ chuyển về {primary.fullName}.
              </div>
            ) : null}

            {error ? <div className="mt-4 rounded-[18px] bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button className="apg-btn-secondary" type="button" onClick={() => setIsOpen(false)}>
                Đóng
              </button>
              <button className="apg-btn-danger" disabled={isPending || !selected} type="button" onClick={submitMerge}>
                {isPending ? "Đang merge..." : "Xác nhận merge"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
