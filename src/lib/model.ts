import type { ParseResult, ParsedSession, PuzzleType, Solve } from "./types";
import {
  analyze,
  bestRollingAverage,
  subXLevel,
  filterByRange,
  separateJunk,
  type BucketMode,
  type RangeKey,
  type ScoredAnalysis,
} from "./stats";
import { analyzeSplits, type SplitStats } from "./splits";
import { buildCoachReport, projectionSentence, type CoachReport } from "./coach";
import { buildChartRows, type ChartRow } from "./chartData";

export interface DashboardModelOpts {
  overrides: Record<string, PuzzleType>;
  selectedType: string;
  range: RangeKey;
  bucket: BucketMode;
  horizonWeeks: number;
  nowMs?: number;
}

export interface TypeOption {
  label: string;
  count: number;
}

export interface DashboardModel {
  typeOptions: TypeOption[];
  mergedCount: number;
  clean: Solve[];
  junkCount: number;
  dnfInRange: number;
  chartRows: ChartRow[];
  analysis: ScoredAnalysis;
  report: CoachReport;
  projSentence: string | null;
  bestSingleMs: number | null;
  /** Best Ao5 / Ao12 over every solve of the selected type, ignoring the range filter. */
  bestAo5Ms: number | null;
  bestAo12Ms: number | null;
  /** Whole-second X of the user's current "sub-X" level; null with too few solves. */
  subX: number | null;
}

export function effectiveTypeOf(
  s: ParsedSession,
  overrides: Record<string, PuzzleType>,
): PuzzleType {
  return overrides[s.meta.key] ?? s.puzzleType;
}

export function pickDefaultType(parsed: ParseResult): string {
  const totals = new Map<string, number>();
  for (const s of parsed.sessions) {
    totals.set(s.puzzleType, (totals.get(s.puzzleType) ?? 0) + s.solves.length);
  }
  let best = "";
  let bestN = -1;
  for (const [t, n] of totals) if (n > bestN) [best, bestN] = [t, n];
  return best;
}

export function computeDashboardModel(
  data: ParseResult,
  opts: DashboardModelOpts,
): DashboardModel {
  const byType = new Map<string, { count: number; sessions: ParsedSession[] }>();
  for (const s of data.sessions) {
    const t = effectiveTypeOf(s, opts.overrides);
    const e = byType.get(t) ?? { count: 0, sessions: [] };
    e.count += s.solves.length;
    e.sessions.push(s);
    byType.set(t, e);
  }
  const typeOptions: TypeOption[] = [...byType.entries()]
    .sort((a, b) => b[1].count - a[1].count)
    .map(([label, v]) => ({ label, count: v.count }));

  const active = byType.get(opts.selectedType)?.sessions ?? [];
  const merged = active.flatMap((s) => s.solves).sort((a, b) => a.dateSec - b.dateSec);
  const rangedAll = filterByRange(merged, opts.range, opts.nowMs);
  const { kept, junk } = separateJunk(rangedAll);
  const clean = kept.filter((s) => !s.dnf);

  const analysis = analyze({
    rangedClean: clean,
    allClean: merged.filter((s) => !s.dnf),
    nowMs: opts.nowMs,
  });
  const lastT = clean.length ? clean[clean.length - 1].dateSec * 1000 : (opts.nowMs ?? Date.now());
  const chartRows = buildChartRows({
    kept,
    clean,
    sessions: active,
    days: analysis.days,
    bucket: opts.bucket,
    trend: analysis.trend,
    horizonWeeks: opts.horizonWeeks,
    lastDateMs: lastT,
  });

  const splits: SplitStats = analyzeSplits(clean, analysis.currentLevelMs ?? 0);
  const report = buildCoachReport({
    analysis,
    last50Times: analysis.lastNTimes,
    splits,
    event: opts.selectedType,
    label: opts.selectedType,
  });
  const projSentence = projectionSentence(analysis, opts.horizonWeeks);

  // All-time figures: independent of the range filter. Averages never span sessions.
  const bestAoAllTime = (n: number) => {
    const bests = active
      .map((s) => bestRollingAverage(s.solves, n))
      .filter((v): v is number => v !== null);
    return bests.length ? Math.min(...bests) : null;
  };
  const allTimeClean = separateJunk(merged).kept.filter((s) => !s.dnf);

  return {
    typeOptions,
    mergedCount: merged.length,
    clean,
    junkCount: junk.length,
    dnfInRange: kept.length - clean.length,
    chartRows,
    analysis,
    report,
    projSentence,
    bestSingleMs: clean.length ? Math.min(...clean.map((s) => s.timeMs)) : null,
    bestAo5Ms: bestAoAllTime(5),
    bestAo12Ms: bestAoAllTime(12),
    subX: subXLevel(allTimeClean.map((s) => s.timeMs)),
  };
}
