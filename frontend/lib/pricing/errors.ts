export class InvalidMarkupRuleError extends Error {
  readonly ruleId: string | null;

  constructor(message: string, ruleId: string | null = null) {
    super(message);
    this.name = "InvalidMarkupRuleError";
    this.ruleId = ruleId;
  }
}

export class QuoteExpiredError extends Error {
  constructor(message = "QUOTE_EXPIRED") {
    super(message);
    this.name = "QuoteExpiredError";
  }
}

export class QuoteUnavailableError extends Error {
  constructor(message = "SOLD_OUT") {
    super(message);
    this.name = "QuoteUnavailableError";
  }
}
