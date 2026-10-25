"use client";

import { useState, useMemo } from "react";
import type { PuzzleType, TimerSolve } from "@/lib/types";
import { useSession } from "@/components/SessionProvider";
import { useMenu } from "@/components/MenuContext";
import { formatTimerTime } from "@/lib/timer-utils";
import { rollingAverage, rollingMean, median, madCv, iqrCv, computePersonalBests, type PersonalBests } from "@/lib/stats";
import { Toast } from "@/components/Toast";

const PUZZLE_OPTIONS: PuzzleType[] = [
  "3x3",
  "2x2",
  "4x4",
  "5x5",
  "6x6",
  "7x7",
  "Pyraminx",
  "Megaminx",
  "Skewb",
  "Square-1",
  "Clock",
];

export function NewSessionPicker({
  onSelect,
  onClose,
}: {
  onSelect: (puzzle: PuzzleType) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-[var(--surface-2)] border border-[var(--border)] rounded-lg p-6 shadow-2xl w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-4">Pick puzzle</h2>
        <div className="grid grid-cols-3 gap-2.5 max-h-[60vh] overflow-y-auto">
          {PUZZLE_OPTIONS.map((puzzle) => (
            <button
              key={puzzle}
              onClick={() => {
                onSelect(puzzle);
                onClose();
              }}
              className="min-w-0 break-words px-2 py-2.5 rounded-md bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-3)] hover:border-[var(--amber)] transition-colors text-sm font-medium text-center"
            >
              {puzzle}
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          className="mt-4 w-full px-4 py-2 text-sm opacity-60 hover:opacity-100 transition-opacity"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function toSolve(s: TimerSolve) {
  return {
    timeMs: s.timeMs + (s.penalty > 0 ? 2000 : 0),
    dnf: s.dnf,
    penalty: s.penalty,
    scramble: s.scramble,
    dateSec: s.dateSec,
    splits: [],
  };
}

function bestTime(solves: TimerSolve[]): number | null {
  const clean = solves.filter((s) => !s.dnf);
  if (clean.length === 0) return null;
  return Math.min(...clean.map((s) => s.timeMs + (s.penalty > 0 ? 2000 : 0)));
}

function computeSessionStats(solves: TimerSolve[]) {
  const solveList = solves.map(toSolve);
  const pbs = computePersonalBests(solveList);
  const clean = solves.filter((s) => !s.dnf);
  const times = clean.map((s) => s.timeMs + (s.penalty > 0 ? 2000 : 0));
  const mean = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : null;
  const med = median(times);
  const stdDev =
    times.length >= 2
      ? Math.sqrt(times.reduce((a, t) => a + (t - mean!) ** 2, 0) / times.length)
      : null;
  const rCv = times.length >= 3 ? madCv(times) : null;
  const iqr = times.length >= 3 ? iqrCv(times) : null;

  const mo3Arr = rollingMean(solveList, 3);
  const ao5Arr = rollingAverage(solveList, 5);
  const ao12Arr = rollingAverage(solveList, 12);
  const ao50Arr = rollingAverage(solveList, 50);
  const ao100Arr = rollingAverage(solveList, 100);

  const lastMo3Ms = mo3Arr.length > 0 ? mo3Arr[mo3Arr.length - 1].ms : null;
  const currentMo3 = lastMo3Ms !== null && isFinite(lastMo3Ms) ? lastMo3Ms : null;

  const lastAo5Ms = ao5Arr.length > 0 ? ao5Arr[ao5Arr.length - 1].ms : null;
  const currentAo5 = lastAo5Ms !== null && isFinite(lastAo5Ms) ? lastAo5Ms : null;

  const lastAo12Ms = ao12Arr.length > 0 ? ao12Arr[ao12Arr.length - 1].ms : null;
  const currentAo12 = lastAo12Ms !== null && isFinite(lastAo12Ms) ? lastAo12Ms : null;

  const lastAo50Ms = ao50Arr.length > 0 ? ao50Arr[ao50Arr.length - 1].ms : null;
  const currentAo50 = lastAo50Ms !== null && isFinite(lastAo50Ms) ? lastAo50Ms : null;

  const lastAo100Ms = ao100Arr.length > 0 ? ao100Arr[ao100Arr.length - 1].ms : null;
  const currentAo100 = lastAo100Ms !== null && isFinite(lastAo100Ms) ? lastAo100Ms : null;

  return {
    best: pbs.single,
    mean,
    med,
    stdDev,
    rCv,
    iqr,
    currentMo3,
    bestMo3: pbs.mo3,
    currentAo5,
    bestAo5: pbs.ao5,
    currentAo12,
    bestAo12: pbs.ao12,
    currentAo50,
    bestAo50: pbs.ao50,
    currentAo100,
    bestAo100: pbs.ao100,
    pbs,
  };
}

function SolveList({
  solves,
  onSelectSolve,
}: {
  solves: TimerSolve[];
  onSelectSolve: (solve: TimerSolve) => void;
}) {
  const ao5Map = useMemo(() => {
    const arr = rollingAverage(solves.map(toSolve), 5);
    const map = new Map<number, number | null>();
    for (let i = 0; i < arr.length; i++) {
      map.set(i + 4, isFinite(arr[i].ms) ? arr[i].ms : null);
    }
    return map;
  }, [solves]);

  const ao12Map = useMemo(() => {
    const arr = rollingAverage(solves.map(toSolve), 12);
    const map = new Map<number, number | null>();
    for (let i = 0; i < arr.length; i++) {
      map.set(i + 11, isFinite(arr[i].ms) ? arr[i].ms : null);
    }
    return map;
  }, [solves]);

  const bestSingleMs = useMemo(() => {
    const clean = solves.filter((s) => !s.dnf);
    if (clean.length === 0) return null;
    return Math.min(...clean.map((s) => s.timeMs + (s.penalty > 0 ? 2000 : 0)));
  }, [solves]);

  const bestAo5Ms = useMemo(() => {
    const vals = [...ao5Map.values()].filter((v): v is number => v !== null);
    return vals.length > 0 ? Math.min(...vals) : null;
  }, [ao5Map]);

  const bestAo12Ms = useMemo(() => {
    const vals = [...ao12Map.values()].filter((v): v is number => v !== null);
    return vals.length > 0 ? Math.min(...vals) : null;
  }, [ao12Map]);

  if (solves.length === 0) return null;
  const reversed = [...solves].reverse();
  return (
    <table className="w-full text-sm" onClick={(e) => e.stopPropagation()}>
      <thead>
        <tr className="opacity-40 text-[10px] uppercase">
          <th className="text-left py-0.5">#</th>
          <th className="text-right py-0.5">Time</th>
          <th className="text-right py-0.5">Ao5</th>
          <th className="text-right py-0.5">Ao12</th>
        </tr>
      </thead>
      <tbody>
        {reversed.map((solve, i) => {
          const origIdx = solves.length - 1 - i;
          const ao5 = ao5Map.get(origIdx) ?? null;
          const ao12 = ao12Map.get(origIdx) ?? null;
          const solveEffectiveMs = solve.timeMs + (solve.penalty > 0 ? 2000 : 0);
          const isBestSingle = bestSingleMs !== null && !solve.dnf && solveEffectiveMs === bestSingleMs;
          const isBestAo5 = bestAo5Ms !== null && ao5 !== null && ao5 === bestAo5Ms;
          const isBestAo12 = bestAo12Ms !== null && ao12 !== null && ao12 === bestAo12Ms;
          return (
            <tr
              key={solve.id}
              className="hover:bg-[var(--surface-3)] cursor-pointer transition-colors"
              onClick={() => onSelectSolve(solve)}
            >
              <td className="py-0.5 opacity-30 text-xs">#{solves.length - i}</td>
              <td className={`py-0.5 text-right font-mono whitespace-nowrap ${isBestSingle ? "text-green-400 font-bold" : "opacity-60"}`}>
                {solve.dnf ? (
                  "DNF"
                ) : solve.penalty > 0 ? (
                  <span className="inline-flex items-center gap-1">
                    <span className="line-through opacity-50">{formatTimerTime(solve.timeMs)}</span>
                    <span className="text-amber-400">{formatTimerTime(solve.timeMs + 2000)}</span>
                  </span>
                ) : (
                  formatTimerTime(solve.timeMs)
                )}
              </td>
              <td className={`py-0.5 text-right font-mono text-xs ${isBestAo5 ? "text-blue-400 font-bold" : "opacity-40"}`}>
                {ao5 !== null ? formatTimerTime(ao5) : ""}
              </td>
              <td className={`py-0.5 text-right font-mono text-xs ${isBestAo12 ? "text-purple-400 font-bold" : "opacity-40"}`}>
                {ao12 !== null ? formatTimerTime(ao12) : ""}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function SolveDetailModal({
  solve,
  onClose,
  onUpdate,
  onDelete,
  onUndoDelete,
}: {
  solve: TimerSolve;
  onClose: () => void;
  onUpdate: (patch: Partial<Pick<TimerSolve, "penalty" | "dnf">>) => void;
  onDelete: () => void;
  onUndoDelete: () => void;
}) {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-[var(--surface-2)] border border-[var(--border)] rounded-lg p-5 shadow-2xl w-80"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-4">
          <div className="text-2xl font-mono font-bold mb-1">
            {solve.dnf ? (
              "DNF"
            ) : solve.penalty > 0 ? (
              <span className="inline-flex items-center gap-1">
                <span className="line-through opacity-50">{formatTimerTime(solve.timeMs)}</span>
                <span className="text-amber-400">{formatTimerTime(solve.timeMs + 2000)}</span>
              </span>
            ) : (
              formatTimerTime(solve.timeMs)
            )}
          </div>
          <div className="text-xs opacity-40">
            {new Date(solve.dateSec * 1000).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </div>
        </div>

        <div className="text-xs opacity-50 mb-4 break-all leading-relaxed font-mono">{solve.scramble}</div>

        <div className="flex gap-2 mb-3">
          <button
            onClick={() => onUpdate({ penalty: solve.penalty === 1 ? 0 : 1, dnf: false })}
            className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
              solve.penalty > 0
                ? "bg-amber-500/30 text-amber-400"
                : "bg-[var(--surface-3)] hover:bg-[var(--surface-2)]"
            }`}
          >
            +2
          </button>
          <button
            onClick={() => onUpdate({ dnf: !solve.dnf, penalty: 0 })}
            className={`flex-1 px-3 py-2 rounded text-sm font-medium transition-colors ${
              solve.dnf
                ? "bg-red-500/30 text-red-400"
                : "bg-[var(--surface-3)] hover:bg-[var(--surface-2)]"
            }`}
          >
            DNF
          </button>
        </div>

        <button
          onClick={() => {
            onDelete();
            onUndoDelete();
            onClose();
          }}
          className="w-full px-3 py-2 rounded text-sm bg-[var(--surface-3)] hover:bg-red-500/20 hover:text-red-400 transition-colors mb-2"
        >
          Delete
        </button>
        <button
          onClick={onClose}
          className="w-full px-3 py-2 rounded text-sm opacity-60 hover:opacity-100 transition-opacity"
        >
          Close
        </button>
      </div>
    </div>
  );
}

function SessionStats({ solves }: { solves: TimerSolve[] }) {
  const stats = useMemo(() => computeSessionStats(solves), [solves]);
  const fmt = (ms: number | null) => (ms !== null ? formatTimerTime(ms) : "-");
  const fmtPct = (v: number | null) => (v !== null ? `${(v * 100).toFixed(1)}%` : "-");
  const fmtSec = (ms: number | null) => (ms !== null ? `${(ms / 1000).toFixed(2)}s` : "-");
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-2 px-3 py-3 border-b border-[var(--border)]">
      <div className="flex flex-col gap-0.5">
        <span className="opacity-50 text-center text-xs">Best (PB)</span>
        <span className="font-mono text-base text-center text-green-400 font-bold">{fmt(stats.best)}</span>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="opacity-50 text-center text-xs">Mean</span>
        <span className="font-mono text-base text-center">{fmt(stats.mean)}</span>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="opacity-50 text-center text-xs">Median</span>
        <span className="font-mono text-base text-center">{fmt(stats.med)}</span>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="opacity-50 text-center text-xs">Std Dev</span>
        <span className="font-mono text-base text-center">{fmtSec(stats.stdDev)}</span>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="opacity-50 text-center text-xs">rCV (MAD)</span>
        <span className="font-mono text-base text-center">{fmtPct(stats.rCv)}</span>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="opacity-50 text-center text-xs">IQR</span>
        <span className="font-mono text-base text-center">{fmtPct(stats.iqr)}</span>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="opacity-50 text-center text-xs">Mo3 / Best</span>
        <span className="font-mono text-base text-center">
          {fmt(stats.currentMo3)} <span className="text-xs text-amber-400 font-normal">/ {fmt(stats.bestMo3)}</span>
        </span>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="opacity-50 text-center text-xs">Ao5 / Best</span>
        <span className="font-mono text-base text-center">
          {fmt(stats.currentAo5)} <span className="text-xs text-blue-400 font-normal">/ {fmt(stats.bestAo5)}</span>
        </span>
      </div>
      <div className="flex flex-col gap-0.5">
        <span className="opacity-50 text-center text-xs">Ao12 / Best</span>
        <span className="font-mono text-base text-center">
          {fmt(stats.currentAo12)} <span className="text-xs text-purple-400 font-normal">/ {fmt(stats.bestAo12)}</span>
        </span>
      </div>
      {(stats.currentAo50 !== null || stats.bestAo50 !== null) && (
        <div className="flex flex-col gap-0.5">
          <span className="opacity-50 text-center text-xs">Ao50 / Best</span>
          <span className="font-mono text-base text-center">
            {fmt(stats.currentAo50)} <span className="text-xs text-emerald-400 font-normal">/ {fmt(stats.bestAo50)}</span>
          </span>
        </div>
      )}
      {(stats.currentAo100 !== null || stats.bestAo100 !== null) && (
        <div className="flex flex-col gap-0.5">
          <span className="opacity-50 text-center text-xs">Ao100 / Best</span>
          <span className="font-mono text-base text-center">
            {fmt(stats.currentAo100)} <span className="text-xs text-teal-400 font-normal">/ {fmt(stats.bestAo100)}</span>
          </span>
        </div>
      )}
    </div>
  );
}

export function SessionSidebar() {
  const {
    sessions,
    activeSession,
    switchSession,
    createSession,
    deleteSession,
    renameSession,
    deleteSolve,
    updateSolve,
    addSolve,
    restoreSolve,
  } = useSession();

  const [showPicker, setShowPicker] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; onUndo?: () => void } | null>(null);
  const [selectedSolveId, setSelectedSolveId] = useState<string | null>(null);
  const selectedSolve = selectedSolveId
    ? activeSession?.solves.find((s) => s.id === selectedSolveId) ?? null
    : null;
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const { mobileOpen, setMobileOpen } = useMenu();

  const handleUndoDelete = (solve: TimerSolve) => {
    setToast({
      message: "Solve deleted",
      onUndo: () => {
        if (!activeSession) return;
        restoreSolve(activeSession.id, {
          timeMs: solve.timeMs,
          dnf: solve.dnf,
          penalty: solve.penalty,
          scramble: solve.scramble,
          dateSec: solve.dateSec,
        });
      },
    });
  };

  const handleDeleteSession = (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;
    deleteSession(sessionId);
    setConfirmDeleteId(null);
    setToast({
      message: `Session "${session.name}" deleted`,
    });
  };

  const sidebar = (
    <div className="w-64 h-full bg-[var(--surface)] border-r border-[var(--border)] flex flex-col">
      {/* Dropdown button */}
      <div className="p-3 border-b border-[var(--border)]">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex-1 flex items-center justify-between px-3 py-2 rounded-md bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--amber)] transition-colors text-sm font-medium min-w-0"
          >
            <span className="truncate">
              {activeSession
                ? `${activeSession.name} - ${activeSession.puzzleType}`
                : "No session"}
            </span>
            <svg
              className={`w-4 h-4 ml-2 shrink-0 transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {activeSession && (
            <button
              onClick={() => {
                setRenamingId(activeSession.id);
                setRenameValue(activeSession.name);
              }}
              className="ml-1.5 p-1.5 rounded opacity-40 hover:opacity-80 transition-opacity shrink-0"
              title="Rename session"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          )}
          <button
            onClick={() => setShowPicker(true)}
            className="ml-1.5 text-xs px-2 py-1.5 rounded bg-primary/20 hover:bg-primary/30 transition-colors shrink-0"
          >
            +
          </button>
        </div>

        {/* Rename input */}
        {renamingId && (
          <div className="mb-2">
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && renameValue.trim()) {
                  renameSession(renamingId, renameValue.trim());
                  setRenamingId(null);
                } else if (e.key === "Escape") {
                  setRenamingId(null);
                }
              }}
              onBlur={() => {
                if (renameValue.trim()) {
                  renameSession(renamingId, renameValue.trim());
                }
                setRenamingId(null);
              }}
              className="w-full px-3 py-1.5 rounded-md bg-[var(--surface)] border border-[var(--amber)] text-sm outline-none"
            />
          </div>
        )}

        {/* Dropdown menu */}
        {dropdownOpen && (
          <div className="mt-1 bg-[var(--surface-2)] border border-[var(--border)] rounded-md shadow-lg max-h-48 overflow-y-auto">
            {[...sessions]
              .sort((a, b) => b.createdAt - a.createdAt)
              .map((session) => (
                <div
                  key={session.id}
                  className={`flex items-center group ${
                    session.id === activeSession?.id ? "bg-primary/10" : ""
                  }`}
                >
                  <button
                    onClick={() => {
                      switchSession(session.id);
                      setDropdownOpen(false);
                    }}
                    className="flex-1 px-3 py-2 text-left text-sm hover:bg-[var(--surface-3)] transition-colors flex items-center justify-between min-w-0"
                  >
                    <span className="truncate">{session.name}</span>
                    <span className="text-xs opacity-40 ml-2 shrink-0">
                      {session.puzzleType} - {session.solves.length}
                    </span>
                  </button>
                  {confirmDeleteId === session.id ? (
                    <div className="flex items-center gap-0.5 pr-2 shrink-0">
                      <button
                        onClick={() => handleDeleteSession(session.id)}
                        className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                      >
                        Del
                      </button>
                      <button
                        onClick={() => setConfirmDeleteId(null)}
                        className="text-xs px-1.5 py-0.5 rounded hover:bg-[var(--surface-3)] transition-colors opacity-60"
                      >
                        No
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmDeleteId(session.id)}
                      className="pr-2 pl-1 py-2 opacity-0 group-hover:opacity-40 hover:!opacity-100 transition-opacity shrink-0"
                      title="Delete session"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            {sessions.length === 0 && (
              <div className="px-3 py-2 text-sm opacity-40">No sessions</div>
            )}
          </div>
        )}
      </div>

      {/* Stats bar */}
      {activeSession && activeSession.solves.length > 0 && (
        <div className="shrink-0">
          <SessionStats solves={activeSession.solves} />
        </div>
      )}

      {/* Solve list */}
      <div className="flex-1 overflow-y-auto px-3 py-2">
        {activeSession ? (
          <SolveList
            solves={activeSession.solves}
            onSelectSolve={(s) => setSelectedSolveId(s.id)}
          />
        ) : (
          <div className="text-sm opacity-40 text-center py-8">No session selected</div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Rendered outside the panels: the mobile slide-in's transform would
          make it the containing block for these fixed overlays and clip them. */}
      {showPicker && (
        <NewSessionPicker
          onSelect={(puzzle) => createSession(puzzle)}
          onClose={() => setShowPicker(false)}
        />
      )}

      {selectedSolve && activeSession && (
        <SolveDetailModal
          solve={selectedSolve}
          onClose={() => setSelectedSolveId(null)}
          onUpdate={(patch) => updateSolve(activeSession.id, selectedSolve.id, patch)}
          onDelete={() => deleteSolve(activeSession.id, selectedSolve.id)}
          onUndoDelete={() => handleUndoDelete(selectedSolve)}
        />
      )}

      {toast && (
        <Toast
          message={toast.message}
          onClose={() => setToast(null)}
          action={toast.onUndo ? { label: "Undo", onClick: toast.onUndo } : undefined}
        />
      )}

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Desktop sidebar */}
      <div className="hidden md:block h-full">{sidebar}</div>

      {/* Mobile slide-in */}
      <div
        className={`safe-area-sidebar fixed inset-y-0 left-0 z-30 transition-transform duration-200 md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebar}
      </div>
    </>
  );
}
