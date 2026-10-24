"use client";

import { useEffect, useCallback, useRef, useState } from "react";
import { useSession } from "@/components/SessionProvider";
import { useTimer } from "@/lib/use-timer";
import { formatTimerTime, formatTypedInput, parseTypedTime } from "@/lib/timer-utils";
import { playStartBeep, playStopBeep } from "@/lib/sound";
import { useMenu } from "@/components/MenuContext";
import { useTimerPhase } from "@/components/TimerPhaseContext";
import { useWakeLock } from "@/lib/use-wake-lock";

/** Touches starting on these never arm the timer — they're normal taps. */
const NO_TIMER_SELECTOR = "button, a, input, select, textarea, [data-no-timer]";
/** A touch that drifts further than this (px) is a swipe/scroll, not a hold. */
const TOUCH_SLOP_PX = 12;

export default function TimerPage() {
  const { activeSession, settings, updateSettings, addSolve } = useSession();
  const { mobileOpen, setMobileOpen } = useMenu();
  const { setPhase: publishPhase } = useTimerPhase();

  const puzzleType = activeSession?.puzzleType ?? "3x3";
  const typing = settings.inputMode === "typing";
  const zen = settings.zenMode;

  const solve = useCallback(
    (data: { timeMs: number; scramble: string; dnf: boolean; penalty: number }) => {
      addSolve({
        timeMs: data.timeMs,
        dnf: data.dnf,
        penalty: data.penalty,
        scramble: data.scramble,
        dateSec: Math.floor(Date.now() / 1000),
      });
    },
    [addSolve],
  );

  const {
    phase,
    displayTime,
    scramble,
    scrambleIndex,
    armedAt,
    inspecting,
    handleKeyDown,
    handleKeyUp,
    cancelArm,
    submitTyped,
    prevScramble,
    nextScramble,
  } = useTimer({
    puzzleType,
    startDelayMs: settings.startDelayMs,
    inspectionEnabled: settings.inspectionEnabled,
    inspectionDurationSec: settings.inspectionDurationSec,
    onSolve: solve,
  });

  useEffect(() => {
    publishPhase(phase);
  }, [phase, publishPhase]);

  // Long scrambles mean long stretches without a touch; don't let the screen sleep.
  useWakeLock(settings.keepAwake);

  useEffect(() => {
    if (zen) setMobileOpen(false);
  }, [zen, setMobileOpen]);

  const handleKeyDownEvent = useCallback(
    (e: KeyboardEvent) => {
      if (typing || e.repeat) return;
      if (phase === "running") {
        e.preventDefault();
        handleKeyDown();
      } else if (e.code === "Space") {
        e.preventDefault();
        handleKeyDown();
      }
    },
    [typing, phase, handleKeyDown],
  );

  const handleKeyUpEvent = useCallback(
    (e: KeyboardEvent) => {
      if (typing) return;
      if (e.code === "Space") {
        e.preventDefault();
        handleKeyUp();
      }
    },
    [typing, handleKeyUp],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDownEvent);
    window.addEventListener("keyup", handleKeyUpEvent);
    return () => {
      window.removeEventListener("keydown", handleKeyDownEvent);
      window.removeEventListener("keyup", handleKeyUpEvent);
    };
  }, [handleKeyDownEvent, handleKeyUpEvent]);

  // Touch: native non-passive listeners so preventDefault() can suppress
  // ghost clicks, double-tap zoom and long-press menus.
  const padRef = useRef<HTMLDivElement>(null);
  /** When the start pad is rendered, only holds that begin inside it arm the timer. */
  const startPadRef = useRef<HTMLDivElement>(null);
  const touchRef = useRef<{ id: number; x: number; y: number } | null>(null);
  const handlersRef = useRef({ phase, handleKeyDown, handleKeyUp, cancelArm });
  handlersRef.current = { phase, handleKeyDown, handleKeyUp, cancelArm };

  useEffect(() => {
    const pad = padRef.current;
    if (!pad || typing) return;

    const onStart = (e: TouchEvent) => {
      const h = handlersRef.current;
      // Stopping must be effortless: any touch anywhere ends the solve.
      if (h.phase === "running") {
        e.preventDefault();
        touchRef.current = null;
        h.handleKeyDown();
        return;
      }
      if (e.touches.length > 1) {
        // Second finger (pinch/zoom) — never a start.
        touchRef.current = null;
        h.cancelArm();
        return;
      }
      const target = e.target as Element | null;
      if (target?.closest(NO_TIMER_SELECTOR)) return;
      const startPad = startPadRef.current;
      if (startPad && !(target && startPad.contains(target))) return;
      e.preventDefault();
      const t = e.changedTouches[0];
      touchRef.current = { id: t.identifier, x: t.clientX, y: t.clientY };
      h.handleKeyDown();
    };

    const onMove = (e: TouchEvent) => {
      const start = touchRef.current;
      if (!start) return;
      const t = [...e.changedTouches].find((c) => c.identifier === start.id);
      if (!t) return;
      if (Math.hypot(t.clientX - start.x, t.clientY - start.y) > TOUCH_SLOP_PX) {
        touchRef.current = null;
        handlersRef.current.cancelArm();
      }
    };

    const onEnd = (e: TouchEvent) => {
      const start = touchRef.current;
      if (!start) return;
      if (![...e.changedTouches].some((c) => c.identifier === start.id)) return;
      e.preventDefault();
      touchRef.current = null;
      handlersRef.current.handleKeyUp();
    };

    const onCancel = () => {
      touchRef.current = null;
      handlersRef.current.cancelArm();
    };

    pad.addEventListener("touchstart", onStart, { passive: false });
    pad.addEventListener("touchmove", onMove, { passive: true });
    pad.addEventListener("touchend", onEnd, { passive: false });
    pad.addEventListener("touchcancel", onCancel);
    return () => {
      pad.removeEventListener("touchstart", onStart);
      pad.removeEventListener("touchmove", onMove);
      pad.removeEventListener("touchend", onEnd);
      pad.removeEventListener("touchcancel", onCancel);
    };
  }, [typing]);

  const prevPhaseRef = useRef(phase);
  useEffect(() => {
    if (!settings.soundEnabled) {
      prevPhaseRef.current = phase;
      return;
    }

    const prev = prevPhaseRef.current;
    if (prev !== "running" && phase === "running") {
      playStartBeep();
    } else if (prev === "running" && phase === "idle") {
      playStopBeep();
    }
    prevPhaseRef.current = phase;
  }, [phase, settings.soundEnabled]);

  const [coarsePointer, setCoarsePointer] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    setCoarsePointer(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setCoarsePointer(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const phaseLabel =
    phase === "armed"
      ? "Ready..."
      : phase === "running"
        ? "Solving..."
        : phase === "inspection"
          ? coarsePointer
            ? "Inspecting... hold here to start"
            : "Inspecting... hold space to start"
          : coarsePointer
            ? "Hold here to start"
            : "Press spacebar to start";

  const [holdMs, setHoldMs] = useState(0);
  useEffect(() => {
    if (phase !== "armed") {
      setHoldMs(0);
      return;
    }
    const id = setInterval(() => {
      setHoldMs(performance.now() - armedAt);
    }, 30);
    return () => clearInterval(id);
  }, [phase, armedAt]);

  const showBlind = settings.hideTimer && phase === "running";

  // During inspection displayTime is the remaining ms; ≤0 means the +2 grace window.
  const inspectionOver = inspecting && displayTime <= 0;

  const timerColor =
    phase === "armed"
      ? holdMs >= settings.startDelayMs
        ? "var(--green)"
        : "var(--red)"
      : inspectionOver
        ? "var(--red)"
        : inspecting && displayTime <= 3000
          ? "var(--amber)"
          : "var(--text)";

  const timerText = inspecting
    ? inspectionOver
      ? "+2"
      : String(Math.ceil(displayTime / 1000))
    : showBlind
      ? "Solving..."
      : formatTimerTime(displayTime);

  const isActive = phase === "armed" || phase === "running" || phase === "inspection";

  const showStartPad = coarsePointer && !typing;
  const startPadState =
    phase === "running"
      ? "running"
      : phase === "armed"
        ? holdMs >= settings.startDelayMs
          ? "ready"
          : "holding"
        : "idle";

  // --- Typing mode ---
  const [typed, setTyped] = useState("");
  const [typedError, setTypedError] = useState(false);
  const typedInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (typing) typedInputRef.current?.focus();
  }, [typing]);

  const onTypedSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseTypedTime(typed);
    if (!parsed) {
      setTypedError(true);
      return;
    }
    submitTyped(parsed);
    setTyped("");
    setTypedError(false);
    typedInputRef.current?.focus();
  };

  const timerDisplay = (
    <div
      className="text-7xl sm:text-8xl md:text-9xl font-mono font-bold tracking-tight cursor-pointer transition-colors"
      style={{ color: timerColor }}
      data-testid="timer-display"
    >
      {timerText}
    </div>
  );

  const sessionInfo = (
    <div className="mt-8 text-base opacity-30">
      {puzzleType} &middot; {activeSession?.name ?? "No session"}
    </div>
  );

  const toolbarBtn =
    "p-2 rounded opacity-50 hover:opacity-100 hover:bg-[var(--surface-3)] transition-opacity";

  return (
    <div
      ref={padRef}
      className={`timer-pad flex flex-col items-center h-full select-none relative px-4 sm:px-12 ${
        showStartPad ? "pt-14 pb-4" : "justify-center"
      }`}
    >
      {!zen && (
        <button
          className={`absolute top-3 left-3 z-40 md:hidden p-2 rounded bg-[var(--surface-3)] hover:bg-[var(--surface-2)] transition-colors ${isActive ? "opacity-30 pointer-events-none" : ""}`}
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle sessions"
          disabled={isActive}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}

      <div
        data-no-timer
        className={`absolute top-3 right-3 z-40 flex items-center gap-1 transition-opacity ${isActive ? "opacity-0 pointer-events-none" : ""}`}
      >
        <button
          className={toolbarBtn}
          onClick={() => updateSettings({ inputMode: typing ? "timer" : "typing" })}
          aria-label={typing ? "Switch to built-in timer" : "Switch to typing times"}
          aria-pressed={typing}
          title={typing ? "Built-in timer" : "Type times from an external timer"}
        >
          {typing ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="12" cy="13" r="8" strokeWidth={2} />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v4l2 2M10 2h4" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <rect x="2" y="6" width="20" height="12" rx="2" strokeWidth={2} />
              <path strokeLinecap="round" strokeWidth={2} d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10" />
            </svg>
          )}
        </button>
        <button
          className={toolbarBtn}
          onClick={() => updateSettings({ zenMode: !zen })}
          aria-label={zen ? "Exit zen mode" : "Enter zen mode"}
          aria-pressed={zen}
          title={zen ? "Show sidebar" : "Zen mode — hide sidebar"}
        >
          {zen ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" />
            </svg>
          )}
        </button>
      </div>

      <div
        data-no-timer
        className={`flex items-center gap-1 sm:gap-3 w-full max-w-4xl shrink-0 ${showStartPad ? "mb-4" : "mb-6 sm:mb-8"}`}
      >
        <button
          onClick={prevScramble}
          disabled={scrambleIndex === 0 || isActive}
          className="shrink-0 p-2 rounded opacity-40 hover:opacity-80 disabled:opacity-10 disabled:pointer-events-none transition-opacity"
          aria-label="Previous scramble"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div
          suppressHydrationWarning
          className="text-lg sm:text-[28px] md:text-[36px] font-medium opacity-70 text-center whitespace-pre-wrap leading-snug tracking-[0.08em] sm:tracking-[0.15em] flex-1 min-w-0 break-words max-h-[35vh] overflow-y-auto overflow-x-hidden"
        >
          {scramble}
        </div>
        <button
          onClick={nextScramble}
          disabled={isActive}
          className="shrink-0 p-2 rounded opacity-40 hover:opacity-80 disabled:opacity-10 disabled:pointer-events-none transition-opacity"
          aria-label="Next scramble"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {typing ? (
        <form onSubmit={onTypedSubmit} className="flex flex-col items-center w-full max-w-md">
          <input
            ref={typedInputRef}
            value={typed}
            onChange={(e) => {
              setTyped(formatTypedInput(e.target.value));
              setTypedError(false);
            }}
            inputMode="decimal"
            autoComplete="off"
            spellCheck={false}
            placeholder={formatTimerTime(displayTime)}
            aria-label="Solve time"
            aria-invalid={typedError}
            className={`w-full text-center text-6xl sm:text-8xl font-mono font-bold tracking-tight bg-transparent border-b-2 outline-none py-2 placeholder:text-[var(--text-faint)] ${
              typedError ? "border-[var(--red)]" : "border-[var(--border)] focus:border-[var(--amber)]"
            }`}
            data-testid="typed-time-input"
          />
          <div className={`text-sm mt-4 ${typedError ? "text-[var(--red)]" : "opacity-40"}`}>
            {typedError
              ? "Couldn't read that time — type digits, e.g. 1234 for 12.34"
              : "Type digits and press Enter · + for +2 · DNF"}
          </div>
          <button
            type="submit"
            className="mt-4 px-6 py-2 rounded bg-[var(--amber)] text-[var(--bg)] font-medium sm:hidden"
          >
            Save
          </button>
        </form>
      ) : showStartPad ? (
        <div
          ref={startPadRef}
          className="start-pad flex-1 min-h-0 w-full max-w-4xl flex flex-col items-center justify-center px-2"
          data-state={startPadState}
          data-testid="start-pad"
        >
          {(phase === "idle" || phase === "inspection") && (
            <svg className="w-10 h-10 mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <circle cx="12" cy="12" r="3.5" fill="currentColor" stroke="none" />
              <circle cx="12" cy="12" r="8" strokeWidth={1.5} />
            </svg>
          )}
          {timerDisplay}
          <div className="text-xl opacity-40 mt-4 text-center">{phaseLabel}</div>
          {sessionInfo}
        </div>
      ) : (
        <>
          {timerDisplay}
          <div className="text-xl opacity-40 mt-4">{phaseLabel}</div>
        </>
      )}

      {!showStartPad && sessionInfo}
    </div>
  );
}
