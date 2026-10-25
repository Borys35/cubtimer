import type { TimerSolve } from "@/lib/types";

export type TimerPhase = "idle" | "armed" | "running" | "inspection";

export function formatTimerTime(ms: number): string {
  if (ms < 60000) {
    const centiseconds = Math.floor(ms / 10);
    const seconds = centiseconds / 100;
    return seconds.toFixed(2);
  }
  const minutes = Math.floor(ms / 60000);
  const remaining = ms % 60000;
  const centiseconds = Math.floor(remaining / 10);
  const seconds = centiseconds / 100;
  return `${minutes}:${seconds.toFixed(2).padStart(5, "0")}`;
}

export interface TypedTime {
  timeMs: number;
  dnf: boolean;
  /** 0 = none, 1 = +2s (same encoding as TimerSolve.penalty). */
  penalty: number;
}

const MAX_TYPED_MS = 60 * 60 * 1000;

/**
 * Parse a time typed from an external timer, csTimer-style:
 * - "12.34", "1:02.45", "0.99"  — explicit separators
 * - "1234" → 12.34, "10245" → 1:02.45 — bare digits, last two are centiseconds
 * - trailing "+" or "+2" adds a +2 penalty, e.g. "12.34+"
 * - "dnf" / "d" records a DNF; "dnf(12.34)" keeps the time
 * Returns null for anything unparseable, zero, or an hour and over.
 */
export function parseTypedTime(input: string): TypedTime | null {
  let s = input.trim().toLowerCase().replace(/\s+/g, "");
  if (!s) return null;

  const dnfMatch = s.match(/^(?:dnf|d)(?:\((.*)\))?$/);
  if (dnfMatch) {
    if (dnfMatch[1] === undefined) return { timeMs: 0, dnf: true, penalty: 0 };
    const inner = parseClock(dnfMatch[1]);
    return inner === null ? null : { timeMs: inner, dnf: true, penalty: 0 };
  }

  let penalty = 0;
  const plus = s.match(/\+2?$/);
  if (plus) {
    penalty = 1;
    s = s.slice(0, plus.index);
  }

  const timeMs = parseClock(s);
  return timeMs === null ? null : { timeMs, dnf: false, penalty };
}

function parseClock(s: string): number | null {
  let minutes: number;
  let seconds: number;

  if (/^\d+$/.test(s)) {
    // Bare digits: ...MMSScc
    const n = s.padStart(3, "0");
    const cs = Number(n.slice(-2));
    seconds = Number(n.slice(-4, -2) || "0") + cs / 100;
    minutes = Number(n.slice(0, -4) || "0");
  } else {
    const m = s.match(/^(?:(\d+):)?(\d+(?:\.\d*)?|\.\d+)$/);
    if (!m) return null;
    minutes = m[1] ? Number(m[1]) : 0;
    seconds = Number(m[2]);
  }

  if (minutes > 0 && seconds >= 60) return null;
  const ms = Math.round((minutes * 60 + seconds) * 1000);
  if (!(ms > 0) || ms >= MAX_TYPED_MS) return null;
  return ms;
}

const MAX_TYPED_DIGITS = 6; // mm:ss.cc

/**
 * Live mask for the typing-mode input: digits fill from the right, so
 * "1" → "0.01", "1234" → "12.34", "10245" → "1:02.45". Separators the user
 * types are ignored (the mask places them). A trailing "+"/"+2" is kept.
 * Anything containing letters (e.g. "DNF") is left as typed.
 */
export function formatTypedInput(raw: string): string {
  if (/[a-z]/i.test(raw)) return raw;

  const plusAt = raw.indexOf("+");
  const body = plusAt === -1 ? raw : raw.slice(0, plusAt);
  const suffix = plusAt === -1 ? "" : raw.slice(plusAt) === "+2" ? "+2" : "+";

  const digits = body.replace(/\D/g, "").replace(/^0+/, "").slice(0, MAX_TYPED_DIGITS);
  if (!digits) return suffix && body ? `0.00${suffix}` : "";

  const padded = digits.padStart(3, "0");
  const cs = padded.slice(-2);
  const rest = padded.slice(0, -2);
  if (rest.length <= 2) return `${rest}.${cs}${suffix}`;
  return `${rest.slice(0, -2)}:${rest.slice(-2)}.${cs}${suffix}`;
}

export type PenaltyPatch = Pick<TimerSolve, "penalty" | "dnf">;

/**
 * Patch for toggling +2 or DNF on a solve. The two are mutually exclusive:
 * turning one on clears the other; toggling an active one clears it.
 */
export function togglePenalty(solve: PenaltyPatch, kind: "plus2" | "dnf"): PenaltyPatch {
  if (kind === "dnf") return { dnf: !solve.dnf, penalty: 0 };
  return { penalty: solve.penalty > 0 ? 0 : 1, dnf: false };
}

/** Result as shown on the timer: "12.34", "14.34+" with +2, or "DNF". */
export function formatSolveResult(solve: Pick<TimerSolve, "timeMs" | "penalty" | "dnf">): string {
  if (solve.dnf) return "DNF";
  if (solve.penalty > 0) return `${formatTimerTime(solve.timeMs + solve.penalty * 2000)}+`;
  return formatTimerTime(solve.timeMs);
}
