import type { PuzzleType } from "@/lib/types";

const PUZZLE_TO_EVENT: Record<PuzzleType, string> = {
  "2x2": "222",
  "3x3": "333",
  "4x4": "444",
  "5x5": "555",
  "6x6": "666",
  "7x7": "777",
  Pyraminx: "pyram",
  Megaminx: "minx",
  Skewb: "skewb",
  "Square-1": "sq1",
  Clock: "clock",
  Unknown: "333",
};

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generate3x3Fallback(): string {
  const faces = ["U", "D", "R", "L", "F", "B"];
  const modifiers = ["", "'", "2"];
  const moves: string[] = [];
  let lastFace = -1;
  let secondLastFace = -1;

  while (moves.length < 21) {
    const face = randInt(0, 5);
    if (face === lastFace) continue;
    const currentAxis = Math.floor(face / 2);
    const lastAxis = Math.floor(lastFace / 2);
    const secondLastAxis = Math.floor(secondLastFace / 2);

    if (currentAxis === lastAxis) {
      if (secondLastFace !== -1 && secondLastAxis === currentAxis) continue;
    }

    secondLastFace = lastFace;
    lastFace = face;
    moves.push(`${faces[face]}${modifiers[randInt(0, 2)]}`);
  }
  return moves.join(" ");
}

function generate2x2Fallback(): string {
  const faces = ["U", "R", "F"];
  const modifiers = ["", "'", "2"];
  const moves: string[] = [];
  let lastFace = -1;
  const count = randInt(9, 10);

  while (moves.length < count) {
    const face = randInt(0, 2);
    if (face === lastFace) continue;
    lastFace = face;
    moves.push(`${faces[face]}${modifiers[randInt(0, 2)]}`);
  }
  return moves.join(" ");
}

function generate4x4Fallback(): string {
  const faces = ["U", "D", "R", "L", "F", "B", "Uw", "Rw", "Fw"];
  const modifiers = ["", "'", "2"];
  const moves: string[] = [];
  let last = "";

  while (moves.length < 42) {
    const face = faces[randInt(0, faces.length - 1)];
    if (face[0] === last[0]) continue;
    last = face;
    moves.push(`${face}${modifiers[randInt(0, 2)]}`);
  }
  return moves.join(" ");
}

function generate5x5Fallback(): string {
  const faces = ["U", "D", "R", "L", "F", "B", "Uw", "Dw", "Rw", "Lw", "Fw", "Bw"];
  const modifiers = ["", "'", "2"];
  const moves: string[] = [];
  let last = "";

  while (moves.length < 60) {
    const face = faces[randInt(0, faces.length - 1)];
    if (face[0] === last[0]) continue;
    last = face;
    moves.push(`${face}${modifiers[randInt(0, 2)]}`);
  }
  return moves.join(" ");
}

function generateBigCubeFallback(count: number, faces: string[]): string {
  const modifiers = ["", "'", "2"];
  const moves: string[] = [];
  let last = "";

  while (moves.length < count) {
    const face = faces[randInt(0, faces.length - 1)];
    if (face === last) continue;
    last = face;
    moves.push(`${face}${modifiers[randInt(0, 2)]}`);
  }
  return moves.join(" ");
}

function generatePyraminxFallback(): string {
  const faces = ["U", "L", "R", "B"];
  const tips = ["u", "l", "r", "b"];
  const modifiers = ["", "'"];
  const moves: string[] = [];
  let lastFace = -1;

  for (let i = 0; i < 10; i++) {
    let f = randInt(0, 3);
    while (f === lastFace) {
      f = randInt(0, 3);
    }
    lastFace = f;
    moves.push(`${faces[f]}${modifiers[randInt(0, 1)]}`);
  }

  for (const tip of tips) {
    if (Math.random() > 0.4) {
      moves.push(`${tip}${modifiers[randInt(0, 1)]}`);
    }
  }
  return moves.join(" ");
}

function generateMegaminxFallback(): string {
  const lines: string[] = [];
  for (let line = 0; line < 7; line++) {
    const pairs: string[] = [];
    for (let p = 0; p < 5; p++) {
      const r = Math.random() > 0.5 ? "R++" : "R--";
      const d = Math.random() > 0.5 ? "D++" : "D--";
      pairs.push(`${r} ${d}`);
    }
    const u = Math.random() > 0.5 ? "U" : "U'";
    lines.push(`${pairs.join(" ")} ${u}`);
  }
  return lines.join("\n");
}

function generateSkewbFallback(): string {
  const faces = ["U", "L", "R", "B"];
  const modifiers = ["", "'"];
  const moves: string[] = [];
  let lastFace = -1;

  for (let i = 0; i < 10; i++) {
    let f = randInt(0, 3);
    while (f === lastFace) {
      f = randInt(0, 3);
    }
    lastFace = f;
    moves.push(`${faces[f]}${modifiers[randInt(0, 1)]}`);
  }
  return moves.join(" ");
}

function generateSq1Fallback(): string {
  const pairs: string[] = [];
  const count = randInt(12, 14);
  for (let i = 0; i < count; i++) {
    let x = randInt(-5, 6);
    let y = randInt(-5, 6);
    while (x === 0 && y === 0) {
      x = randInt(-5, 6);
      y = randInt(-5, 6);
    }
    pairs.push(`(${x}, ${y})`);
  }
  return pairs.join(" / ");
}

function generateClockFallback(): string {
  const pins = ["UR", "DR", "DL", "UL"];
  const rNum = () => randInt(0, 6);
  const rSign = () => (Math.random() > 0.5 ? "+" : "-");
  const part1 = [
    `UR${rNum()}${rSign()}`,
    `DR${rNum()}${rSign()}`,
    `DL${rNum()}${rSign()}`,
    `UL${rNum()}${rSign()}`,
    `U${rNum()}${rSign()}`,
    `R${rNum()}${rSign()}`,
    `D${rNum()}${rSign()}`,
    `L${rNum()}${rSign()}`,
    `ALL${rNum()}${rSign()}`,
  ].join(" ");

  const part2 = [
    `U${rNum()}${rSign()}`,
    `R${rNum()}${rSign()}`,
    `D${rNum()}${rSign()}`,
    `L${rNum()}${rSign()}`,
    `ALL${rNum()}${rSign()}`,
  ].join(" ");

  const activePins = pins.filter(() => Math.random() > 0.5).join(" ");
  return `${part1} y2 ${part2}${activePins ? ` ${activePins}` : ""}`;
}

const DETERMINISTIC_FALLBACKS: Record<PuzzleType, string> = {
  "3x3": "D R2 L D' R' F2 L U F2 D2 R2 F' U2 B2 R2 B' D2 R2 F R2",
  "2x2": "R2 U' L2 F' U' L F' L2 F L' U'",
  "4x4": "F2 L2 U2 B' U2 F2 D2 L2 D2 B' R2 B' L' U L' R' D' F' R' D R' Fw2 Uw2 F' L Fw2 Uw2 B L Uw2 F' R U' F' Rw2 F Uw' B2 Rw U2 D' Fw D' Rw' B' L'",
  "5x5": "R' Rw2 Dw F2 Dw' B R' Uw L' U' Dw2 R' U D L2 Fw B2 R2 Dw R' Bw' D2 L' Rw2 Fw' Dw' L2 Uw' L Bw' U' Bw Lw2 Bw2 Dw' Bw Rw Fw' Rw2 Fw' B2 L Dw' B D Rw2 D2 B' Dw' Rw' F2 Lw R2 B Bw' Rw U' Rw2 B2 U",
  "6x6": "F Uw B2 Dw' Lw Uw 3Uw2 D B2 R2 3Fw2 Rw' Fw2 3Bw2 D2 Rw 3Fw' Bw U2 Lw2 Dw 3Lw' 3Rw2 3Bw 3Lw' F' U' 3Lw 3Dw2 3Bw L2 3Bw2 L' Lw 3Fw' 3Uw 3Fw' Dw R' Bw2 D 3Dw B' 3Lw' 3Dw2 L2 3Lw2 3Uw' B Dw' 3Bw' Dw2 3Dw2 Rw 3Rw F2 Bw2 3Bw2 3Uw' 3Dw' 3Fw 3Uw2 Rw' 3Uw B 3Rw' 3Fw' B' 3Bw2 Dw' 3Lw' Bw' D Lw2 U' Lw R Fw2 Bw2 L2",
  "7x7": "Lw' Fw2 3Rw' F' D B' Dw2 L' U' 3Dw2 B' U 3Bw D' Rw2 B' 3Uw' B 3Bw U2 3Fw' 3Bw' 3Uw' L D2 L' Rw' Bw2 3Uw' 3Dw2 Rw2 3Bw' 3Rw2 U Rw2 3Uw2 3Dw Fw R Uw' F2 3Bw' Uw Lw Bw D 3Fw Bw' Dw' Lw2 U2 Dw' F2 D2 3Dw Rw2 Uw2 Lw2 F 3Rw2 Dw2 3Rw' Uw2 3Dw' 3Lw2 3Dw L2 Lw' Fw' U Uw' F 3Rw' 3Uw2 Rw' F2 Dw Bw 3Rw F2 Bw2 3Uw2 3Lw' 3Dw B Rw2 3Fw' B 3Uw' D2 3Rw' B 3Uw Bw2 L' B U 3Rw2 Uw' 3Lw2",
  Pyraminx: "R' L B' R' L B L U' b' r' l'",
  Megaminx: "R++ D-- R++ D-- R++ D-- R++ D++ R-- D++ U\nR-- D-- R++ D-- R-- D++ R-- D++ R++ D-- U'\nR-- D++ R-- D++ R++ D-- R++ D-- R++ D-- U'\nR++ D-- R-- D-- R-- D-- R++ D++ R-- D-- U'\nR-- D-- R++ D++ R++ D++ R++ D-- R-- D++ U\nR-- D++ R++ D-- R++ D++ R++ D-- R-- D-- U'\nR++ D-- R-- D++ R++ D++ R-- D++ R-- D-- U'",
  Skewb: "U L R L U' R' B L' B' R' L",
  "Square-1": "(0, 2) / (-2, 4) / (-1, -4) / (-5, 4) / (3, 0) / (-1, -3) / (3, 0) / (0, 2) / (6, -2) / (2, 3) / (2, 0) / (-2, 3)",
  Clock: "U6+ R2- D2+ L1+ ALL4- UR5- DR4- DL2- UL1+ y2 U6+ R3+ D1- L4- ALL2-",
  Unknown: "D R2 L D' R' F2 L U F2 D2 R2 F' U2 B2 R2 B' D2 R2 F R2",
};

export function generateFallbackScramble(puzzle: PuzzleType): string {
  if (typeof window === "undefined") {
    return DETERMINISTIC_FALLBACKS[puzzle] || DETERMINISTIC_FALLBACKS["3x3"];
  }

  switch (puzzle) {
    case "2x2":
      return generate2x2Fallback();
    case "3x3":
      return generate3x3Fallback();
    case "4x4":
      return generate4x4Fallback();
    case "5x5":
      return generate5x5Fallback();
    case "6x6":
      return generateBigCubeFallback(80, [
        "U", "D", "R", "L", "F", "B",
        "Uw", "Dw", "Rw", "Lw", "Fw", "Bw",
        "3Uw", "3Rw", "3Fw",
      ]);
    case "7x7":
      return generateBigCubeFallback(100, [
        "U", "D", "R", "L", "F", "B",
        "Uw", "Dw", "Rw", "Lw", "Fw", "Bw",
        "3Uw", "3Dw", "3Rw", "3Lw", "3Fw", "3Bw",
      ]);
    case "Pyraminx":
      return generatePyraminxFallback();
    case "Megaminx":
      return generateMegaminxFallback();
    case "Skewb":
      return generateSkewbFallback();
    case "Square-1":
      return generateSq1Fallback();
    case "Clock":
      return generateClockFallback();
    case "Unknown":
    default:
      return generate3x3Fallback();
  }
}

type ScrambleFunction = (event: string) => Promise<{ toString(): string }>;

/**
 * Same-origin copy of cubing.js, produced by `scripts/copy-cubing.mjs` (see
 * docs/adr/0001-self-host-cubing-js.md). cubing.js resolves its search worker
 * via `new URL("./search-worker-entry.js", import.meta.url)`, so the worker
 * and its chunks load from `/cubing/chunks/` on the same origin too.
 */
export const CUBING_SCRAMBLE_URL = "/cubing/scramble/index.js";

/**
 * Loading the module is same-origin and small, but on a slow mobile network the
 * first fetch of the scramble chunks can take a few seconds.
 */
const MODULE_LOAD_TIMEOUT_MS = 10_000;

/**
 * The first scramble also spawns the search worker and builds its tables.
 * 4x4 random-state search is the slowest event (multi-second on phones);
 * the rest finish well under a second once warm. Scrambles are prefetched
 * while the user solves, so a generous ceiling rarely shows as latency.
 */
const GENERATION_TIMEOUT_MS = 8_000;
const SLOW_EVENT_TIMEOUT_MS: Partial<Record<string, number>> = { "444": 20_000 };

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

let cubingModulePromise: Promise<ScrambleFunction | null> | null = null;

async function getCubingScrambler(): Promise<ScrambleFunction | null> {
  try {
    const isNode = typeof process !== "undefined" && Boolean(process.versions?.node);
    if (isNode) {
      const mod = await import("cubing/scramble");
      return mod.randomScrambleForEvent as ScrambleFunction;
    }

    if (!cubingModulePromise) {
      // Runtime import of a static public file; hidden from the bundler.
      const dynamicImport = new Function("u", "return import(u)") as (u: string) => Promise<any>;
      const url = new URL(CUBING_SCRAMBLE_URL, window.location.origin).href;
      cubingModulePromise = withTimeout(dynamicImport(url), MODULE_LOAD_TIMEOUT_MS, "cubing.js load timeout")
        .then((mod) => mod.randomScrambleForEvent as ScrambleFunction)
        .catch((err) => {
          console.warn("Unable to load self-hosted cubing.js:", err);
          // Allow a later scramble to retry instead of caching the failure.
          cubingModulePromise = null;
          return null;
        });
    }

    return await cubingModulePromise;
  } catch (err) {
    console.warn("Error acquiring scrambler:", err);
    return null;
  }
}

export async function generateScramble(puzzle: PuzzleType): Promise<string> {
  const eventCode = PUZZLE_TO_EVENT[puzzle] || "333";

  try {
    const scrambler = await getCubingScrambler();
    if (scrambler) {
      const scramble = await withTimeout(
        scrambler(eventCode),
        SLOW_EVENT_TIMEOUT_MS[eventCode] ?? GENERATION_TIMEOUT_MS,
        "Scramble generation timeout",
      );
      return scramble.toString();
    }
  } catch (err) {
    console.warn(`Scramble generation failed for ${puzzle}, using fallback:`, err);
  }

  // Last resort only: random-move, not WCA random-state.
  return generateFallbackScramble(puzzle);
}
