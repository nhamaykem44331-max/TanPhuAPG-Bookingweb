// OpenFly status tone system (HANDOFF Phần I.2). The actual colours live as CSS
// custom properties in `app/admin/openfly.css` (one set per theme), so these helpers
// only return `var(--tone-*)` references. That means a single piece of markup renders
// correctly in both Ngày/Đêm themes without recomputing colours on toggle.

export type Tone = "rust" | "warn" | "ok" | "muted" | "info" | "teal" | "red" | "plum";

export interface ToneVars {
  fg: string;
  bg: string;
  bd: string;
  solid: string;
}

export function toneVars(tone: Tone): ToneVars {
  return {
    fg: `var(--tone-${tone}-fg)`,
    bg: `var(--tone-${tone}-bg)`,
    bd: `var(--tone-${tone}-bd)`,
    solid: `var(--tone-${tone}-solid)`,
  };
}

export const ALL_TONES: Tone[] = ["rust", "warn", "ok", "muted", "info", "teal", "red", "plum"];
