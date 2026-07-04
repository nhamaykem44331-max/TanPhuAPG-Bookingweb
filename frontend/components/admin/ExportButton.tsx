"use client";

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
      <button className="apg-btn-secondary" type="button" onClick={() => window.location.assign(buildUrl(basePath, query, "csv"))}>
        Export CSV
      </button>
      <button className="apg-btn-secondary" type="button" onClick={() => window.location.assign(buildUrl(basePath, query, "xlsx"))}>
        Export Excel
      </button>
    </div>
  );
}
