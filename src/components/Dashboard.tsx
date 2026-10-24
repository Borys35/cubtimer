"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ParseResult, ParsedSession, PuzzleType } from "@/lib/types";
import { useSession } from "@/components/SessionProvider";
import { convertTimerSessionsToParseResult } from "@/lib/import-export";
import { fmtTime, type BucketMode, type RangeKey } from "@/lib/stats";
import { bandFromMs, levelWeights, pctPerWeek } from "@/lib/stats";
import {
  computeDashboardModel,
  effectiveTypeOf,
  pickDefaultType,
} from "@/lib/model";
import {
  readChartPalette,
  type ChartPalette,
} from "@/lib/theme";
import { ROLLING_WINDOW } from "@/lib/chartData";
import ScoreboardHero from "@/components/ScoreboardHero";
import AnalyticsViews from "@/components/AnalyticsViews";

const PUZZLE_TYPES: PuzzleType[] = [
  "2x2",
  "3x3",
  "4x4",
  "5x5",
  "6x6",
  "7x7",
  "Pyraminx",
  "Megaminx",
  "Skewb",
  "Square-1",
  "Clock",
  "Unknown",
];

const AXIS_PANEL: Record<string, string> = {
  Improvement: "panel-red",
  Consistency: "panel-blue",
  Frequency: "panel-yellow",
};

function cvColor(cv: number | undefined, palette: ChartPalette): string {
  if (cv == null) return palette.raw;
  if (cv < 0.08) return "var(--cube-green)";
  if (cv < 0.12) return "var(--cube-yellow)";
  if (cv < 0.18) return "var(--cube-orange)";
  return "var(--cube-red)";
}

function sessionDot(props: {
  cx?: number;
  cy?: number;
  payload?: Record<string, unknown>;
  palette: ChartPalette;
}) {
  const { cx, cy, payload, palette } = props;
  if (cx == null || cy == null || payload == null) return null;
  const count = (payload.sessionCount as number) ?? 1;
  const r = Math.min(Math.max(3, Math.sqrt(count) * 1.2), 11);
  const fill = cvColor(payload.sessionCv as number | undefined, palette);
  const isPb = payload.sessionIsPbMean === true;
  return (
    <g>
      <circle cx={cx} cy={cy} r={r + 2} fill="none" stroke={fill} strokeWidth={isPb ? 2.5 : 0} opacity={0.9} />
      <circle cx={cx} cy={cy} r={r} fill={fill} fillOpacity={0.75} stroke={palette.grid} strokeWidth={0.5} />
    </g>
  );
}

function SessionTooltip(props: {
  active?: boolean;
  payload?: Array<{ payload: Record<string, unknown> }>;
  palette: ChartPalette | null;
}) {
  const { active, payload, palette } = props;
  if (!active || !payload || !palette) return null;
  const d = payload[0]?.payload;
  if (!d) return null;

  const t = d.t as number;
  const mean = d.sessionMean as number | undefined;
  const trend = d.trend as number | undefined;
  const proj = d.proj as number | undefined;

  const isSession = mean != null;
  const isTrend = !isSession && (trend != null || proj != null);

  if (isTrend) {
    const value = proj ?? trend;
    const label = proj != null ? "Projected" : "Trend";
    return (
      <div
        className="rounded-lg border px-3 py-2 text-xs leading-relaxed shadow-lg"
        style={{ background: palette.tooltipBg, borderColor: palette.grid, color: palette.tick }}
      >
        <div className="mb-1 font-semibold">
          {new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "2-digit", timeZone: "UTC" }).format(t)}
        </div>
        <div>
          {label}: <span className="font-mono font-semibold">{fmtTime(value!)}</span>
        </div>
      </div>
    );
  }

  if (!isSession) return null;

  const std = d.sessionStd as number | undefined;
  const cv = d.sessionCv as number | undefined;
  const count = d.sessionCount as number | undefined;
  const dnf = d.sessionDnf as number | undefined;
  const best = d.sessionBest as number | undefined;
  const bestAo5 = d.sessionBestAo5 as number | undefined;
  const bestAo12 = d.sessionBestAo12 as number | undefined;
  const name = d.sessionName as string | undefined;
  const isPbMean = d.sessionIsPbMean === true;
  const isPbSingle = d.sessionIsPbSingle === true;
  const rank = d.sessionRank as number | undefined;
  const delta = d.sessionDeltaPct as number | undefined;

  const deltaText =
    delta != null
      ? delta < -2
        ? `${Math.abs(delta).toFixed(1)}% faster than avg`
        : delta > 2
          ? `${delta.toFixed(1)}% slower than avg`
          : "near your average"
      : null;

  const rankLabel =
    rank != null
      ? rank === 1
        ? "Best session"
        : rank <= 3
          ? `Top ${rank} session`
          : `Rank #${rank}`
      : null;

  return (
    <div
      className="rounded-lg border px-3 py-2.5 text-xs leading-relaxed shadow-lg"
      style={{
        background: palette.tooltipBg,
        borderColor: palette.grid,
        color: palette.tick,
      }}
    >
      <div className="mb-1.5 font-semibold">
        {name || "Session"}{" "}
        <span className="font-normal opacity-60">
          {new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "2-digit", timeZone: "UTC" }).format(t)}
        </span>
      </div>
      <div className="space-y-0.5">
        <div>
          Mean: <span className="font-mono">{fmtTime(mean!)}</span>
          {isPbMean && <span className="ml-1.5 rounded bg-green-500/20 px-1 py-0.5 text-[10px] font-medium text-green-400">PB</span>}
        </div>
        <div>
          Best single: <span className="font-mono">{best != null ? fmtTime(best) : "-"}</span>
          {isPbSingle && <span className="ml-1.5 rounded bg-green-500/20 px-1 py-0.5 text-[10px] font-medium text-green-400">PB</span>}
        </div>
        {bestAo5 != null && (
          <div>Best ao5: <span className="font-mono">{fmtTime(bestAo5)}</span></div>
        )}
        {bestAo12 != null && (
          <div>Best ao12: <span className="font-mono">{fmtTime(bestAo12)}</span></div>
        )}
        <div className="mt-1 border-t border-white/10 pt-1">
          Solves: {count}{dnf != null && dnf > 0 ? ` (${dnf} DNF)` : ""}
        </div>
        {std != null && (
          <div>Std dev: <span className="font-mono">{fmtTime(std)}</span></div>
        )}
        {cv != null && (
          <div>CV: <span className="font-mono">{(cv * 100).toFixed(1)}%</span></div>
        )}
      </div>
      {(rankLabel || deltaText) && (
        <div className="mt-1.5 border-t border-white/10 pt-1">
          {rankLabel && <div className="font-medium">{rankLabel}</div>}
          {deltaText && <div className="opacity-70">{deltaText}</div>}
        </div>
      )}
    </div>
  );
}

type SeriesKey = "sessions" | "rolling" | "trend" | "volume";

const SERIES_STORAGE_KEY = "cta-chart-series";
const DEFAULT_SERIES: Record<SeriesKey, boolean> = {
  sessions: true,
  rolling: false,
  trend: true,
  volume: false,
};

function loadSeries(): Record<SeriesKey, boolean> {
  try {
    const raw = localStorage.getItem(SERIES_STORAGE_KEY);
    if (raw) return { ...DEFAULT_SERIES, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_SERIES;
}

function saveSeries(series: Record<SeriesKey, boolean>) {
  try {
    localStorage.setItem(SERIES_STORAGE_KEY, JSON.stringify(series));
  } catch {}
}

function fmtDay(ms: number): string {
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" }).format(ms);
}

export default function Dashboard() {
  const { sessions } = useSession();
  const [overrides, setOverrides] = useState<Record<string, PuzzleType>>({});
  const [selectedType, setSelectedType] = useState<string>("3x3");
  const [range, setRange] = useState<RangeKey>("all");
  const [bucket, setBucket] = useState<BucketMode>("week");
  const [horizon, setHorizon] = useState(4);
  const [palette, setPalette] = useState<ChartPalette | null>(null);
  const [series, setSeries] = useState<Record<SeriesKey, boolean>>(DEFAULT_SERIES);

  const data: ParseResult | null = useMemo(() => {
    // The timer always keeps one (possibly empty) session, so "nothing to show" means no solves.
    if (!sessions.some((s) => s.solves.length > 0)) return null;
    return convertTimerSessionsToParseResult(sessions);
  }, [sessions]);

  useEffect(() => {
    setPalette(readChartPalette());
    setSeries(loadSeries());
  }, []);

  const toggleSeries = (key: SeriesKey) => {
    setSeries((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveSeries(next);
      return next;
    });
  };

  const effectiveType = useCallback(
    (s: ParsedSession): PuzzleType => effectiveTypeOf(s, overrides),
    [overrides],
  );

  const derived = useMemo(() => {
    if (!data) return null;
    return computeDashboardModel(data, { overrides, selectedType, range, bucket, horizonWeeks: horizon });
  }, [data, overrides, selectedType, range, bucket, horizon]);

  const weightStrings = useMemo(() => {
    if (!derived?.analysis.currentLevelMs) return { improvement: "40%", consistency: "30%", frequency: "30%" };
    const w = levelWeights(derived.analysis.currentLevelMs);
    return {
      improvement: `${Math.round(w.i * 100)}%`,
      consistency: `${Math.round(w.c * 100)}%`,
      frequency: `${Math.round(w.f * 100)}%`,
    };
  }, [derived?.analysis.currentLevelMs]);

  if (!data) {
    return (
      <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-6">
        <h1 className="mb-2 text-center font-sans text-4xl font-bold tracking-tight sm:text-5xl">
          CubTimer
        </h1>
        <p className="max-w-sm text-center text-sm text-[var(--text-dim)]">
          No solves yet. Start solving in the Timer tab, or import a csTimer export in Settings, to see your stats here.
        </p>
      </main>
    );
  }

  const d = derived!;
  const a = d.analysis;

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      {/* Header */}
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-sans text-xl font-bold tracking-tight">
            CubTimer{" "}
            <span className="bg-gradient-to-r from-[var(--amber)] via-[var(--cube-yellow)] to-[var(--amber)] bg-clip-text text-transparent">
              analyzer
            </span>
          </h1>
          <p className="text-xs text-[var(--text-faint)]">
            {sessions.length} session{sessions.length !== 1 ? "s" : ""} - everything analyzed locally in your browser
          </p>
        </div>
      </header>

      {/* Filters */}
      <section className="mb-5 flex flex-wrap items-end gap-3">
        {[
          { label: "Event", value: selectedType, set: setSelectedType, options: d.typeOptions.map((t) => ({ v: t.label, l: `${t.label} (${t.count} solves)` })) },
          { label: "Range", value: range, set: (v: string) => setRange(v as RangeKey), options: [{ v: "all", l: "All time" }, { v: "90", l: "Last 90 days" }, { v: "30", l: "Last 30 days" }, { v: "7", l: "Last 7 days" }] },
          { label: "Buckets", value: bucket, set: (v: string) => setBucket(v as BucketMode), options: [{ v: "day", l: "Daily" }, { v: "week", l: "Weekly" }] },
          { label: "Horizon", value: String(horizon), set: (v: string) => setHorizon(Number(v)), options: [{ v: "1", l: "+1 week" }, { v: "2", l: "+2 weeks" }, { v: "4", l: "+4 weeks" }, { v: "8", l: "+8 weeks" }] },
        ].map((sel) => (
          <label key={sel.label} className="flex flex-col gap-0.5 text-[11px] text-[var(--text-faint)]">
            {sel.label}
            <select
              className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1.5 text-xs text-[var(--text)]"
              value={sel.value}
              onChange={(e) => sel.set(e.target.value)}
            >
              {sel.options.map((o) => (
                <option key={o.v} value={o.v}>{o.l}</option>
              ))}
            </select>
          </label>
        ))}
      </section>

      {/* Scoreboard Hero */}
      <section className="mb-5">
        <ScoreboardHero
          headline={a.headline}
          tier={a.tier}
          subscores={a.subscores}
          weights={weightStrings}
          trendLabel={
            a.trend && a.currentLevelMs
              ? (() => {
                  const pct = pctPerWeek(a.trend, a.currentLevelMs);
                  if (pct >= 0) return "flat or worsening";
                  return `${Math.abs(pct).toFixed(1)}%/week`;
                })()
              : null
          }
        />
      </section>

      {/* Quick stats */}
      <section className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {[
          ["Solves in range", String(d.clean.length)],
          ["DNFs", String(d.dnfInRange)],
          ["Abandoned", String(d.junkCount)],
          ["Current level", a.currentLevelMs != null ? fmtTime(a.currentLevelMs) : "-"],
          ["Best single", d.bestSingleMs != null ? fmtTime(d.bestSingleMs) : "-"],
          ["Active days", `${a.freq.activeDays}/14 @ ${a.freq.solvesPerActiveDay.toFixed(0)}/d`],
        ].map(([k, v], i) => (
          <div
            key={k}
            className="stat-chip p-2.5 pl-3.5"
            style={{ "--chip": `var(--chip${i + 1})`, "--chip-ink": `var(--ink${i + 1})` } as React.CSSProperties}
          >
            <div className="chip-label text-[10px] uppercase tracking-wide text-[var(--text-faint)]">{k}</div>
            <div className="mt-0.5 font-mono text-base text-[var(--text)]" style={{color: i == 5 ? "var(--bg)" : ""}}>{v}</div>
          </div>
        ))}
      </section>

      {/* Chart */}
      <section className="card mb-5 overflow-hidden p-0">
        <div className="p-4">
          {palette && (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Chart series">
                {(
                  [
                    { key: "sessions", label: "Sessions", color: "var(--cube-green)" },
                    { key: "rolling", label: `${ROLLING_WINDOW}-session avg`, color: palette.ao12 },
                    { key: "trend", label: "Trend + projection", color: palette.trend },
                    { key: "volume", label: "Volume", color: palette.tick },
                  ] as const
                ).map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    aria-pressed={series[s.key]}
                    onClick={() => toggleSeries(s.key)}
                    className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                      series[s.key]
                        ? "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)]"
                        : "border-transparent text-[var(--text-faint)] hover:text-[var(--text-dim)]"
                    }`}
                  >
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: s.color, opacity: series[s.key] ? 1 : 0.35 }}
                    />
                    {s.label}
                  </button>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={360}>
                <ComposedChart data={d.chartRows} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                  <CartesianGrid stroke={palette.grid} vertical={false} />
                  <XAxis
                    dataKey="t"
                    type="number"
                    scale="time"
                    domain={["dataMin", "dataMax"]}
                    tickFormatter={fmtDay}
                    stroke={palette.tick}
                    fontSize={11}
                  />
                  <YAxis
                    yAxisId="time"
                    domain={["auto", "auto"]}
                    tickFormatter={(ms: number) => fmtTime(ms)}
                    stroke={palette.tick}
                    fontSize={11}
                    width={64}
                  />
                  <YAxis yAxisId="vol" orientation="right" stroke={palette.volume} fontSize={11} width={32} hide={!series.volume} />
                  <Tooltip content={<SessionTooltip palette={palette} />} />
                  {series.volume && (
                    <Bar yAxisId="vol" dataKey="vol" name="Solves" fill={palette.volume} opacity={0.5} barSize={14} />
                  )}
                  {series.sessions && (
                    <Scatter yAxisId="time" dataKey="sessionMean" name="Session" fill={palette.raw} shape={(props: any) => sessionDot({ ...props, palette })} />
                  )}
                  {series.rolling && (
                    <Line yAxisId="time" type="monotone" dataKey="rolling" name={`${ROLLING_WINDOW}-session avg`} stroke={palette.ao12} dot={false} strokeWidth={2} connectNulls />
                  )}
                  {series.trend && (
                    <Line yAxisId="time" type="linear" dataKey="trend" name="Trend" stroke={palette.trend} dot={false} strokeWidth={2} connectNulls />
                  )}
                  {series.trend && (
                    <Line
                      yAxisId="time"
                      type="linear"
                      dataKey="proj"
                      name="Projection"
                      stroke={palette.proj}
                      strokeDasharray="6 4"
                      dot={false}
                      strokeWidth={2}
                      connectNulls
                    />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </>
          )}
          <p className="mt-1 text-center text-[11px] text-[var(--text-faint)]">
            each dot is a session - bigger = more solves, greener = more consistent
          </p>
        </div>
      </section>

      {/* Verdict + projection */}
      <section className="mb-5">
        <div className="card p-4">
          {a.tier && <span className={`tier-pill tier-pill-${a.tier}`}>{d.report.verdictTitle.split(".")[0]}</span>}
          <p className="mt-2.5 text-sm leading-relaxed text-[var(--text-dim)]">{d.report.verdictText}</p>
          {d.projSentence && (
            <p className="mt-3 rounded border border-[var(--border)] bg-[var(--surface-2)] p-3 text-xs leading-relaxed text-[var(--text-dim)]">
              {d.projSentence}
            </p>
          )}
        </div>
      </section>

      {/* Analytics (Histogram, Time of Day, Session Comparison) */}
      <AnalyticsViews cleanSolves={d.clean} sessions={data.sessions} puzzleType={selectedType} />

      {/* Prescriptions */}
      <section className="mb-5 space-y-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-faint)]">
          Where you are losing points - worst first
        </h2>
        {d.report.splitHint && (
          <p className="card px-3 py-2 text-xs text-[var(--text-faint)]">{d.report.splitHint}</p>
        )}
        <div className="grid gap-2 lg:grid-cols-2">
          {d.report.focus.map((f, i) => {
            const isWeak = Boolean(f.prescription);
            const axisClass =
              f.area === "Improvement" ? "axis-improvement"
                : f.area === "Consistency" ? "axis-consistency"
                  : f.area === "Frequency" ? "axis-frequency"
                    : "";
            const panelClass = isWeak && AXIS_PANEL[f.area] ? `panel-solid ${AXIS_PANEL[f.area]}` : "";
            return (
              <div
                key={f.area}
                className={`card p-3.5 ${axisClass} ${panelClass} ${isWeak ? "prescription-card" : ""}`}
              >
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span
                    className="text-sm font-semibold"
                    style={!isWeak && f.area !== "Data" ? { color: "var(--axis-text)" } : undefined}
                  >
                    {f.area}
                  </span>
                  {f.score != null && (
                    <span className="font-mono text-xs text-[var(--text-dim)]">{f.score}/100</span>
                  )}
                  {isWeak && i === 0 && (
                    <span className="rounded bg-[var(--amber)]/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--amber)]">
                      weakest
                    </span>
                  )}
                </div>
                <p className={`text-xs leading-relaxed ${isWeak ? "" : "text-[var(--text-dim)]"} panel-muted`}>
                  {f.text}
                </p>
                {f.prescription && (
                  <div className="mt-2.5 space-y-2">
                    <p className="text-xs font-medium text-[var(--text)]">{f.prescription.diagnosis}</p>
                    <ol className="space-y-1.5">
                      {f.prescription.drills.map((drill) => (
                        <li key={drill.name} className="rounded bg-black/15 p-2.5">
                          <div className="text-xs font-semibold text-[var(--text)]">{drill.name}</div>
                          <div className="mt-0.5 text-[11px] leading-relaxed text-[var(--text-dim)]">{drill.why}</div>
                        </li>
                      ))}
                    </ol>
                    {f.prescription.estimate && (
                      <p className="rounded border border-[var(--border)] bg-[var(--surface-2)] p-2.5 text-[11px] leading-relaxed text-[var(--text-dim)]">
                        <span className="font-semibold uppercase tracking-wide text-[var(--text-faint)]">The math: </span>
                        {f.prescription.estimate}
                        <span className="ml-1.5 rounded bg-[var(--surface-3)] px-1.5 py-0.5 text-[9px] uppercase text-[var(--text-faint)]">
                          {f.prescription.leverage} leverage
                        </span>
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Sessions */}
      <details className="card p-3.5 text-sm">
        <summary className="cursor-pointer text-xs text-[var(--text-dim)]">
          Sessions ({data.sessions.length}) - fix auto-detected event types here
        </summary>
        <div className="mt-3 divide-y divide-[var(--border)]">
          {data.sessions.map((s) => (
            <div key={s.meta.key} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
              <span className="min-w-16 font-mono text-[11px] text-[var(--text-faint)]">{s.meta.key}</span>
              <span className="min-w-36 flex-1 truncate text-[11px] text-[var(--text-dim)]">
                {new Intl.DateTimeFormat("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "2-digit",
                  timeZone: "UTC",
                }).format(s.meta.firstDateSec * 1000)}{" "}
                - {s.meta.solveCount} solves
              </span>
              <span className="text-[11px] text-[var(--text-faint)]">{s.typeSource}</span>
              <select
                className="rounded border border-[var(--border)] bg-[var(--surface)] px-1.5 py-1 text-[11px] text-[var(--text)]"
                value={effectiveType(s)}
                onChange={(e) =>
                  setOverrides((o) => ({ ...o, [s.meta.key]: e.target.value as PuzzleType }))
                }
              >
                {PUZZLE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                    {overrides[s.meta.key] === undefined ? ` (auto: ${s.puzzleType})` : ""}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </details>
    </main>
  );
}
