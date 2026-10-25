// Decision logic for the "New version available" toast (UpdateToast). Kept
// free of browser globals so it can be unit-tested.
import type { TimerPhase } from "@/lib/timer-utils";

/**
 * The toast shows only while the timer is idle: an update that arrives while
 * armed, running or in inspection waits until the solve is over. Pages
 * without a timer report "idle".
 */
export function shouldShowUpdateToast(updateWaiting: boolean, phase: TimerPhase): boolean {
  return updateWaiting && phase === "idle";
}

/** Tells a waiting worker to activate now (Serwist's built-in handler). */
export const SKIP_WAITING_MESSAGE = { type: "SKIP_WAITING" } as const;
