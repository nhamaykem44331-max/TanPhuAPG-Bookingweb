"use client";

export default function QuoteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f0e8] px-4">
      <section className="w-full max-w-md rounded-xl border border-red-200 bg-white p-6 text-center shadow-lg">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-600">Quote</p>
        <h1 className="mt-2 text-2xl font-black text-[#0b2d52]">Không mở được báo giá</h1>
        <p className="mt-3 text-sm text-slate-600">
          Phiên báo giá có thể đã hết hạn. Anh/chị thử lại hoặc quay lại trang tìm kiếm để lấy giá mới.
        </p>
        {error?.digest ? (
          <p className="mt-3 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-500">Digest: {error.digest}</p>
        ) : null}
        <button
          className="mt-5 rounded-lg bg-[#0b2d52] px-5 py-3 text-sm font-bold text-white"
          onClick={reset}
          type="button"
        >
          Thử lại
        </button>
      </section>
    </main>
  );
}
