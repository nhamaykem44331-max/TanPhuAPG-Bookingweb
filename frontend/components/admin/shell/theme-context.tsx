"use client";

import { createContext, useContext } from "react";

export type OflyTheme = "light" | "dark";

export interface OflyThemeContextValue {
  theme: OflyTheme;
  toggle: () => void;
}

export const OflyThemeContext = createContext<OflyThemeContextValue>({
  theme: "light",
  toggle: () => {},
});

export function useOflyTheme(): OflyThemeContextValue {
  return useContext(OflyThemeContext);
}
