export interface MarkupRuleFormValues {
  scope: string;
  airline: string;
  channel: string;
  cabin: string;
  paxType: string;
  domesticInternational: string;
  routeFrom: string;
  routeTo: string;
  markupType: string;
  markupValue: string;
  serviceFee: string;
  priority: string;
  active: string;
}

export interface MarkupRuleFormState {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  values?: Partial<MarkupRuleFormValues>;
}

export const initialMarkupRuleFormState: MarkupRuleFormState = {
  status: "idle",
};
