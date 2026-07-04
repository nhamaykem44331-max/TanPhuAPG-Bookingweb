import Link from "next/link";

import { CUSTOMER_MANAGER_ROLES } from "@/lib/auth/constants";
import { requireRole } from "@/lib/auth/requireRole";
import { CustomerForm } from "@/components/admin/CustomerForm";

export default async function NewCustomerPage() {
  await requireRole(CUSTOMER_MANAGER_ROLES);

  return (
    <section className="space-y-6">
      <div className="apg-admin-sheet overflow-hidden">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1.4fr)_360px]">
          <div className="px-5 py-6 lg:px-6">
            <Link className="text-sm font-semibold text-[var(--apg-aviation-navy)] hover:underline" href="/admin/customers">
              ← Quay lại danh sách khách hàng
            </Link>
            <p className="apg-eyebrow mt-5">Customer Desk</p>
            <h2 className="mt-3 text-3xl font-semibold text-[var(--apg-aviation-navy-deep)]">Tạo khách hàng mới</h2>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-[var(--apg-text-secondary)]">
              Dùng màn này để tạo hồ sơ thủ công cho khách walk-in hoặc các trường hợp cần chuẩn bị dữ liệu trước khi phát sinh booking. Mọi thay đổi
              sẽ đi vào AuditLog `customer.create`.
            </p>
          </div>

          <div className="border-t border-[var(--apg-border-default)] bg-[linear-gradient(180deg,rgba(233,238,242,0.95),rgba(255,255,255,0.98))] px-5 py-5 lg:border-l lg:border-t-0">
            <div className="apg-admin-stat px-4 py-4">
              <div className="apg-display text-[11px] uppercase tracking-[0.18em] text-[var(--apg-text-secondary)]">Checklist nhanh</div>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--apg-text-secondary)]">
                <li>Ưu tiên có ít nhất một thông tin liên hệ: điện thoại hoặc email.</li>
                <li>Tags nên để JSON gọn và đúng cấu trúc.</li>
                <li>Nếu khách đã tồn tại, nên tìm trước để tránh tạo duplicate.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="apg-admin-toolbar p-5 lg:p-6">
        <CustomerForm mode="create" />
      </div>
    </section>
  );
}
