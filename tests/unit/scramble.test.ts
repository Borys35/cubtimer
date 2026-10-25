import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { generateScramble, generateFallbackScramble, CUBING_SCRAMBLE_URL } from "@/lib/scramble";
import type { PuzzleType } from "@/lib/types";

describe("browser cubing.js source", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../../src/lib/scramble.ts"), "utf8");

  it("loads the self-hosted same-origin copy", () => {
    expect(CUBING_SCRAMBLE_URL).toBe("/cubing/scramble/index.js");
    expect(source).toContain("CUBING_SCRAMBLE_URL");
  });

  it("never references the cubing.js CDN", () => {
    expect(source).not.toMatch(/cdn\.cubing\.net/);
  });

  it("points at the entry the prebuild bundle emits", () => {
    const script = fs.readFileSync(path.resolve(__dirname, "../../scripts/copy-cubing.mjs"), "utf8");
    // esbuild entry "scramble/index" in outdir public/cubing -> /cubing/scramble/index.js
    expect(script).toContain('"scramble/index"');
    expect(script).toContain('"public/cubing"');
  });
});

// Real cubing.js search: a cold 4x4 or Square-1 scramble can take several
// seconds on a loaded machine, past vitest's 5s default.
describe("generateScramble", { timeout: 30_000 }, () => {
  it("returns a scramble for 3x3", async () => {
    const scramble = await generateScramble("3x3");
    expect(typeof scramble).toBe("string");
    expect(scramble.length).toBeGreaterThan(0);
  });

  it("returns a scramble for 2x2", async () => {
    const scramble = await generateScramble("2x2");
    expect(typeof scramble).toBe("string");
    expect(scramble.length).toBeGreaterThan(0);
  });

  it("returns a scramble for Pyraminx", async () => {
    const scramble = await generateScramble("Pyraminx");
    expect(typeof scramble).toBe("string");
    expect(scramble.length).toBeGreaterThan(0);
  });

  it("returns a scramble for Square-1", async () => {
    const scramble = await generateScramble("Square-1");
    expect(typeof scramble).toBe("string");
    expect(scramble.length).toBeGreaterThan(0);
  });

  it("returns a scramble for 4x4", async () => {
    const scramble = await generateScramble("4x4");
    expect(typeof scramble).toBe("string");
    expect(scramble.length).toBeGreaterThan(0);
  });

  it("returns a scramble for 5x5", async () => {
    const scramble = await generateScramble("5x5");
    expect(typeof scramble).toBe("string");
    expect(scramble.length).toBeGreaterThan(0);
  });

  it("returns a scramble for Skewb", async () => {
    const scramble = await generateScramble("Skewb");
    expect(typeof scramble).toBe("string");
    expect(scramble.length).toBeGreaterThan(0);
  });

  it("returns a scramble for Megaminx", async () => {
    const scramble = await generateScramble("Megaminx");
    expect(typeof scramble).toBe("string");
    expect(scramble.length).toBeGreaterThan(0);
  });

  it("returns a scramble for Clock", async () => {
    const scramble = await generateScramble("Clock");
    expect(typeof scramble).toBe("string");
    expect(scramble.length).toBeGreaterThan(0);
  });
});

describe("generateFallbackScramble", () => {
  const puzzles: PuzzleType[] = [
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
  ];

  puzzles.forEach((puzzle) => {
    it(`generates a valid non-empty fallback scramble for ${puzzle}`, () => {
      const scramble = generateFallbackScramble(puzzle);
      expect(typeof scramble).toBe("string");
      expect(scramble.length).toBeGreaterThan(0);
      expect(scramble).not.toContain("undefined");
    });
  });
});
