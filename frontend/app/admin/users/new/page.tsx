import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { USER_MANAGER_ROLES } from "@/lib/auth/constants";
import { requireRole } from "@/lib/auth/requireRole";
import { UserForm } from "@/components/admin/UserForm";
import { Eyebrow, Panel } from "@/components/admin/ui/Panel";

const CHECKLIST = [
  "Chỉ dùng email thật và duy nhất cho mỗi nhân sự.",
  "Role nên gán sát công việc để tránh mở quyền quá rộng.",
  "Nếu để trống mật khẩu tạm, hệ thống sẽ sinh chuỗi mạnh mặc định.",
];

export default async function NewUserPage() {
  await requireRole(USER_MANAGER_ROLES);

  return (
    <div className="flex flex-col gap-[12px]">
      <Link
        className="inline-flex w-fit items-center gap-[7px] text-[12.5px] font-semibold text-[var(--ink3)] transition-colors duration-150 hover:text-[var(--ink)]"
        href="/admin/users"
      >
        <ArrowLeft size={15} strokeWidth={1.5} />
        Quay lại danh sách tài khoản
      </Link>

      <div className="grid gap-[12px] lg:grid-cols-[minmax(0,1.4fr)_360px]">
        <Panel>
          <Eyebrow>User Control</Eyebrow>
          <h2 className="ofly-serif m-0 mt-[14px] text-[25px] font-medium leading-[1.1] tracking-[-0.8px] text-[var(--ink)]">
            Tạo tài khoản nội bộ
          </h2>
          <p className="m-0 mt-[10px] max-w-[560px] text-[13px] leading-[1.6] text-[var(--ink3)]">
            Email là định danh đăng nhập và không chỉnh sửa sau khi tạo. Mật khẩu tạm có thể để hệ thống sinh tự động và
            chỉ hiển thị một lần.
          </p>
        </Panel>

        <Panel>
          <Eyebrow>Checklist nhanh</Eyebrow>
          <ul className="m-0 mt-[12px] flex list-none flex-col gap-[9px] p-0">
            {CHECKLIST.map((item) => (
              <li key={item} className="flex items-start gap-[9px] text-[12.5px] leading-[1.55] text-[var(--ink3)]">
                {/* Chấm accent thay dấu đầu dòng mặc định — khớp nhịp chip/dot của Manager */}
                <span
                  aria-hidden="true"
                  className="mt-[7px] h-[5px] w-[5px] flex-none rounded-full bg-[var(--rustSoft)]"
                />
                {item}
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <UserForm mode="create" />
    </div>
  );
}
