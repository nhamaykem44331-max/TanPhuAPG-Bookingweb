"use client";

import { PHONE_DISPLAY, PHONE_E164, ZALO_URL } from "@/lib/site";

export default function ContactModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-20" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-2 text-lg font-bold">Liên hệ đặt vé</h3>
        <p className="mb-3 text-sm text-slate-600">
          Giá hiển thị là giá tham khảo. Vui lòng liên hệ để chốt chỗ qua đại lý Tân Phú APG.
        </p>
        <div className="space-y-2 text-sm">
          <div>Hotline: <a href={`tel:${PHONE_E164}`} className="font-semibold text-brand">{PHONE_DISPLAY}</a></div>
          <div>Zalo: <a href={ZALO_URL} target="_blank" rel="noopener noreferrer" className="text-brand">zalo.me/0918752686</a></div>
        </div>
        <button className="mt-4 w-full rounded-xl bg-brand py-2 text-white" onClick={onClose}>Đóng</button>
      </div>
    </div>
  );
}
