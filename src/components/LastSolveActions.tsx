"use client";

import type { TimerSolve } from "@/lib/types";
import { togglePenalty, type PenaltyPatch } from "@/lib/timer-utils";

const btn = "min-w-14 px-4 py-2 rounded text-sm font-medium transition-colors";
const btnOff = "bg-[var(--surface-3)] hover:bg-[var(--surface-2)]";

/**
 * +2 / DNF / delete for the solve that just finished, right on the timer
 * screen. Taps never arm the timer: everything here is `data-no-timer`.
 */
export function LastSolveActions({
  solve,
  onUpdate,
  onDelete,
}: {
  solve: TimerSolve;
  onUpdate: (patch: PenaltyPatch) => void;
  onDelete: () => void;
}) {
  const plus2 = solve.penalty > 0;
  return (
    <div data-no-timer className="flex items-center justify-center gap-2" data-testid="last-solve-actions">
      <button
        type="button"
        onClick={() => onUpdate(togglePenalty(solve, "plus2"))}
        aria-pressed={plus2}
        aria-label="+2 penalty"
        className={`${btn} ${plus2 ? "bg-[var(--amber)]/20 text-[var(--amber)]" : btnOff}`}
      >
        +2
      </button>
      <button
        type="button"
        onClick={() => onUpdate(togglePenalty(solve, "dnf"))}
        aria-pressed={solve.dnf}
        aria-label="DNF"
        className={`${btn} ${solve.dnf ? "bg-[var(--red)]/20 text-[var(--red)]" : btnOff}`}
      >
        DNF
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label="Delete last solve"
        title="Delete last solve"
        className="p-2 rounded opacity-50 hover:opacity-100 hover:bg-[var(--surface-3)] hover:text-[var(--red)] transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  );
}
