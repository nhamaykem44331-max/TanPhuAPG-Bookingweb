import { Panel, PanelHeading } from "@/components/admin/ui/Panel";

interface AuditDiffViewerProps {
  before: unknown;
  after: unknown;
}

function stringify(value: unknown): string {
  return JSON.stringify(value ?? null, null, 2);
}

// Khối JSON theo kiểu diff: "before" = phần bị thay/xoá → tint đỏ, "after" = phần mới → tint xanh.
// Màu lấy từ biến tone nên đọc được ở cả Ngày lẫn Đêm; chữ dùng mono 12px cho dễ dò từng dòng.
function DiffBlock({ text, tone }: { text: string; tone: "removed" | "added" }) {
  const skin =
    tone === "added"
      ? { background: "var(--greenTint)", color: "var(--green)" }
      : { background: "var(--tone-red-bg)", color: "var(--red)" };

  return (
    <pre
      className="ofly-mono m-0 max-h-[360px] overflow-auto rounded-[8px] px-[14px] py-[12px] text-[12px] leading-[1.65]"
      style={skin}
    >
      {text}
    </pre>
  );
}

export function AuditDiffViewer({ before, after }: AuditDiffViewerProps) {
  return (
    <div className="grid gap-[12px] lg:grid-cols-2">
      <Panel className="flex flex-col gap-[12px]">
        <PanelHeading eyebrow="Before" />
        <DiffBlock text={stringify(before)} tone="removed" />
      </Panel>

      <Panel className="flex flex-col gap-[12px]">
        <PanelHeading eyebrow="After" />
        <DiffBlock text={stringify(after)} tone="added" />
      </Panel>
    </div>
  );
}
