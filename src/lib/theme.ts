export type AuroraTheme = "borealis" | "nebula" | "ember";
export type Theme = "dark" | "light" | AuroraTheme;

export const THEMES: Theme[] = ["dark", "light", "borealis", "nebula", "ember"];

export const THEME_LABELS: Record<Theme, string> = {
  dark: "Dark",
  light: "Light",
  borealis: "Borealis",
  nebula: "Nebula",
  ember: "Ember",
};

/** Colors the aurora shader paints with. `bg` must match the theme's `--bg`. */
export interface AuroraPalette {
  bg: string;
  bands: [string, string, string];
}

export const AURORA_PALETTES: Record<AuroraTheme, AuroraPalette> = {
  borealis: { bg: "#050B10", bands: ["#19E68C", "#1FC8DB", "#7B5CFF"] },
  nebula: { bg: "#090714", bands: ["#A855F7", "#EC4899", "#3B82F6"] },
  ember: { bg: "#100806", bands: ["#FF6A3D", "#FF2E7E", "#FFB020"] },
};

export function isAuroraTheme(theme: Theme): theme is AuroraTheme {
  return theme in AURORA_PALETTES;
}

export const STORAGE_KEY = "cta-theme";

export function readStoredTheme(): Theme | "system" {
  try {
    const t = localStorage.getItem(STORAGE_KEY);
    if (THEMES.includes(t as Theme)) return t as Theme;
  } catch {}
  return "system";
}

export function systemTheme(): Theme {
  try {
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {}
}

export function nextTheme(current: Theme): Theme {
  return THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
}

export interface ChartPalette {
  chartBg: string;
  grid: string;
  tick: string;
  volume: string;
  tooltipBg: string;
  raw: string;
  ao5: string;
  ao12: string;
  ao100: string;
  trend: string;
  proj: string;
}

const VARS: Record<keyof ChartPalette, string> = {
  chartBg: "--chart-bg",
  grid: "--chart-grid",
  tick: "--chart-tick",
  volume: "--chart-volume",
  tooltipBg: "--chart-tooltip-bg",
  raw: "--series-raw",
  ao5: "--series-ao5",
  ao12: "--series-ao12",
  ao100: "--series-ao100",
  trend: "--series-trend",
  proj: "--series-proj",
};

export function readChartPalette(): ChartPalette {
  const style = getComputedStyle(document.documentElement);
  const out = {} as ChartPalette;
  for (const key of Object.keys(VARS) as (keyof ChartPalette)[]) {
    const v = style.getPropertyValue(VARS[key]).trim();
    out[key] = v || "#71717a";
  }
  return out;
}
