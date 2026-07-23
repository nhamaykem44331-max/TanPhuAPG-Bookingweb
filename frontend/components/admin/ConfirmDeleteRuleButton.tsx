"use client";

import { Trash2 } from "lucide-react";
import { useFormStatus } from "react-dom";

import { deleteMarkupRuleAction } from "@/app/admin/markup-rules/actions";
import { Btn } from "@/components/admin/ui/Btn";

interface DeleteRuleFormProps {
  ruleId: string;
  scope: string;
}

/**
 * Form delete rule với confirm dialog. Toàn bộ form là client component để onSubmit
 * handler hoạt động ổn định với Server Actions trong Next.js 14.
 *
 * Lý do KHÔNG dùng onClick + preventDefault: Server Actions trong Next.js patch form
 * submission qua action attribute. Có những race condition giữa onClick và form submit
 * khi React 18 + RSC khiến preventDefault không catch kịp. onSubmit trên form là
 * điểm chặn cuối cùng trước khi browser/React gửi request → reliable 100%.
 */
export function DeleteRuleForm({ ruleId, scope }: DeleteRuleFormProps) {
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    const ok = window.confirm(
      `Xoá rule "${scope}" khỏi hệ thống?\n\nThao tác này không thể hoàn tác. Audit log vẫn được giữ để truy vết.`,
    );
    if (!ok) {
      event.preventDefault();
    }
  }

  return (
    <form action={deleteMarkupRuleAction} onSubmit={handleSubmit} className="flex">
      <input type="hidden" name="id" value={ruleId} />
      <DeleteSubmitButton />
    </form>
  );
}
function DeleteSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Btn
      variant="danger"
      size="sm"
      type="submit"
      disabled={pending}
      icon={<Trash2 size={14} strokeWidth={1.5} />}
    >
      {pending ? "Đang xoá..." : "Xóa"}
    </Btn>
  );
}
