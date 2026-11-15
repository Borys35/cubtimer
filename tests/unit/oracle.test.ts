import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { crossCheck } from "../../scripts/verify";

const FIXTURE = resolve(__dirname, "../../fixtures/synthetic-export.txt");

describe("parser oracle vs cstimer's own session stats", () => {
  it("synthetic fixture round-trips counts, DNFs, means, and types", () => {
    const result = crossCheck(readFileSync(FIXTURE, "utf8"));
    expect(result.failures).toBe(0);
    expect(result.lines.some((l) => l.includes("FAIL"))).toBe(false);
  });
});

describe("theme palette completeness", () => {
  const css = readFileSync(resolve(__dirname, "../../src/app/globals.css"), "utf8");

  const REQUIRED = [
    "--chart-bg",
    "--chart-grid",
    "--chart-tick",
    "--chart-volume",
    "--chart-tooltip-bg",
    "--series-raw",
    "--series-ao5",
    "--series-ao12",
    "--series-ao100",
    "--series-trend",
    "--series-proj",
  ];

  for (const theme of [
    '[data-theme="dark"]',
    '[data-theme="light"]',
    '[data-theme="borealis"]',
    '[data-theme="nebula"]',
    '[data-theme="ember"]',
  ]) {
    it(`${theme} defines every chart variable`, () => {
      const start = css.indexOf(theme);
      expect(start).toBeGreaterThanOrEqual(0);
      const nextBrace = css.indexOf("}", start);
      const block = css.slice(start, nextBrace === -1 ? css.length : nextBrace + 1);
      for (const v of REQUIRED) {
        expect(block).toContain(v);
      }
    });
  }
});
