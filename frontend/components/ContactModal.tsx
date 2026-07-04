"use client";

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
          <div>Điện thoại: <a href="tel:19006091" className="font-semibold text-brand">1900 6091</a></div>
          <div>Telegram: <a href="https://t.me/tanphuapg" className="text-brand">@tanphuapg</a></div>
          <div>Email: <a href="mailto:contact@tanphuapg.com" className="text-brand">contact@tanphuapg.com</a></div>
        </div>
        <button className="mt-4 w-full rounded-xl bg-brand py-2 text-white" onClick={onClose}>Đóng</button>
      </div>
    </div>
  );
}
