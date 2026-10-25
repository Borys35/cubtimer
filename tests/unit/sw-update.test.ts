import { describe, it, expect } from "vitest";
import { shouldShowUpdateToast } from "@/lib/sw-update";
import type { TimerPhase } from "@/lib/timer-utils";

describe("shouldShowUpdateToast", () => {
  it("shows when an update is waiting and the timer is idle", () => {
    expect(shouldShowUpdateToast(true, "idle")).toBe(true);
  });

  it("never shows while armed, running or in inspection", () => {
    for (const phase of ["armed", "running", "inspection"] satisfies TimerPhase[]) {
      expect(shouldShowUpdateToast(true, phase), phase).toBe(false);
    }
  });

  it("defers an update that arrives mid-solve until the timer is idle again", () => {
    const phases: TimerPhase[] = ["inspection", "armed", "running", "idle"];
    expect(phases.map((phase) => shouldShowUpdateToast(true, phase))).toEqual([false, false, false, true]);
  });

  it("stays hidden with no update waiting", () => {
    for (const phase of ["idle", "armed", "running", "inspection"] satisfies TimerPhase[]) {
      expect(shouldShowUpdateToast(false, phase), phase).toBe(false);
    }
  });
});
