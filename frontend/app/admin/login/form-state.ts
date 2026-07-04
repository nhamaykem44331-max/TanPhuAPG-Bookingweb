export interface LoginFormState {
  status: "idle" | "error";
  message?: string;
  email?: string;
  retryAfterSeconds?: number;
}

export const initialLoginFormState: LoginFormState = {
  status: "idle",
};
