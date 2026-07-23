import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { formatDateTime } from "@/lib/admin/ui/format";
import { getRoleLabel, USER_MANAGER_ROLES } from "@/lib/auth/constants";
import { requireRole } from "@/lib/auth/requireRole";
import { getAdminUserById } from "@/lib/users/admin";
import { ResetPasswordDialog } from "@/components/admin/ResetPasswordDialog";
import { UserForm } from "@/components/admin/UserForm";
import { Chip } from "@/components/admin/ui/Chip";
import { Eyebrow, Panel } from "@/components/admin/ui/Panel";

interface UserDetailPageProps {
  params: {
    id: string;
  };
}

// Ô thông tin nhỏ trong hồ sơ: nhãn eyebrow + giá trị. `mono` cho mốc thời gian (§2 hợp đồng).
function InfoCell({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-[10px] border border-[var(--line)] bg-[var(--paper2)] px-[14px] py-[12px]">
      <Eyebrow>{label}</Eyebrow>
      <div className={`mt-[7px] text-[13.5px] font-semibold text-[var(--ink)] ${mono ? "ofly-num" : ""}`}>{value}</div>
    </div>
  );
}

export default async function UserDetailPage({ params }: UserDetailPageProps) {
  await requireRole(USER_MANAGER_ROLES);
  const user = await getAdminUserById(params.id);

  if (!user) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-[12px]">
      <Link
        className="inline-flex w-fit items-center gap-[7px] text-[12.5px] font-semibold text-[var(--ink3)] transition-colors duration-150 hover:text-[var(--ink)]"
        href="/admin/users"
      >
        <ArrowLeft size={15} strokeWidth={1.5} />
        Quay lại danh sách tài khoản
      </Link>

      <div className="grid gap-[12px] xl:grid-cols-[minmax(0,1.55fr)_380px]">
        <Panel>
          <Eyebrow>User Control</Eyebrow>

          <div className="mt-[14px] flex flex-wrap items-center gap-[14px]">
            {/* Avatar khối navy đặc — #FFFFFF là ngoại lệ hex duy nhất hợp đồng cho phép */}
            <span
              aria-hidden="true"
              className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-[12px] text-[15px] font-bold tracking-[0.06em]"
              style={{ background: "var(--gradNavy)", color: "#FFFFFF" }}
            >
              {user.fullName.slice(0, 2).toUpperCase()}
            </span>
            <div className="min-w-0">
              <h2 className="ofly-serif m-0 break-words text-[25px] font-medium leading-[1.1] tracking-[-0.8px] text-[var(--ink)]">
                {user.email}
              </h2>
              <p className="m-0 mt-[7px] text-[13px] text-[var(--ink3)]">
                {user.fullName} · {getRoleLabel(user.role)}
              </p>
            </div>
            {user.active ? <Chip tone="ok">Active</Chip> : <Chip tone="red">Locked</Chip>}
          </div>

          <div className="mt-[18px] grid gap-[12px] md:grid-cols-2 xl:grid-cols-4">
            <InfoCell label="Họ tên" value={user.fullName} />
            <InfoCell label="Role" value={getRoleLabel(user.role)} />
            <InfoCell label="Tạo lúc" value={formatDateTime(user.createdAt)} mono />
            <InfoCell label="Đăng nhập cuối" value={formatDateTime(user.lastLoginAt)} mono />
          </div>
        </Panel>

        <div className="flex flex-col gap-[12px]">
          <Panel>
            <Eyebrow>Tác vụ chính</Eyebrow>
            <div className="mt-[14px]">
              <ResetPasswordDialog userId={user.id} />
            </div>
          </Panel>

          <Panel>
            <Eyebrow>Lưu ý bảo mật</Eyebrow>
            <p className="m-0 mt-[12px] text-[12.5px] leading-[1.6] text-[var(--ink3)]">
              Reset password chỉ trả về mật khẩu tạm đúng một lần và không ghi plaintext vào AuditLog.
            </p>
          </Panel>
        </div>
      </div>

      <UserForm mode="edit" user={user} />
    </div>
  );
}
