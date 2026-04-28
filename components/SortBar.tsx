"use client";
import React from 'react';

const SORT_OPTIONS = [
  ['price', 'Giá thấp nhất'],
  ['fastest', 'Nhanh nhất'],
  ['earliest', 'Sớm nhất'],
] as const;

export default function SortBar({ sort, setSort }: { sort: string; setSort: (s: string) => void }) {
  return (
    <div className="mb-3 flex flex-wrap gap-2">
      {SORT_OPTIONS.map(([k, label]) => (
        <button
          key={k}
          className={`rounded-xl px-3 py-2 text-sm ${sort === k ? 'bg-brand text-white' : 'border bg-white'}`}
          onClick={() => setSort(k)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
