import { useState, useCallback, useEffect, useRef } from "react";
import type { TimerPhase } from "@/lib/timer-utils";
import { generateScramble, generateFallbackScramble } from "@/lib/scramble";
import type { PuzzleType } from "@/lib/types";

/** WCA allows starting up to 2s past the inspection limit, with a +2. */
const INSPECTION_GRACE_MS = 2000;

export interface UseTimerOptions {
  puzzleType: PuzzleType;
  startDelayMs: number;
  inspectionEnabled?: boolean;
  inspectionDurationSec?: number;
  onSolve: (solve: { timeMs: number; scramble: string; dnf: boolean; penalty: number }) => void;
}

export interface UseTimerReturn {
  phase: TimerPhase;
  displayTime: number;
  scramble: string;
  scrambleIndex: number;
  scrambleTotal: number;
  armedAt: number;
  handleKeyDown: () => void;
  handleKeyUp: () => void;
  handleTap: () => void;
  /** True while the WCA inspection countdown runs (including while armed during it). */
  inspecting: boolean;
  /** Abort a hold in progress (e.g. the touch turned into a swipe). No-op unless armed. */
  cancelArm: () => void;
  /** Record a time entered from an external timer against the current scramble. */
  submitTyped: (solve: { timeMs: number; dnf: boolean; penalty: number }) => void;
  prevScramble: () => void;
  nextScramble: () => void;
}

export function useTimer({
  puzzleType,
  startDelayMs,
  inspectionEnabled = false,
  inspectionDurationSec = 15,
  onSolve,
}: UseTimerOptions): UseTimerReturn {
  const [phase, setPhase] = useState<TimerPhase>("idle");
  const [displayTime, setDisplayTime] = useState(0);
  const [scrambleHistory, setScrambleHistory] = useState<string[]>(() => [
    generateFallbackScramble(puzzleType),
  ]);
  const [scrambleIndex, setScrambleIndex] = useState(0);

  const startTimeRef = useRef(0);
  const rafRef = useRef(0);
  const delayTimerRef = useRef<ReturnType<typeof setTimeout> | number>(0);
  const inspectionIntervalRef = useRef<ReturnType<typeof setInterval> | number>(0);
  const armedAtRef = useRef(0);
  const inspectionStartRef = useRef(0);
  const [inspecting, setInspecting] = useState(false);
  const solveInFlightRef = useRef(false);

  const tick = useCallback(() => {
    const elapsed = performance.now() - startTimeRef.current;
    setDisplayTime(elapsed);
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const nextScramblePromiseRef = useRef<Promise<string> | null>(null);

  const consumeNextScramble = useCallback(() => {
    const promise = nextScramblePromiseRef.current ?? generateScramble(puzzleType);
    nextScramblePromiseRef.current = generateScramble(puzzleType);

    promise
      .then((newScramble) => {
        setScrambleHistory((prev) => {
          const next = [...prev, newScramble];
          setScrambleIndex(next.length - 1);
          return next;
        });
      })
      .catch(() => {
        const fallback = generateFallbackScramble(puzzleType);
        setScrambleHistory((prev) => {
          const next = [...prev, fallback];
          setScrambleIndex(next.length - 1);
          return next;
        });
      });
  }, [puzzleType]);

  const startTiming = useCallback(
    (penalty: number) => {
      cancelAnimationFrame(rafRef.current);
      startTimeRef.current = performance.now();
      setDisplayTime(0);
      setPhase("running");
      rafRef.current = requestAnimationFrame(tick);

      // Ensure upcoming scramble is prefetching while user solves
      if (!nextScramblePromiseRef.current) {
        nextScramblePromiseRef.current = generateScramble(puzzleType);
      }

      const scrambleRef = scrambleHistory[scrambleIndex];
      const onSolveRef = onSolve;

      const recordAndReset = () => {
        cancelAnimationFrame(rafRef.current);
        const elapsed = performance.now() - startTimeRef.current;
        const timeMs = Math.round(elapsed);
        setDisplayTime(timeMs);
        setPhase("idle");
        solveInFlightRef.current = false;
        onSolveRef({ timeMs, scramble: scrambleRef, dnf: false, penalty });
        consumeNextScramble();
      };

      stopTimingRef.current = recordAndReset;
    },
    [tick, onSolve, scrambleHistory, scrambleIndex, puzzleType, consumeNextScramble],
  );

  const stopTimingRef = useRef<() => void>(() => {});

  const recordSolve = useCallback(
    (dnf: boolean, penalty: number) => {
      cancelAnimationFrame(rafRef.current);
      clearInterval(inspectionIntervalRef.current);
      clearTimeout(delayTimerRef.current);
      setDisplayTime(0);
      setPhase("idle");
      setInspecting(false);
      solveInFlightRef.current = false;
      onSolve({ timeMs: 0, scramble: scrambleHistory[scrambleIndex], dnf, penalty });
      consumeNextScramble();
    },
    [onSolve, scrambleHistory, scrambleIndex, consumeNextScramble],
  );

  // The inspection interval outlives renders; always call the latest recordSolve.
  const recordSolveRef = useRef(recordSolve);
  recordSolveRef.current = recordSolve;

  const inspectionLimitMs = inspectionDurationSec * 1000;

  const startInspection = useCallback(() => {
    clearInterval(inspectionIntervalRef.current);
    inspectionStartRef.current = performance.now();
    solveInFlightRef.current = true;
    setInspecting(true);
    setPhase("inspection");
    setDisplayTime(inspectionLimitMs);

    inspectionIntervalRef.current = setInterval(() => {
      const elapsed = performance.now() - inspectionStartRef.current;
      setDisplayTime(inspectionLimitMs - elapsed);
      if (elapsed >= inspectionLimitMs + INSPECTION_GRACE_MS) {
        recordSolveRef.current(true, 0);
      }
    }, 100);
  }, [inspectionLimitMs]);

  /** WCA A3a: start within the limit = clean, within +2s grace = +2, later = DNF. */
  const startFromInspection = useCallback(() => {
    clearInterval(inspectionIntervalRef.current);
    const elapsed = performance.now() - inspectionStartRef.current;
    if (elapsed >= inspectionLimitMs + INSPECTION_GRACE_MS) {
      recordSolve(true, 0);
      return;
    }
    setInspecting(false);
    startTiming(elapsed > inspectionLimitMs ? 1 : 0);
  }, [inspectionLimitMs, recordSolve, startTiming]);

  const handleKeyDown = useCallback(() => {
    if (phase === "idle" || phase === "inspection") {
      setPhase("armed");
      armedAtRef.current = performance.now();
    } else if (phase === "running") {
      stopTimingRef.current();
    }
  }, [phase]);

  const handleKeyUp = useCallback(() => {
    if (phase !== "armed") return;
    const held = performance.now() - armedAtRef.current;
    if (held < startDelayMs) {
      // Released too early: fall back to wherever the hold started from.
      setPhase(inspecting ? "inspection" : "idle");
      return;
    }
    if (inspecting) {
      startFromInspection();
    } else if (inspectionEnabled) {
      startInspection();
    } else {
      solveInFlightRef.current = true;
      startTiming(0);
    }
  }, [phase, startDelayMs, inspecting, inspectionEnabled, startInspection, startFromInspection, startTiming]);

  const handleTap = useCallback(() => {
    if (phase === "idle") {
      if (inspectionEnabled) {
        startInspection();
      } else {
        startTiming(0);
      }
    } else if (phase === "inspection") {
      startFromInspection();
    } else if (phase === "running") {
      stopTimingRef.current();
    }
  }, [phase, inspectionEnabled, startInspection, startFromInspection, startTiming]);

  const cancelArm = useCallback(() => {
    if (phase === "armed") setPhase(inspecting ? "inspection" : "idle");
  }, [phase, inspecting]);

  const submitTyped = useCallback(
    (solve: { timeMs: number; dnf: boolean; penalty: number }) => {
      if (phase !== "idle") return;
      setDisplayTime(solve.timeMs);
      onSolve({ ...solve, scramble: scrambleHistory[scrambleIndex] });
      consumeNextScramble();
    },
    [phase, onSolve, scrambleHistory, scrambleIndex, consumeNextScramble],
  );

  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(delayTimerRef.current);
      clearInterval(inspectionIntervalRef.current);
    };
  }, []);

  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const initialPlaceholderRef = useRef(scrambleHistory[0]);

  const prevPuzzleRef = useRef(puzzleType);
  useEffect(() => {
    // The first scramble renders synchronously from the random-move generator
    // so the page is never blank. Swap it for a cubing.js random-state scramble
    // as soon as one is ready, unless the user has already moved on from it.
    const upgradePlaceholder = (placeholder: string) => {
      generateScramble(puzzleType)
        .then((scramble) => {
          if (phaseRef.current !== "idle") return;
          setScrambleHistory((prev) =>
            prev.length === 1 && prev[0] === placeholder ? [scramble] : prev,
          );
        })
        .catch(() => {});
    };

    if (prevPuzzleRef.current !== puzzleType) {
      prevPuzzleRef.current = puzzleType;
      const initial = generateFallbackScramble(puzzleType);
      setScrambleHistory([initial]);
      setScrambleIndex(0);
      upgradePlaceholder(initial);
      nextScramblePromiseRef.current = generateScramble(puzzleType);
    } else if (!nextScramblePromiseRef.current) {
      upgradePlaceholder(initialPlaceholderRef.current);
      nextScramblePromiseRef.current = generateScramble(puzzleType);
    }
  }, [puzzleType]);

  const prevScramble = useCallback(() => {
    setScrambleIndex((i) => Math.max(0, i - 1));
  }, []);

  const nextScramble = useCallback(() => {
    if (scrambleIndex >= scrambleHistory.length - 1) {
      consumeNextScramble();
    } else {
      setScrambleIndex((i) => i + 1);
    }
  }, [scrambleIndex, scrambleHistory.length, consumeNextScramble]);

  return {
    phase,
    displayTime,
    scramble: scrambleHistory[scrambleIndex] || generateFallbackScramble(puzzleType),
    scrambleIndex,
    scrambleTotal: scrambleHistory.length,
    armedAt: armedAtRef.current,
    handleKeyDown,
    handleKeyUp,
    handleTap,
    inspecting,
    cancelArm,
    submitTyped,
    prevScramble,
    nextScramble,
  };
}
