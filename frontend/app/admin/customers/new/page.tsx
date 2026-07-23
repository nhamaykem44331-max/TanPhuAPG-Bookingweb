import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { CustomerForm } from "@/components/admin/CustomerForm";
import { Eyebrow, Panel } from "@/components/admin/ui/Panel";
import { CUSTOMER_MANAGER_ROLES } from "@/lib/auth/constants";
import { requireRole } from "@/lib/auth/requireRole";

export default async function NewCustomerPage() {
  await requireRole(CUSTOMER_MANAGER_ROLES);

  return (
    <section className="space-y-4">
      <Panel padded={false} className="overflow-hidden">
        <div className="grid lg:grid-cols-[minmax(0,1.4fr)_360px]">
          <div className="px-[20px] py-[22px]">
            <Link
              className="inline-flex items-center gap-[7px] text-[13px] font-semibold text-[var(--rust)] transition-colors hover:text-[var(--rustLt)]"
              href="/admin/customers"
            >
              <ArrowLeft size={15} strokeWidth={1.9} />
              Quay lại danh sách khách hàng
            </Link>

            <div className="mt-[20px]">
              <Eyebrow>Customer Desk</Eyebrow>
            </div>
            <h2 className="ofly-serif m-0 mt-[10px] text-[27px] font-medium leading-[1.08] tracking-[-1.1px] text-[var(--ink)] sm:text-[31px]">
              Tạo khách hàng mới
            </h2>
            <p className="m-0 mt-[12px] max-w-[560px] text-[14px] leading-[1.6] text-[var(--ink3)]">
              Dùng màn này để tạo hồ sơ thủ công cho khách walk-in hoặc các trường hợp cần chuẩn bị dữ liệu trước khi phát sinh booking. Mọi thay đổi
              sẽ đi vào AuditLog `customer.create`.
            </p>
          </div>

          {/* Cột phải kiểu DetailPane của Manager: nền --paper2, tách bằng viền --line */}
          <div className="border-t border-[var(--line)] bg-[var(--paper2)] px-[20px] py-[20px] lg:border-l lg:border-t-0">
            <Panel>
              <Eyebrow>Checklist nhanh</Eyebrow>
              <ul className="mt-[14px] space-y-[9px]">
                {[
                  "Ưu tiên có ít nhất một thông tin liên hệ: điện thoại hoặc email.",
                  "Tags nên để JSON gọn và đúng cấu trúc.",
                  "Nếu khách đã tồn tại, nên tìm trước để tránh tạo duplicate.",
                ].map((item) => (
                  <li key={item} className="flex gap-[9px] text-[13px] leading-[1.55] text-[var(--ink2)]">
                    <span
                      aria-hidden="true"
                      className="mt-[7px] h-[5px] w-[5px] flex-none rounded-full bg-[var(--rust)]"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </div>
      </Panel>

      <Panel className="p-[20px]" padded={false}>
        <CustomerForm mode="create" />
      </Panel>
    </section>
  );
}
