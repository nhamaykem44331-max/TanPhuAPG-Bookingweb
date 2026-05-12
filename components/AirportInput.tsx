"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import type { AirportSelection } from '@/lib/types';
import { filterAirports, matchAirport, useAirports } from '@/lib/useAirports';

export default function AirportInput({
  label,
  value,
  onSelect,
  placeholder,
}: {
  label: string;
  value: AirportSelection | null;
  onSelect: (value: AirportSelection | null) => void;
  placeholder?: string;
}) {
  const { airports, loading } = useAirports();
  const [draft, setDraft] = useState(value?.label || '');
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!focused) setDraft(value?.label || '');
  }, [focused, value]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) return;
      setOpen(false);
      setFocused(false);
      setDraft(value?.label || '');
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [value]);

  const list = useMemo(() => filterAirports(airports, draft, 8), [airports, draft]);

  const commit = (selection: AirportSelection | null) => {
    onSelect(selection);
    setDraft(selection?.label || '');
    setOpen(false);
    setFocused(false);
  };

  const handleBlur = () => {
    window.setTimeout(() => {
      const trimmed = draft.trim();
      if (!trimmed) {
        commit(null);
        return;
      }

      const matched = matchAirport(airports, trimmed);
      if (matched) {
        commit({ code: matched.code, label: matched.label });
        return;
      }

      setDraft(value?.label || '');
      setOpen(false);
      setFocused(false);
    }, 120);
  };

  const selectAll = () => {
    window.requestAnimationFrame(() => {
      inputRef.current?.select();
    });
  };

  return (
    <div ref={ref} className="relative">
      <label className="apg-field-label">{label}</label>
      <input
        ref={inputRef}
        value={draft}
        onFocus={() => {
          setFocused(true);
          setOpen(true);
          selectAll();
        }}
        onClick={selectAll}
        onBlur={handleBlur}
        onChange={(event) => {
          setDraft(event.target.value);
          setOpen(true);
        }}
        className="apg-field lg:text-[15px]"
        placeholder={placeholder}
      />
      {open && (
        <div className="apg-dropdown absolute left-0 right-0 top-full z-50 mt-1 lg:mt-2 lg:max-h-[360px] lg:overflow-auto">
          {loading && (
            <div className="px-3 py-2 text-xs text-[var(--apg-text-secondary)] lg:px-4 lg:py-3 lg:text-[13px]">
              Đang tải danh sách sân bay...
            </div>
          )}
          {!loading && list.length === 0 && (
            <div className="px-3 py-2 text-xs text-[var(--apg-text-secondary)] lg:px-4 lg:py-3 lg:text-[13px]">
              Không tìm thấy sân bay phù hợp.
            </div>
          )}
          {!loading &&
            list.map((airport) => (
              <button
                key={airport.code}
                type="button"
                className="flex w-full items-center gap-2 border-b border-[var(--apg-border-default)] px-3 py-2 text-left transition-colors hover:bg-[var(--apg-bg-surface-soft)] last:border-b-0 lg:gap-3 lg:px-4 lg:py-3"
                onPointerDown={(event) => {
                  event.preventDefault();
                  commit({ code: airport.code, label: airport.label });
                }}
              >
                <span className="text-sm text-[var(--apg-brand-gold)] lg:text-base">✈</span>
                <div className="min-w-0">
                  <div className="truncate text-xs font-bold text-[var(--apg-text-primary)] lg:text-sm">
                    {airport.city}{' '}
                    <span className="apg-mono text-[var(--apg-brand-gold)]">({airport.code})</span>
                  </div>
                  <div className="truncate text-[10px] text-[var(--apg-text-muted)] lg:text-xs">{airport.name}</div>
                </div>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
