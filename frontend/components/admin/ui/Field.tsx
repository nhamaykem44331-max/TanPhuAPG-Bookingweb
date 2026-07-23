"use client";

import { ChevronDown, Search, X } from "lucide-react";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

// BỘ FORM MỚI theo Manager (`kit.tsx` → Field/Input/Textarea/Select/SearchBox).
// Đây là bộ mới: các form admin cũ sẽ chuyển dần sang, không sửa đồng loạt một lượt.
// Trạng thái focus làm bằng CSS (`focus:` / `focus-within:`) nên không cần hook —
// giữ được `name`/`defaultValue` cho form dùng server action.

// Ô nhập §3: bo 8px, padding 11px 13px, font 14px, viền --line2 → focus --ink,
// nền --paper2 → focus --paper.
const CONTROL =
  "w-full rounded-[8px] border bg-[var(--paper2)] px-[13px] py-[11px] text-[14px] text-[var(--ink)] " +
  "outline-none transition-[border-color,background-color] duration-150 " +
  "placeholder:text-[var(--ink4)] focus:border-[var(--ink)] focus:bg-[var(--paper)] " +
  "disabled:cursor-not-allowed disabled:opacity-60";

function borderClass(error?: boolean): string {
  return error ? "border-[var(--red)]" : "border-[var(--line2)]";
}

export interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

export function Field({ label, hint, error, required, children, className }: FieldProps) {
  return (
    <label className={`block ${className ?? ""}`}>
      <div className="mb-[7px] flex items-baseline justify-between gap-3">
        <span
          className="text-[10.5px] font-semibold uppercase leading-none tracking-[1.2px]"
          style={{ color: error ? "var(--red)" : "var(--ink3)" }}
        >
          {label}
          {required ? <span className="text-[var(--rust)]"> *</span> : null}
        </span>
        {hint ? <span className="text-[11.5px] text-[var(--ink4)]">{hint}</span> : null}
      </div>
      {children}
      {error ? <div className="mt-[6px] text-[12px] text-[var(--red)]">{error}</div> : null}
    </label>
  );
}

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** Dùng JetBrains Mono (PNR, mã đơn, số tiền). */
  mono?: boolean;
  error?: boolean;
  /** Hậu tố mờ nằm trong ô (vd "VNĐ"). */
  right?: ReactNode;
}

export function Input({ mono, error, right, className, ...rest }: InputProps) {
  return (
    <div className="relative">
      <input
        {...rest}
        className={`${CONTROL} ${borderClass(error)} ${mono ? "ofly-num" : ""} ${
          right ? "pr-[40px]" : ""
        } ${className ?? ""}`}
      />
      {right ? (
        <span className="pointer-events-none absolute right-[13px] top-1/2 -translate-y-1/2 text-[13px] text-[var(--ink3)]">
          {right}
        </span>
      ) : null}
    </div>
  );
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export function Textarea({ error, rows = 3, className, ...rest }: TextareaProps) {
  return (
    <textarea
      {...rest}
      rows={rows}
      className={`${CONTROL} ${borderClass(error)} resize-y leading-[1.5] ${className ?? ""}`}
    />
  );
}

export type SelectOption = string | { value: string; label: ReactNode };

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
  /** Danh sách lựa chọn; bỏ trống thì tự render `children`. */
  options?: SelectOption[];
}

export function Select({ error, options, children, className, ...rest }: SelectProps) {
  return (
    <div className="relative">
      <select
        {...rest}
        className={`${CONTROL} ${borderClass(error)} cursor-pointer appearance-none pr-[36px] ${className ?? ""}`}
      >
        {options
          ? options.map((o) => {
              const v = typeof o === "string" ? o : o.value;
              const l = typeof o === "string" ? o : o.label;
              return (
                <option key={v} value={v}>
                  {l}
                </option>
              );
            })
          : children}
      </select>
      <span className="pointer-events-none absolute right-[12px] top-1/2 -translate-y-1/2 text-[var(--ink3)]">
        <ChevronDown size={15} strokeWidth={1.5} />
      </span>
    </div>
  );
}

export interface SearchBoxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "width"> {
  mono?: boolean;
  /** Rộng cố định (px) — bỏ trống thì co giãn theo khối cha. */
  width?: number;
  /** Có hàm này + đang có chữ → hiện nút xoá. */
  onClear?: () => void;
  wrapperClassName?: string;
}

// SearchBox §3: cao 40px, bo 9px, có icon Search.
export function SearchBox({ mono, width, onClear, wrapperClassName, className, ...rest }: SearchBoxProps) {
  const filled = Boolean(rest.value ?? rest.defaultValue);
  return (
    <div
      className={`flex h-[40px] items-center gap-[9px] rounded-[9px] border border-[var(--line2)] bg-[var(--paper2)] px-[13px] transition-[border-color,background-color] duration-150 focus-within:border-[var(--ink)] focus-within:bg-[var(--paper)] ${
        width ? "" : "w-full"
      } ${wrapperClassName ?? ""}`}
      style={width ? { width } : undefined}
    >
      <Search size={16} strokeWidth={1.5} className="shrink-0 text-[var(--ink3)]" />
      <input
        {...rest}
        className={`min-w-0 flex-1 border-none bg-transparent text-[13.5px] text-[var(--ink)] outline-none placeholder:text-[var(--ink4)] ${
          mono ? "ofly-num" : ""
        } ${className ?? ""}`}
      />
      {onClear && filled ? (
        <button
          type="button"
          onClick={onClear}
          aria-label="Xóa tìm kiếm"
          className="flex shrink-0 text-[var(--ink4)]"
        >
          <X size={14} strokeWidth={1.5} />
        </button>
      ) : null}
    </div>
  );
}
