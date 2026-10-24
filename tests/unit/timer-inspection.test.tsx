// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTimer } from "@/lib/use-timer";

// Real generation cold-loads cubing.js, which can outlast waitFor's timeout on
// CI. Instant, distinct scrambles keep the hook's async flow but make it fast.
vi.mock("@/lib/scramble", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/scramble")>();
  let n = 0;
  return { ...actual, generateScramble: vi.fn(async () => `R U R' U' #${++n}`) };
});

function createOpts(overrides: Record<string, unknown> = {}) {
  return {
    puzzleType: "3x3" as const,
    scrambleLength: 20,
    startDelayMs: 0,
    inspectionEnabled: false,
    inspectionDurationSec: 15,
    onSolve: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useTimer", () => {
  describe("without inspection", () => {
    it("starts timing on space hold+release", () => {
      const opts = createOpts();
      const { result } = renderHook(() => useTimer(opts));

      act(() => result.current.handleKeyDown());
      expect(result.current.phase).toBe("armed");

      act(() => result.current.handleKeyUp());
      act(() => vi.advanceTimersByTime(1));
      expect(result.current.phase).toBe("running");
    });

    it("stops timing and calls onSolve on second space press", () => {
      const opts = createOpts();
      const { result } = renderHook(() => useTimer(opts));

      act(() => result.current.handleKeyDown());
      act(() => result.current.handleKeyUp());
      act(() => vi.advanceTimersByTime(1));
      expect(result.current.phase).toBe("running");

      act(() => result.current.handleKeyDown());
      expect(result.current.phase).toBe("idle");
      expect(opts.onSolve).toHaveBeenCalledTimes(1);
    });

    it("cancels start when held shorter than startDelayMs", () => {
      const opts = createOpts({ startDelayMs: 500 });
      const { result } = renderHook(() => useTimer(opts));

      act(() => result.current.handleKeyDown());
      expect(result.current.phase).toBe("armed");

      act(() => vi.advanceTimersByTime(300));
      act(() => result.current.handleKeyUp());
      expect(result.current.phase).toBe("idle");

      act(() => vi.advanceTimersByTime(600));
      expect(result.current.phase).toBe("idle");
      expect(opts.onSolve).not.toHaveBeenCalled();
    });

    it("starts timing when held for full startDelayMs", () => {
      const opts = createOpts({ startDelayMs: 500 });
      const { result } = renderHook(() => useTimer(opts));

      act(() => result.current.handleKeyDown());
      expect(result.current.phase).toBe("armed");

      act(() => vi.advanceTimersByTime(600));
      act(() => result.current.handleKeyUp());
      act(() => vi.advanceTimersByTime(1));
      expect(result.current.phase).toBe("running");
    });

    it("cancelArm aborts a hold so release does not start the timer", () => {
      const opts = createOpts({ startDelayMs: 500 });
      const { result } = renderHook(() => useTimer(opts));

      act(() => result.current.handleKeyDown());
      act(() => vi.advanceTimersByTime(600));
      act(() => result.current.cancelArm());
      expect(result.current.phase).toBe("idle");

      act(() => result.current.handleKeyUp());
      act(() => vi.advanceTimersByTime(600));
      expect(result.current.phase).toBe("idle");
      expect(opts.onSolve).not.toHaveBeenCalled();
    });
  });

  describe("typed times", () => {
    it("submitTyped records the time against the current scramble", () => {
      const opts = createOpts();
      const { result } = renderHook(() => useTimer(opts));
      const scramble = result.current.scramble;

      act(() => result.current.submitTyped({ timeMs: 12340, dnf: false, penalty: 1 }));
      expect(opts.onSolve).toHaveBeenCalledWith({ timeMs: 12340, dnf: false, penalty: 1, scramble });
      expect(result.current.displayTime).toBe(12340);
      expect(result.current.phase).toBe("idle");
    });
  });

  describe("with inspection", () => {
    it("enters inspection phase on space hold+release", () => {
      const opts = createOpts({
        inspectionEnabled: true,
        inspectionDurationSec: 15,
      });
      const { result } = renderHook(() => useTimer(opts));

      act(() => result.current.handleKeyDown());
      act(() => result.current.handleKeyUp());
      expect(result.current.phase).toBe("inspection");
    });

    function enterInspection(opts: ReturnType<typeof createOpts>) {
      const hook = renderHook(() => useTimer(opts));
      act(() => hook.result.current.handleKeyDown());
      act(() => hook.result.current.handleKeyUp());
      expect(hook.result.current.phase).toBe("inspection");
      expect(hook.result.current.inspecting).toBe(true);
      return hook;
    }

    it("starts timing from inspection with space hold+release (no penalty within limit)", () => {
      const opts = createOpts({ inspectionEnabled: true, inspectionDurationSec: 15 });
      const { result } = enterInspection(opts);

      act(() => vi.advanceTimersByTime(5000));
      act(() => result.current.handleKeyDown());
      expect(result.current.phase).toBe("armed");
      act(() => result.current.handleKeyUp());
      expect(result.current.phase).toBe("running");
      expect(result.current.inspecting).toBe(false);

      act(() => result.current.handleKeyDown());
      expect(opts.onSolve).toHaveBeenCalledWith(
        expect.objectContaining({ dnf: false, penalty: 0 }),
      );
    });

    it("returns to inspection when the hold is released before startDelayMs", () => {
      const opts = createOpts({ inspectionEnabled: true, inspectionDurationSec: 15, startDelayMs: 500 });
      const { result } = renderHook(() => useTimer(opts));
      act(() => result.current.handleKeyDown());
      act(() => vi.advanceTimersByTime(600));
      act(() => result.current.handleKeyUp());
      expect(result.current.phase).toBe("inspection");

      act(() => result.current.handleKeyDown());
      act(() => vi.advanceTimersByTime(200));
      act(() => result.current.handleKeyUp());
      expect(result.current.phase).toBe("inspection");

      act(() => result.current.handleKeyDown());
      act(() => result.current.cancelArm());
      expect(result.current.phase).toBe("inspection");
    });

    it("keeps counting inspection down while armed", () => {
      const opts = createOpts({ inspectionEnabled: true, inspectionDurationSec: 15 });
      const { result } = enterInspection(opts);

      act(() => result.current.handleKeyDown());
      act(() => vi.advanceTimersByTime(3000));
      expect(result.current.phase).toBe("armed");
      expect(result.current.displayTime).toBeLessThanOrEqual(12000);
    });

    it("applies +2 when starting in the 2s grace window after the limit", () => {
      const opts = createOpts({ inspectionEnabled: true, inspectionDurationSec: 15 });
      const { result } = enterInspection(opts);

      act(() => vi.advanceTimersByTime(16000));
      expect(result.current.phase).toBe("inspection");
      act(() => result.current.handleKeyDown());
      act(() => result.current.handleKeyUp());
      expect(result.current.phase).toBe("running");

      act(() => result.current.handleKeyDown());
      expect(opts.onSolve).toHaveBeenCalledWith(
        expect.objectContaining({ dnf: false, penalty: 1 }),
      );
    });

    it("handleTap starts from inspection without penalty within the limit", () => {
      const opts = createOpts({ inspectionEnabled: true, inspectionDurationSec: 15 });
      const { result } = enterInspection(opts);

      act(() => vi.advanceTimersByTime(14000));
      act(() => result.current.handleTap());
      expect(result.current.phase).toBe("running");

      act(() => result.current.handleKeyDown());
      expect(opts.onSolve).toHaveBeenCalledWith(
        expect.objectContaining({ penalty: 0 }),
      );
    });

    it("records DNF when inspection runs past the +2 grace window", () => {
      const opts = createOpts({ inspectionEnabled: true, inspectionDurationSec: 15 });
      const { result } = enterInspection(opts);

      act(() => vi.advanceTimersByTime(16000));
      expect(opts.onSolve).not.toHaveBeenCalled();

      act(() => vi.advanceTimersByTime(1200));
      expect(result.current.phase).toBe("idle");
      expect(result.current.inspecting).toBe(false);
      expect(opts.onSolve).toHaveBeenCalledWith(
        expect.objectContaining({ dnf: true }),
      );
    });
  });

  describe("scramble stability", () => {
    it("generates exactly one new scramble when solve ends and does not replace it", async () => {
      const opts = createOpts();
      const { result } = renderHook(() => useTimer(opts));

      const initialScramble = result.current.scramble;
      expect(initialScramble.length).toBeGreaterThan(0);

      // Start solve
      act(() => result.current.handleKeyDown());
      act(() => result.current.handleKeyUp());
      act(() => vi.advanceTimersByTime(1));
      expect(result.current.phase).toBe("running");

      // Stop solve
      act(() => result.current.handleKeyDown());
      expect(result.current.phase).toBe("idle");
      expect(opts.onSolve).toHaveBeenCalledTimes(1);

      // Wait for async scramble to resolve
      await vi.waitFor(() => {
        expect(result.current.scrambleTotal).toBe(2);
      });

      const nextScramble = result.current.scramble;
      expect(nextScramble).not.toBe(initialScramble);
      expect(result.current.scrambleTotal).toBe(2);

      // Advance time by several seconds (where the bug used to overwrite the scramble)
      act(() => vi.advanceTimersByTime(5000));
      await act(async () => {
        await Promise.resolve();
      });

      // The scramble must NOT have mutated or changed to a second scramble
      expect(result.current.scramble).toBe(nextScramble);
      expect(result.current.scrambleTotal).toBe(2);
    });
  });
});

