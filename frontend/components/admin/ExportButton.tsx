"use client";

import { Download, FileSpreadsheet } from "lucide-react";

import { Btn } from "@/components/admin/ui/Btn";

// Nút xuất file theo Manager: Btn variant "ghost" + icon lucide 16px (xem CongNoNcc →
// `<Btn variant="ghost" icon={<Ic.download />}>Xuất CSV</Btn>`).

interface ExportButtonProps {
  basePath: string;
  query: Record<string, string | undefined>;
}

function buildUrl(basePath: string, query: Record<string, string | undefined>, format: "csv" | "xlsx"): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value) {
      params.set(key, value);
    }
  }

  params.set("format", format);
  return `${basePath}?${params.toString()}`;
}

export function ExportButton({ basePath, query }: ExportButtonProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Btn
        variant="ghost"
        size="sm"
        icon={<Download size={16} strokeWidth={1.5} aria-hidden="true" />}
        onClick={() => window.location.assign(buildUrl(basePath, query, "csv"))}
      >
        Export CSV
      </Btn>
      <Btn
        variant="ghost"
        size="sm"
        icon={<FileSpreadsheet size={16} strokeWidth={1.5} aria-hidden="true" />}
        onClick={() => window.location.assign(buildUrl(basePath, query, "xlsx"))}
      >
        Export Excel
      </Btn>
    </div>
  );
}
