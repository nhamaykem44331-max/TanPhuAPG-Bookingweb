export class MarkupConfigurationError extends Error {
  constructor(message = "No active markup rules are available") {
    super(message);
    this.name = "MarkupConfigurationError";
  }
}

export function requireActiveMarkupRules<T>(rules: T[]): T[] {
  if (rules.length === 0) throw new MarkupConfigurationError();
  return rules;
}

export function requirePositiveWebMargin(markupAmount: number, serviceFeeAmount: number): void {
  if (markupAmount + serviceFeeAmount <= 0) {
    throw new MarkupConfigurationError("No markup rule matched this web quote");
  }
}
