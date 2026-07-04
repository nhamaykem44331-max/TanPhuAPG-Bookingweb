export interface PriceAlertFormValues {
  route: string;
  airline: string;
  targetPrice: string;
  direction: string;
}

export interface PriceAlertFormState {
  status: "idle" | "error";
  message?: string;
  fieldErrors?: Partial<Record<keyof PriceAlertFormValues, string[]>>;
  values?: Partial<PriceAlertFormValues>;
}

export const initialPriceAlertFormState: PriceAlertFormState = {
  status: "idle",
};

export const defaultPriceAlertFormValues: PriceAlertFormValues = {
  route: "",
  airline: "",
  targetPrice: "",
  direction: "BELOW",
};
