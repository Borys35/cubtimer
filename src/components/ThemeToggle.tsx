"use client";

import { THEME_LABELS as LABELS, type Theme } from "@/lib/theme";
import { useTheme } from "@/components/ThemeProvider";

const ICONS: Record<Theme, string> = {
  dark: "\u25CF",
  light: "\u25CB",
  borealis: "\u2726",
  nebula: "\u2726",
  ember: "\u2726",
};

export default function ThemeToggle() {
  const { theme, cycleTheme } = useTheme();

  return (
    <button
      onClick={cycleTheme}
      aria-label={`Theme: ${LABELS[theme]}. Click to switch.`}
      className="card flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-[var(--text-dim)] transition-colors hover:text-[var(--text)]"
    >
      <span className="text-[10px]">{ICONS[theme]}</span>
      {LABELS[theme]}
    </button>
  );
}
