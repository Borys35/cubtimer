"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "@/components/ThemeProvider";

const FONT_PX = 14;
const LINE_HEIGHT = 1.2;
const FONT = `${FONT_PX}px "JetBrains Mono", ui-monospace, monospace`;
const MAX_DPR = 2;
// ASCII reads fine at a low frame rate, and the cubes turn slowly.
const FRAME_INTERVAL_MS = 1000 / 15;

// Darkest to brightest. A face's character comes from how much it faces the light.
const RAMP = ":=+*#%@";

// One color per face (a solved cube), slightly muted so they sit behind the UI.
const STICKERS = ["#E8ECEF", "#F2CC2E", "#2FB563", "#3D7BE0", "#E5483A", "#F08A2E"];
const NOTATION_COLOR = "#8FA39C";

// Algorithms typed out in the background, one move at a time.
const ALGS = [
  "R U R' U'",
  "F R U R' U' F'",
  "R U R' U R U2 R'",
  "R U2 R' U' R U' R'",
  "M2 U M2 U2 M2 U M2",
  "R U R' U' R' F R2 U' R' U' R U R' F'",
  "x R' U R' D2 R U' R' D2 R2",
  "R' U' F' R U R' U' R' F R2 U' R' U' R U R' U R",
  "F2 L' U' L U F2 R' U R U'",
  "L' U' L U' L' U2 L",
  "r U R' U' r' F R F'",
  "R2 U R U R' U' R' U' R' U R'",
];

interface Cube {
  /** Center as a fraction of the viewport, plus the drift around it. */
  cx: number;
  cy: number;
  driftX: number;
  driftY: number;
  /** Half the cube's edge as a fraction of the smaller viewport side. */
  size: number;
  /** Rotation speeds in rad/s around x, y, z and a phase offset. */
  spin: [number, number, number];
  phase: number;
}

interface Typed {
  col: number;
  row: number;
  text: string;
  born: number;
}

const CHARS_PER_SEC = 7;
const HOLD_SEC = 4;
const FADE_SEC = 3;

// Kept toward the corners, clear of the scramble and the timer digits.
const CUBES: Cube[] = [
  { cx: 0.86, cy: 0.76, driftX: 0.03, driftY: 0.04, size: 0.19, spin: [0.11, 0.16, 0.05], phase: 0 },
  { cx: 0.9, cy: 0.2, driftX: 0.03, driftY: 0.03, size: 0.1, spin: [-0.14, 0.1, 0.07], phase: 2.1 },
  { cx: 0.3, cy: 0.86, driftX: 0.05, driftY: 0.03, size: 0.085, spin: [0.09, -0.17, -0.06], phase: 4.4 },
];

/** Rotation matrix Ry(b) * Rx(a) * Rz(c), row-major, cube space -> screen space. */
function rotation(a: number, b: number, c: number): number[] {
  const ca = Math.cos(a), sa = Math.sin(a);
  const cb = Math.cos(b), sb = Math.sin(b);
  const cc = Math.cos(c), sc = Math.sin(c);
  return [
    cb * cc + sb * sa * sc, -cb * sc + sb * sa * cc, sb * ca,
    ca * sc, ca * cc, -sa,
    -sb * cc + cb * sa * sc, sb * sc + cb * sa * cc, cb * ca,
  ];
}

/** Starts the animation on `canvas`; returns a stop function, or null without 2D canvas. */
function startAscii(canvas: HTMLCanvasElement): (() => void) | null {
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext("2d");
  } catch {
    return null;
  }
  if (!ctx) return null;
  const g = ctx;

  let typed: Typed[] = [];
  let width = 0;
  let height = 0;
  let cellW = FONT_PX * 0.6;
  const cellH = FONT_PX * LINE_HEIGHT;
  let cols = 0;
  let rows = 0;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let raf = 0;
  let lastDraw = 0;

  const spawnTyped = (now: number, age = 0): Typed => {
    const text = ALGS[Math.floor(Math.random() * ALGS.length)];
    return {
      col: Math.floor(Math.random() * Math.max(1, cols - text.length)),
      row: Math.floor(Math.random() * rows),
      text,
      born: now - age * 1000,
    };
  };

  const drawCube = (cube: Cube, t: number) => {
    const half = cube.size * Math.min(width, height);
    const cx = (cube.cx + cube.driftX * Math.sin(t * 0.05 + cube.phase)) * width;
    const cy = (cube.cy + cube.driftY * Math.cos(t * 0.04 + cube.phase)) * height;
    const m = rotation(
      cube.phase + t * cube.spin[0],
      cube.phase * 1.7 + t * cube.spin[1],
      cube.phase * 0.6 + t * cube.spin[2],
    );
    // Orthographic view down +z. In cube space the ray direction is the
    // matrix's third row and a screen point maps through its transpose.
    const dir = [m[6], m[7], m[8]];
    const reach = half * 1.75; // > sqrt(3): the cube's corner radius
    const c0 = Math.max(0, Math.floor((cx - reach) / cellW));
    const c1 = Math.min(cols - 1, Math.ceil((cx + reach) / cellW));
    const r0 = Math.max(0, Math.floor((cy - reach) / cellH));
    const r1 = Math.min(rows - 1, Math.ceil((cy + reach) / cellH));

    for (let row = r0; row <= r1; row++) {
      const y = ((row + 0.5) * cellH - cy) / half;
      for (let col = c0; col <= c1; col++) {
        const x = ((col + 0.5) * cellW - cx) / half;
        const z = -10;
        const o = [
          m[0] * x + m[3] * y + m[6] * z,
          m[1] * x + m[4] * y + m[7] * z,
          m[2] * x + m[5] * y + m[8] * z,
        ];
        // Slab test against the cube [-1, 1]^3.
        let tNear = -Infinity;
        let tFar = Infinity;
        let axis = 0;
        for (let i = 0; i < 3; i++) {
          const a = (-1 - o[i]) / dir[i];
          const b = (1 - o[i]) / dir[i];
          const lo = Math.min(a, b);
          const hi = Math.max(a, b);
          if (lo > tNear) {
            tNear = lo;
            axis = i;
          }
          if (hi < tFar) tFar = hi;
        }
        if (!(tNear <= tFar)) continue;

        const sign = dir[axis] > 0 ? -1 : 1;
        const u = o[(axis + 1) % 3] + tNear * dir[(axis + 1) % 3];
        const v = o[(axis + 2) % 3] + tNear * dir[(axis + 2) % 3];
        const su = (u + 1) * 1.5;
        const sv = (v + 1) * 1.5;
        const fu = su - Math.floor(su);
        const fv = sv - Math.floor(sv);
        // Gaps between stickers stay empty: that is what makes it read as a cube.
        if (fu < 0.1 || fu > 0.9 || fv < 0.1 || fv > 0.9) continue;

        const face = axis * 2 + (sign > 0 ? 0 : 1);
        // Face normal in screen space is +-(column `axis` of m); light comes
        // from the upper left, toward the viewer.
        const nx = sign * m[axis];
        const ny = sign * m[3 + axis];
        const nz = sign * m[6 + axis];
        const light = Math.max(0, -0.45 * nx - 0.55 * ny - 0.7 * nz);
        const ch = RAMP[Math.min(RAMP.length - 1, Math.floor(light * RAMP.length))];
        g.fillStyle = STICKERS[face];
        g.globalAlpha = 0.2 + 0.26 * light;
        g.fillText(ch, col * cellW, row * cellH);
      }
    }
  };

  const draw = (now: number) => {
    const t = now / 1000;
    g.globalAlpha = 1;
    g.clearRect(0, 0, width, height);

    g.fillStyle = NOTATION_COLOR;
    typed = typed.map((item) => {
      const age = (now - item.born) / 1000;
      const typeSec = item.text.length / CHARS_PER_SEC;
      return age > typeSec + HOLD_SEC + FADE_SEC ? spawnTyped(now) : item;
    });
    for (const item of typed) {
      const age = (now - item.born) / 1000;
      const typeSec = item.text.length / CHARS_PER_SEC;
      const shown = Math.min(item.text.length, Math.floor(age * CHARS_PER_SEC));
      const fade = 1 - Math.max(0, age - typeSec - HOLD_SEC) / FADE_SEC;
      // Kept faint: these must never be mistaken for the real scramble.
      g.globalAlpha = 0.17 * Math.max(0, fade);
      g.fillText(item.text.slice(0, shown), item.col * cellW, item.row * cellH);
      if (shown < item.text.length) {
        g.globalAlpha = 0.3;
        g.fillText("_", (item.col + shown) * cellW, item.row * cellH);
      }
    }

    for (const cube of CUBES) drawCube(cube, t);
  };

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.max(1, Math.round(width * dpr));
    canvas.height = Math.max(1, Math.round(height * dpr));
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.font = FONT;
    g.textBaseline = "top";
    cellW = g.measureText("M").width || FONT_PX * 0.6;
    cols = Math.ceil(width / cellW);
    rows = Math.ceil(height / cellH);
    // One algorithm per ~260 cells, at staggered ages so they don't all type at once.
    const now = performance.now();
    const count = Math.max(4, Math.round((cols * rows) / 260));
    typed = Array.from({ length: count }, () => spawnTyped(now, Math.random() * 10));
    draw(lastDraw || now);
  };

  const loop = (now: number) => {
    raf = requestAnimationFrame(loop);
    if (now - lastDraw < FRAME_INTERVAL_MS) return;
    lastDraw = now;
    draw(now);
  };

  // Animate only while the tab is visible and motion is allowed; otherwise
  // leave a single still frame.
  const sync = () => {
    cancelAnimationFrame(raf);
    raf = 0;
    if (!document.hidden && !reducedMotion.matches) raf = requestAnimationFrame(loop);
  };

  resize();
  sync();
  // The web font changes the cell width once it arrives.
  let alive = true;
  document.fonts?.ready.then(() => alive && resize()).catch(() => {});
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", sync);
  reducedMotion.addEventListener("change", sync);

  return () => {
    alive = false;
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", resize);
    document.removeEventListener("visibilitychange", sync);
    reducedMotion.removeEventListener("change", sync);
  };
}

/**
 * Full-viewport ASCII backdrop for the `ascii` theme: slowly turning
 * cubes drawn in characters, and algorithms typing themselves out.
 * Sits at z-index -1 like the aurora, so it shows through the page background
 * and the glass navbar/sidebars only.
 */
export function AsciiBackground() {
  const { theme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const active = theme === "ascii";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !active) return;
    const stop = startAscii(canvas);
    return stop ?? undefined;
  }, [active]);

  if (!active) return null;
  return <canvas ref={canvasRef} aria-hidden className="ascii-canvas" />;
}
