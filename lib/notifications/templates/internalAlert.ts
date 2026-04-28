export function renderInternalAlert(input: {
  severity: "info" | "warn" | "error";
  message: string;
  context?: Record<string, unknown>;
}): string {
  const context = input.context ? `\nContext:\n\`\`\`${JSON.stringify(input.context, null, 2)}\`\`\`` : "";
  return `*${input.severity.toUpperCase()}* - ${input.message}${context}`;
}
