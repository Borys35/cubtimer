import type { Solve } from "./types";

export type RangeKey = "all" | "7" | "30" | "90";
export type BucketMode = "day" | "week";

export const RANGE_MS: Record<Exclude<RangeKey, "all">, number> = {
  "7": 7 * 86400_000,
  "30": 30 * 86400_000,
  "90": 90 * 86400_000,
};

export function filterByRange(solves: Solve[], range: RangeKey, nowMs = Date.now()): Solve[] {
  if (range === "all") return solves;
  const cutoff = nowMs - RANGE_MS[range];
  return solves.filter((s) => s.dateSec * 1000 >= cutoff);
}

export interface JunkSplit {
  kept: Solve[];
  junk: Solve[];
}

export function separateJunk(solves: Solve[]): JunkSplit {
  const clean = solves.filter((s) => !s.dnf);
  if (clean.length < 5) return { kept: solves, junk: [] };
  const sorted = [...clean.map((s) => s.timeMs)].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const cap = Math.max(Math.min(median * 10, 300_000), 30_000);
  const isJunk = (s: Solve) => s.timeMs > cap;
  return {
    kept: solves.filter((s) => !isJunk(s)),
    junk: solves.filter(isJunk),
  };
}

export function rollingAverage(solves: Solve[], n: number): { t: number; ms: number }[] {
  const out: { t: number; ms: number }[] = [];
  for (let i = 0; i < solves.length; i++) {
    if (i < n - 1) continue;
    const window = solves.slice(i - n + 1, i + 1);
    const dnfs = window.filter((s) => s.dnf).length;
    if (dnfs > 1) {
      out.push({ t: solves[i].dateSec * 1000, ms: Infinity });
      continue;
    }
    const times = window
      .filter((s) => !s.dnf)
      .map((s) => s.timeMs);
    times.sort((a, b) => a - b);
    times.shift();
    times.pop();
    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    out.push({ t: solves[i].dateSec * 1000, ms: mean });
  }
  return out;
}

export function rollingMean(solves: Solve[], n: number): { t: number; ms: number }[] {
  const out: { t: number; ms: number }[] = [];
  for (let i = 0; i < solves.length; i++) {
    if (i < n - 1) continue;
    const window = solves.slice(i - n + 1, i + 1);
    const hasDnf = window.some((s) => s.dnf);
    if (hasDnf) {
      out.push({ t: solves[i].dateSec * 1000, ms: Infinity });
      continue;
    }
    const mean = window.reduce((a, b) => a + b.timeMs, 0) / n;
    out.push({ t: solves[i].dateSec * 1000, ms: mean });
  }
  return out;
}

export interface DayBucket {
  dayStartMs: number;
  meanMs: number;
  count: number;
}

export function dailyBuckets(solves: Solve[]): DayBucket[] {
  const map = new Map<number, { total: number; count: number }>();
  for (const s of solves) {
    if (s.dnf) continue;
    const d = new Date(s.dateSec * 1000);
    const key = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    const e = map.get(key);
    if (e) {
      e.total += s.timeMs;
      e.count++;
    } else {
      map.set(key, { total: s.timeMs, count: 1 });
    }
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([dayStartMs, e]) => ({ dayStartMs, meanMs: e.total / e.count, count: e.count }));
}

export interface WeekBucket {
  weekStartMs: number;
  meanMs: number;
  count: number;
}

function startOfUTCWeek(ms: number): number {
  const d = new Date(ms);
  const day = (d.getUTCDay() + 6) % 7;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day);
}

export function weeklyBuckets(solves: Solve[]): WeekBucket[] {
  const map = new Map<number, { total: number; count: number }>();
  for (const s of solves) {
    if (s.dnf) continue;
    const key = startOfUTCWeek(s.dateSec * 1000);
    const e = map.get(key);
    if (e) {
      e.total += s.timeMs;
      e.count++;
    } else {
      map.set(key, { total: s.timeMs, count: 1 });
    }
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([weekStartMs, e]) => ({ weekStartMs, meanMs: e.total / e.count, count: e.count }));
}

export interface TrendFit {
  slopeMsPerDay: number;
  interceptMs: number;
  endLevelMs: number;
  weeksCovered: number;
}

export function fitDailyTrend(days: DayBucket[]): TrendFit | null {
  if (days.length < 4) return null;
  const t0 = days[0].dayStartMs;
  let sw = 0,
    sx = 0,
    sy = 0,
    sxx = 0,
    sxy = 0;
  for (const d of days) {
    const x = (d.dayStartMs - t0) / 86400_000;
    const w = d.count;
    sw += w;
    sx += w * x;
    sy += w * d.meanMs;
    sxx += w * x * x;
    sxy += w * x * d.meanMs;
  }
  const denom = sw * sxx - sx * sx;
  if (denom <= 0) return null;
  const slope = (sw * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / sw;
  const lastX = (days[days.length - 1].dayStartMs - t0) / 86400_000;
  const weeksCovered = lastX / 7;
  return {
    slopeMsPerDay: slope,
    interceptMs: intercept,
    endLevelMs: intercept + slope * lastX,
    weeksCovered,
  };
}

function piecewise(x: number, anchors: [number, number][]): number {
  if (x <= anchors[0][0]) return anchors[0][1];
  const last = anchors[anchors.length - 1];
  if (x >= last[0]) return last[1];
  for (let i = 0; i < anchors.length - 1; i++) {
    const [x0, y0] = anchors[i];
    const [x1, y1] = anchors[i + 1];
    if (x <= x1) return Math.round(y0 + ((x - x0) / (x1 - x0)) * (y1 - y0));
  }
  return last[1];
}

export type LevelBand = "sub-60" | "sub-40" | "sub-25" | "sub-15" | "sub-10";

export function bandFromMs(ms: number): LevelBand {
  if (ms >= 60000) return "sub-60";
  if (ms >= 40000) return "sub-40";
  if (ms >= 25000) return "sub-25";
  if (ms >= 15000) return "sub-15";
  return "sub-10";
}

export const LEVEL_IMPROVEMENT_ANCHORS: Record<LevelBand, [number, number][]> = {
  "sub-60": [
    [-5, 0],
    [-0.5, 10],
    [0, 22],
    [0.5, 35],
    [1.0, 50],
    [1.5, 65],
    [2.0, 80],
    [3.0, 95],
  ],
  "sub-40": [
    [-5, 0],
    [-0.5, 10],
    [0, 22],
    [0.3, 35],
    [0.6, 50],
    [0.9, 65],
    [1.2, 80],
    [2.0, 95],
  ],
  "sub-25": [
    [-5, 0],
    [-0.5, 10],
    [0, 22],
    [0.15, 35],
    [0.3, 50],
    [0.4, 65],
    [0.5, 80],
    [1.0, 95],
  ],
  "sub-15": [
    [-5, 0],
    [-0.5, 10],
    [0, 22],
    [0.07, 35],
    [0.15, 50],
    [0.22, 65],
    [0.30, 80],
    [0.6, 95],
  ],
  "sub-10": [
    [-5, 0],
    [-0.5, 10],
    [0, 22],
    [0.02, 35],
    [0.05, 50],
    [0.10, 65],
    [0.15, 80],
    [0.3, 95],
  ],
};

export function improvementScore(trend: TrendFit | null, currentLevelMs: number): number | null {
  if (!trend || trend.weeksCovered < 2 || currentLevelMs <= 0) return null;
  const pctPerWeek = (-trend.slopeMsPerDay * 7 * 100) / currentLevelMs;
  const band = bandFromMs(currentLevelMs);
  const anchors = LEVEL_IMPROVEMENT_ANCHORS[band];
  return piecewise(pctPerWeek, anchors);
}

export function median(times: number[]): number | null {
  if (times.length === 0) return null;
  const sorted = [...times].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

export function medianAbsoluteDeviation(times: number[]): number | null {
  const med = median(times);
  if (med === null) return null;
  return median(times.map((t) => Math.abs(t - med)));
}

export function madCv(times: number[]): number | null {
  const med = median(times);
  const mad = medianAbsoluteDeviation(times);
  if (med === null || mad === null || med === 0) return null;
  return (1.4826 * mad) / med;
}

export function iqrCv(times: number[]): number | null {
  const med = median(times);
  if (med === null || med === 0) return null;
  const sorted = [...times].sort((a, b) => a - b);
  const q = (p: number) => {
    const idx = (sorted.length - 1) * p;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  };
  return (q(0.75) - q(0.25)) / med;
}

export function consistencyScore(last50: number[]): number | null {
  if (last50.length < 10) return null;
  const cv = madCv(last50);
  if (cv === null) return null;
  return piecewise(cv, [
    [0.04, 100],
    [0.07, 90],
    [0.09, 75],
    [0.12, 55],
    [0.15, 40],
    [0.25, 20],
    [0.45, 0],
  ]);
}

export interface FrequencyResult {
  activeDays: number;
  solvesPerActiveDay: number;
}

export function frequencyStats(allSolvesOfType: Solve[], nowMs = Date.now()): FrequencyResult {
  const cutoff = nowMs - 14 * 86400_000;
  const daySet = new Set<number>();
  let count = 0;
  for (const s of allSolvesOfType) {
    if (s.dateSec * 1000 < cutoff) continue;
    daySet.add(Math.floor(s.dateSec / 86400));
    count++;
  }
  const activeDays = daySet.size;
  return {
    activeDays,
    solvesPerActiveDay: activeDays > 0 ? count / activeDays : 0,
  };
}

export function frequencyScore(f: FrequencyResult): number {
  const dayPart = piecewise(f.activeDays, [
    [0, 0],
    [2, 20],
    [5, 50],
    [7, 70],
    [10, 82],
    [12, 90],
    [14, 100],
  ]);
  const volPart = piecewise(f.solvesPerActiveDay, [
    [0, 0],
    [10, 30],
    [20, 60],
    [50, 90],
    [100, 100],
    [200, 100],
  ]);
  return Math.round(dayPart * 0.7 + volPart * 0.3);
}

export interface SubScores {
  improvement: number | null;
  consistency: number | null;
  frequency: number;
}

export interface ScoredAnalysis {
  subscores: SubScores;
  headline: number | null;
  tier: "good" | "decent" | "bad" | "horrible" | null;
  currentLevelMs: number | null;
  trend: TrendFit | null;
  consistencyCv: number | null;
  freq: FrequencyResult;
  lastNTimes: number[];
  days: DayBucket[];
}


const LEVEL_WEIGHTS: Record<LevelBand, { i: number; c: number; f: number }> = {
  "sub-60": { i: 0.45, c: 0.15, f: 0.40 },
  "sub-40": { i: 0.40, c: 0.25, f: 0.35 },
  "sub-25": { i: 0.35, c: 0.35, f: 0.30 },
  "sub-15": { i: 0.30, c: 0.40, f: 0.30 },
  "sub-10": { i: 0.25, c: 0.45, f: 0.30 },
};

export function levelWeights(levelMs: number): { i: number; c: number; f: number } {
  return LEVEL_WEIGHTS[bandFromMs(levelMs)];
}

export function tierFor(score: number): ScoredAnalysis["tier"] {
  if (score >= 80) return "good";
  if (score >= 60) return "decent";
  if (score >= 40) return "bad";
  return "horrible";
}

export interface AnalyzeInput {
  rangedClean: Solve[];
  allClean: Solve[];
  nowMs?: number;
}

export const LAST_N = 50;

export function pctPerWeek(trend: TrendFit, currentLevelMs: number): number {
  return (-trend.slopeMsPerDay * 7 * 100) / currentLevelMs;
}

export function analyze(input: AnalyzeInput): ScoredAnalysis {
  const { rangedClean, allClean } = input;
  const days = dailyBuckets(rangedClean);
  const trend = fitDailyTrend(days);

  const lastN = rangedClean.slice(-LAST_N).map((s) => s.timeMs);
  const currentLevelMs =
    lastN.length > 0 ? lastN.reduce((a, b) => a + b, 0) / lastN.length : null;

  const improvement = improvementScore(trend, currentLevelMs ?? 0);
  const consistency = consistencyScore(lastN);
  const freq = frequencyStats(allClean, input.nowMs ?? Date.now());
  const frequency = frequencyScore(freq);

  if (rangedClean.length === 0) {
    return {
      subscores: { improvement: null, consistency: null, frequency },
      headline: null,
      tier: null,
      currentLevelMs,
      trend,
      consistencyCv: null,
      freq,
      lastNTimes: lastN,
      days,
    };
  }

  let headline: number | null = null;
  const w = currentLevelMs != null ? levelWeights(currentLevelMs) : { i: 0.35, c: 0.35, f: 0.30 };
  let tw = w.i * (improvement != null ? 1 : 0);
  let cw = w.c * (consistency != null ? 1 : 0);
  let fw = w.f;
  const totalW = tw + cw + fw;
  if (totalW > 0) {
    const acc =
      (improvement ?? 0) * tw +
      (consistency ?? 0) * cw +
      frequency * fw;
    headline = Math.round(acc / totalW);
  }

  return {
    subscores: { improvement, consistency, frequency },
    headline,
    tier: headline != null ? tierFor(headline) : null,
    currentLevelMs,
    trend,
    consistencyCv: lastN.length >= 10 ? madCv(lastN) : null,
    freq,
    lastNTimes: lastN,
    days,
  };
}

export interface ProjectionPoint {
  t: number;
  ms: number;
}

export function trendPoints(trend: TrendFit | null, days: DayBucket[]): ProjectionPoint[] {
  if (!trend || days.length === 0) return [];
  const t0 = days[0].dayStartMs;
  const tEnd = days[days.length - 1].dayStartMs;
  const pts: ProjectionPoint[] = [];
  const steps = 40;
  for (let i = 0; i <= steps; i++) {
    const t = t0 + ((tEnd - t0) / steps) * i;
    const x = (t - t0) / 86400_000;
    pts.push({ t, ms: trend.interceptMs + trend.slopeMsPerDay * x });
  }
  return pts;
}

export function projectForward(
  trend: TrendFit | null,
  lastDateMs: number,
  horizonWeeks: number,
): ProjectionPoint[] {
  if (!trend || trend.weeksCovered < 2) return [];
  const pts: ProjectionPoint[] = [];
  const steps = 12;
  for (let i = 0; i <= steps; i++) {
    const t = lastDateMs + (i / steps) * horizonWeeks * 7 * 86400_000;
    const ms = trend.endLevelMs + trend.slopeMsPerDay * ((i / steps) * horizonWeeks * 7);
    pts.push({ t, ms: Math.max(ms, 500) });
  }
  return pts;
}

export function fmtTime(ms: number): string {
  if (ms >= 60000) {
    const m = Math.floor(ms / 60000);
    const s = (ms % 60000) / 1000;
    return `${m}:${s.toFixed(2).padStart(5, "0")}`;
  }
  return `${(ms / 1000).toFixed(2)}`;
}

export interface PersonalBests {
  single: number | null;
  mo3: number | null;
  ao5: number | null;
  ao12: number | null;
  ao50: number | null;
  ao100: number | null;
}

export function computePersonalBests(solves: Solve[]): PersonalBests {
  const clean = solves.filter((s) => !s.dnf);
  const single = clean.length > 0 ? Math.min(...clean.map((s) => s.timeMs)) : null;

  const getBest = (arr: { ms: number }[]) => {
    const valid = arr.filter((x) => isFinite(x.ms));
    return valid.length > 0 ? Math.min(...valid.map((x) => x.ms)) : null;
  };

  return {
    single,
    mo3: getBest(rollingMean(solves, 3)),
    ao5: getBest(rollingAverage(solves, 5)),
    ao12: getBest(rollingAverage(solves, 12)),
    ao50: getBest(rollingAverage(solves, 50)),
    ao100: getBest(rollingAverage(solves, 100)),
  };
}

/** Best (lowest) finite rolling AoN in a solve list, or null when there is none. */
export function bestRollingAverage(solves: Solve[], n: number): number | null {
  let best: number | null = null;
  for (const { ms } of rollingAverage(solves, n)) {
    if (isFinite(ms) && (best === null || ms < best)) best = ms;
  }
  return best;
}

export const SUB_X_WINDOW = 100;
export const SUB_X_MIN_SOLVES = 12;

/**
 * "Sub-X" level: the whole-second X the user currently averages under.
 * Trimmed mean of the last SUB_X_WINDOW clean times (fastest and slowest 5%
 * dropped, at least one each), rounded up to the next whole second; an
 * exact 15.000 average is sub-16, not sub-15.
 * `cleanTimesMs` is chronological, DNFs already removed.
 */
export function subXLevel(cleanTimesMs: number[]): number | null {
  const recent = cleanTimesMs.slice(-SUB_X_WINDOW);
  if (recent.length < SUB_X_MIN_SOLVES) return null;
  const sorted = [...recent].sort((a, b) => a - b);
  const trim = Math.max(1, Math.ceil(sorted.length * 0.05));
  const kept = sorted.slice(trim, sorted.length - trim);
  const mean = kept.reduce((a, b) => a + b, 0) / kept.length;
  return Math.floor(mean / 1000) + 1;
}

/**
 * Marks every value that was a personal best when it was set: lower than or
 * equal to everything before it. Nulls (DNF / no average yet) are never
 * records. The last `true` is the current best; earlier ones are ex-bests.
 */
export function pbHistory(values: (number | null)[]): boolean[] {
  let best = Infinity;
  return values.map((v) => {
    if (v === null || v > best) return false;
    best = v;
    return true;
  });
}
