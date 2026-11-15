import { describe, it, expect } from "vitest";
import {
  analyze,
  filterByRange,
  separateJunk,
  pctPerWeek,
  fmtTime,
  median,
  madCv,
  iqrCv,
  LAST_N,
  rollingAverage,
  rollingMean,
  dailyBuckets,
  weeklyBuckets,
  improvementScore,
  computePersonalBests,
  bestRollingAverage,
  subXLevel,
  pbHistory,
  SUB_X_MIN_SOLVES,
} from "@/lib/stats";
import type { Solve } from "@/lib/types";

const NOW = Date.UTC(2026, 7, 26);

function solve(partial: Partial<Solve>): Solve {
  return {
    timeMs: 20000,
    dnf: false,
    penalty: 0,
    scramble: "",
    dateSec: NOW / 1000,
    splits: [],
    ...partial,
  };
}

describe("filterByRange", () => {
  const solves = [
    solve({ dateSec: (NOW - 3 * 86400_000) / 1000 }),
    solve({ dateSec: (NOW - 45 * 86400_000) / 1000 }),
  ];

  it("all keeps everything", () => {
    expect(filterByRange(solves, "all", NOW)).toHaveLength(2);
  });
  it("30-day cutoff excludes older solves", () => {
    expect(filterByRange(solves, "30", NOW)).toHaveLength(1);
  });
});

describe("separateJunk", () => {
  it("flags times beyond the in-range median cap as junk", () => {
    const solves = [
      ...Array.from({ length: 9 }, (_, i) => solve({ timeMs: 20000 + i * 100 })),
      solve({ timeMs: 400000 }),
    ];
    const { kept, junk } = separateJunk(solves);
    expect(junk).toHaveLength(1);
    expect(kept).toHaveLength(9);
  });
  it("keeps DNFs for counting instead of dropping them silently", () => {
    const solves = [
      ...Array.from({ length: 5 }, (_, i) => solve({ timeMs: 20000 + i * 100 })),
      solve({ timeMs: 25000, dnf: true, penalty: -1 }),
    ];
    const { kept } = separateJunk(solves);
    expect(kept.some((s) => s.dnf)).toBe(true);
  });
  it("too-small input passes through untouched", () => {
    const solves = [solve({}), solve({})];
    expect(separateJunk(solves).junk).toHaveLength(0);
  });
});

describe("analyze evidence exposure", () => {
  it("returns lastNTimes capped at LAST_N and non-empty days", () => {
    const solves = Array.from({ length: 60 }, (_, i) =>
      solve({ timeMs: 21000 + (i % 10) * 80, dateSec: (NOW - (i % 12) * 86400_000) / 1000 }),
    );
    const result = analyze({ rangedClean: solves, allClean: solves, nowMs: NOW });
    expect(result.lastNTimes.length).toBe(LAST_N);
    expect(result.days.length).toBeGreaterThan(0);
    expect(result.currentLevelMs).not.toBeNull();
  });
});

describe("pctPerWeek", () => {
  it("positive when improving (slope negative)", () => {
    const trend = { slopeMsPerDay: -10, interceptMs: 20000, endLevelMs: 19930, weeksCovered: 4 };
    expect(pctPerWeek(trend, 20000)).toBeCloseTo(0.35, 5);
  });
});

describe("fmtTime", () => {
  it("formats sub-minute as seconds", () => {
    expect(fmtTime(12345)).toBe("12.35");
  });
  it("formats minutes with padded seconds", () => {
    expect(fmtTime(75400)).toBe("1:15.40");
  });
});

describe("median", () => {
  it("odd count picks middle", () => {
    expect(median([3, 1, 2])).toBe(2);
  });
  it("even count averages middle two", () => {
    expect(median([3, 1, 2, 4])).toBe(2.5);
  });
  it("empty returns null", () => {
    expect(median([])).toBeNull();
  });
});

describe("madCv", () => {
  it("resists a single large outlier", () => {
    const baseline = Array.from({ length: 20 }, (_, i) => 20000 + (i % 5) * 100);
    const withOutlier = [...baseline, 80000];
    const cv = madCv(baseline);
    const cvO = madCv(withOutlier);
    expect(cv).not.toBeNull();
    expect(cvO).not.toBeNull();
    expect(cvO!).toBeCloseTo(cv!, 5);
  });
});

describe("iqrCv", () => {
  it("positive when times vary", () => {
    const times = Array.from({ length: 20 }, (_, i) => 20000 + (i % 5) * 100);
    const v = iqrCv(times);
    expect(v).not.toBeNull();
    expect(v!).toBeGreaterThan(0);
  });
});

describe("rollingAverage & rollingMean", () => {
  it("rollingAverage does not double count penalty", () => {
    // 5 solves: 10s, 11s, 12s, 13s, 14s (where 12s has penalty code 2000 already in timeMs)
    const list = [
      solve({ timeMs: 10000, penalty: 0 }),
      solve({ timeMs: 11000, penalty: 0 }),
      solve({ timeMs: 12000, penalty: 2000 }),
      solve({ timeMs: 13000, penalty: 0 }),
      solve({ timeMs: 14000, penalty: 0 }),
    ];
    const ao5 = rollingAverage(list, 5);
    expect(ao5).toHaveLength(1);
    // trimmed mean drops min (10000) and max (14000), leaving 11000, 12000, 13000 -> mean 12000
    expect(ao5[0].ms).toBe(12000);
  });

  it("rollingMean calculates untrimmed mean of N solves and handles DNF", () => {
    const list = [
      solve({ timeMs: 10000 }),
      solve({ timeMs: 12000 }),
      solve({ timeMs: 14000 }),
    ];
    const mo3 = rollingMean(list, 3);
    expect(mo3).toHaveLength(1);
    expect(mo3[0].ms).toBe(12000);

    const withDnf = [
      solve({ timeMs: 10000 }),
      solve({ timeMs: 12000, dnf: true }),
      solve({ timeMs: 14000 }),
    ];
    const mo3Dnf = rollingMean(withDnf, 3);
    expect(mo3Dnf[0].ms).toBe(Infinity);
  });
});

describe("dailyBuckets and weeklyBuckets DNF exclusion", () => {
  it("dailyBuckets excludes DNF solves", () => {
    const solves = [
      solve({ timeMs: 10000, dnf: false }),
      solve({ timeMs: 99999, dnf: true }),
    ];
    const days = dailyBuckets(solves);
    expect(days).toHaveLength(1);
    expect(days[0].meanMs).toBe(10000);
    expect(days[0].count).toBe(1);
  });

  it("weeklyBuckets excludes DNF solves", () => {
    const solves = [
      solve({ timeMs: 15000, dnf: false }),
      solve({ timeMs: 99999, dnf: true }),
    ];
    const weeks = weeklyBuckets(solves);
    expect(weeks).toHaveLength(1);
    expect(weeks[0].meanMs).toBe(15000);
    expect(weeks[0].count).toBe(1);
  });
});

describe("improvementScore level-adaptation", () => {
  it("scores sub-10 higher for a smaller %/week improvement than sub-60", () => {
    // 0.15% / week improvement
    // For 20 days with level 9s vs 50s
    // slope of -1.928 ms/day over level 9000 ms: (-slope * 7 * 100) / 9000 = 0.15%/week
    const trendSub10 = {
      slopeMsPerDay: -(9000 * 0.0015) / 7,
      interceptMs: 9000,
      endLevelMs: 8900,
      weeksCovered: 4,
    };
    const scoreSub10 = improvementScore(trendSub10, 9000);

    const trendSub60 = {
      slopeMsPerDay: -(65000 * 0.0015) / 7,
      interceptMs: 65000,
      endLevelMs: 64500,
      weeksCovered: 4,
    };
    const scoreSub60 = improvementScore(trendSub60, 65000);

    expect(scoreSub10).toBe(80);
    expect(scoreSub60).toBeLessThan(30);
  });
});

describe("computePersonalBests", () => {
  it("computes single, mo3, ao5, ao12, ao50, ao100 PBs", () => {
    // 60 solves with predictable times
    const solves = Array.from({ length: 60 }, (_, i) =>
      solve({ timeMs: 15000 - i * 10, dnf: false }),
    );
    // add a DNF
    solves[5] = solve({ timeMs: 9000, dnf: true });

    const pbs = computePersonalBests(solves);
    expect(pbs.single).not.toBeNull();
    expect(pbs.single).toBe(15000 - 59 * 10);
    expect(pbs.mo3).not.toBeNull();
    expect(pbs.ao5).not.toBeNull();
    expect(pbs.ao12).not.toBeNull();
    expect(pbs.ao50).not.toBeNull();
    expect(pbs.ao100).toBeNull(); // fewer than 100 solves
  });
});

describe("bestRollingAverage", () => {
  it("returns the lowest finite average and skips DNF averages", () => {
    const times = [20, 18, 16, 14, 12, 30, 30].map((t) => solve({ timeMs: t * 1000 }));
    // windows: [20,18,16,14,12] -> 16, [18,16,14,12,30] -> 16, [16,14,12,30,30] -> 20
    expect(bestRollingAverage(times, 5)).toBe(16000);
    const twoDnfs = [solve({}), solve({ dnf: true }), solve({ dnf: true }), solve({}), solve({})];
    expect(bestRollingAverage(twoDnfs, 5)).toBeNull();
  });

  it("is null with fewer than n solves", () => {
    expect(bestRollingAverage([solve({}), solve({})], 5)).toBeNull();
  });
});

describe("subXLevel", () => {
  it("is null below the minimum solve count", () => {
    expect(subXLevel(Array(SUB_X_MIN_SOLVES - 1).fill(14500))).toBeNull();
  });

  it("rounds the average up to the next whole second", () => {
    expect(subXLevel(Array(20).fill(14500))).toBe(15);
    expect(subXLevel(Array(20).fill(9990))).toBe(10);
  });

  it("an exact whole-second average is not yet sub that second", () => {
    expect(subXLevel(Array(20).fill(15000))).toBe(16);
  });

  it("ignores a lucky single and a blow-up", () => {
    const times = [...Array(18).fill(14500), 6000, 60000];
    expect(subXLevel(times)).toBe(15);
  });

  it("uses only the most recent 100 solves", () => {
    const times = [...Array(300).fill(30000), ...Array(100).fill(11200)];
    expect(subXLevel(times)).toBe(12);
  });
});

describe("pbHistory", () => {
  it("marks every value that was a best when set, not only the current best", () => {
    expect(pbHistory([20, 25, 18, 19, null, 15, 15, 16])).toEqual([
      true, false, true, false, false, true, true, false,
    ]);
  });

  it("never marks nulls", () => {
    expect(pbHistory([null, null])).toEqual([false, false]);
  });
});
