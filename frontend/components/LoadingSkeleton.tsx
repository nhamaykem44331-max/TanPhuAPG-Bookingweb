import React from 'react';

export default function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-2xl border bg-white p-4">
          <div className="mb-3 h-4 w-1/3 rounded bg-slate-200" />
          <div className="h-3 w-full rounded bg-slate-100" />
          <div className="mt-2 h-3 w-2/3 rounded bg-slate-100" />
        </div>
      ))}
      <p className="text-sm text-slate-500">Đang tìm chuyến bay...</p>
    </div>
  );
}
