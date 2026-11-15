"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "@/components/ThemeProvider";
import { AURORA_PALETTES, isAuroraTheme, type AuroraPalette } from "@/lib/theme";

// Rendered at device-pixel resolution (up to 2x): the fine rays and the crisp
// rim look pixelated when a smaller buffer is upscaled. Very large windows are
// capped by pixel count to keep the shader cheap.
const MAX_DPR = 2;
const MAX_PIXELS = 4_000_000;
// Shader time per real second. The aurora should drift, not flicker.
const TIME_SCALE = 0.07;
const FRAME_INTERVAL_MS = 1000 / 30;

const VERTEX = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

const FRAGMENT = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

uniform vec2 u_res;
uniform float u_time;
uniform vec3 u_bg;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;

float hash11(float n) {
  return fract(sin(n * 127.1) * 43758.5453);
}

float hash21(vec2 p) {
  vec3 q = fract(vec3(p.xyx) * 0.1031);
  q += dot(q, q.yzx + 33.33);
  return fract((q.x + q.y) * q.z);
}

// Quintic interpolation: no visible lattice, unlike plain bilinear noise.
float noise1(float x) {
  float i = floor(x);
  float f = fract(x);
  f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(hash11(i), hash11(i + 1.0), f);
}

float noise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  return mix(
    mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
    mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) {
    v += a * noise2(p);
    p = mat2(0.8, 0.6, -0.6, 0.8) * p * 2.0 + vec2(17.0, 9.0);
    a *= 0.5;
  }
  return v / 0.875;
}

// One curtain. Its lower edge is a slowly folding curve with a soft bright
// rim; above it, thin vertical rays of uneven height fade into the sky.
// Returns (ray light, rim light, height above the edge).
vec3 curtain(vec2 p, float base, float t, float seed) {
  // Lean the rays a little so the sheet looks folded, not ruled.
  float x = p.x + 0.16 * (noise2(vec2(p.y * 1.4 + seed, t * 0.5)) - 0.5);

  float edge = base
    + 0.42 * (fbm(vec2(x * 0.75 + seed, t * 0.35 + seed)) - 0.5)
    + 0.03 * sin(x * 4.0 + t + seed);
  float d = p.y - edge;

  float fine = 0.6 * noise1(x * 46.0 + seed * 17.0 + t * 2.5)
             + 0.4 * noise1(x * 113.0 + seed * 31.0 - t * 1.8);
  // Ray height follows a slow swell only; letting each thin ray pick its own
  // height gives the top a comb of hard-ended blocks.
  float broad = 0.65 * noise1(x * 2.1 + seed * 7.0 + t * 0.6)
              + 0.35 * noise1(x * 5.3 + seed * 13.0 - t * 0.4);
  float height = 0.09 + 0.34 * broad;

  // Parts of the ribbon fade out gradually, so it reads as separate arcs.
  float presence = smoothstep(0.05, 0.60, noise2(vec2(x * 0.6 + seed * 3.0, t * 0.25 + seed)));

  // Soft lower edge: light ramps in over a band and spills a glow below it,
  // instead of being cut off on a line.
  float above = smoothstep(-0.045, 0.02, d);
  float rays = above * exp(-max(d, 0.0) / height) * (0.40 + 0.60 * fine);
  float rim = above * exp(-max(d, 0.0) * 26.0) * 0.6;
  float under = (1.0 - above) * exp(d * 16.0) * 0.22;
  return vec3((rays + under) * presence, rim * presence, d);
}

vec3 shade(vec3 c, vec3 low, vec3 high) {
  vec3 tint = mix(low, high, smoothstep(0.02, 0.38, c.z));
  return tint * c.x * 0.85 + mix(low, vec3(1.0), 0.45) * c.y * 0.55;
}

float stars(vec2 p, float t) {
  vec2 g = p * 110.0;
  vec2 id = floor(g);
  float r = hash21(id);
  if (r < 0.975) return 0.0;
  vec2 c = fract(g) - 0.5 - 0.3 * (vec2(hash21(id + 3.1), hash21(id + 7.7)) - 0.5);
  float twinkle = 0.6 + 0.4 * sin(t * 20.0 + r * 600.0);
  return smoothstep(0.22, 0.0, length(c)) * twinkle * (r - 0.975) * 40.0;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  vec2 p = vec2(uv.x * u_res.x / u_res.y, uv.y);
  float t = u_time;

  vec3 glow = vec3(0.0);
  // Three curtains stacked over the whole height: top, middle, bottom.
  glow += shade(curtain(p + vec2(3.7, 0.0), 0.78, t * 0.8, 4.0), u_c2, u_c3) * 0.8;
  glow += shade(curtain(p, 0.48, t, 0.0), u_c1, u_c2) * 0.85;
  glow += shade(curtain(p * vec2(1.2, 1.0) + vec2(8.3, 0.0), 0.16, t * 1.1, 9.0), u_c1, u_c3) * 0.8;

  // Night sky: a touch lighter toward the top, faint haze around the aurora.
  vec3 col = u_bg * (0.75 + 0.5 * uv.y);
  col += mix(u_c3, u_c2, uv.x) * 0.045 * fbm(p * 1.6 + vec2(t * 0.2, -t * 0.1));
  float lum = dot(glow, vec3(0.33));
  col += vec3(0.85, 0.9, 1.0) * stars(p, t) * (1.0 - smoothstep(0.0, 0.25, lum));
  col += glow;
  // Dither: hides banding in the long gradients.
  col += (hash21(gl_FragCoord.xy) - 0.5) / 255.0;

  gl_FragColor = vec4(col, 1.0);
}
`;

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

/** Starts the aurora on `canvas`; returns a stop function, or null without WebGL. */
function startAurora(canvas: HTMLCanvasElement, palette: AuroraPalette): (() => void) | null {
  let gl: WebGLRenderingContext | null = null;
  try {
    gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power" });
  } catch {
    return null;
  }
  if (!gl) return null;
  const ctx = gl;

  const vs = compile(ctx, ctx.VERTEX_SHADER, VERTEX);
  const fs = compile(ctx, ctx.FRAGMENT_SHADER, FRAGMENT);
  const program = ctx.createProgram();
  if (!vs || !fs || !program) return null;
  ctx.attachShader(program, vs);
  ctx.attachShader(program, fs);
  ctx.linkProgram(program);
  if (!ctx.getProgramParameter(program, ctx.LINK_STATUS)) return null;
  ctx.useProgram(program);

  const buffer = ctx.createBuffer();
  ctx.bindBuffer(ctx.ARRAY_BUFFER, buffer);
  ctx.bufferData(ctx.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), ctx.STATIC_DRAW);
  const pos = ctx.getAttribLocation(program, "a_pos");
  ctx.enableVertexAttribArray(pos);
  ctx.vertexAttribPointer(pos, 2, ctx.FLOAT, false, 0, 0);

  const uniform = (name: string) => ctx.getUniformLocation(program, name);
  ctx.uniform3fv(uniform("u_bg"), hexToRgb(palette.bg));
  ctx.uniform3fv(uniform("u_c1"), hexToRgb(palette.bands[0]));
  ctx.uniform3fv(uniform("u_c2"), hexToRgb(palette.bands[1]));
  ctx.uniform3fv(uniform("u_c3"), hexToRgb(palette.bands[2]));
  const uRes = uniform("u_res");
  const uTime = uniform("u_time");

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let raf = 0;
  let lastDraw = 0;

  const draw = (now: number) => {
    ctx.uniform1f(uTime, (now / 1000) * TIME_SCALE);
    ctx.drawArrays(ctx.TRIANGLES, 0, 3);
  };

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const scale = Math.min(dpr, Math.sqrt(MAX_PIXELS / (window.innerWidth * window.innerHeight || 1)));
    const w = Math.max(1, Math.round(window.innerWidth * scale));
    const h = Math.max(1, Math.round(window.innerHeight * scale));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    ctx.viewport(0, 0, w, h);
    ctx.uniform2f(uRes, w, h);
    // Resizing clears the buffer; repaint now instead of waiting for a frame.
    draw(lastDraw);
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
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", sync);
  reducedMotion.addEventListener("change", sync);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", resize);
    document.removeEventListener("visibilitychange", sync);
    reducedMotion.removeEventListener("change", sync);
    ctx.deleteProgram(program);
    ctx.deleteShader(vs);
    ctx.deleteShader(fs);
    ctx.deleteBuffer(buffer);
  };
}

/**
 * Full-viewport animated aurora behind the app, shown only in the aurora
 * themes. Sits at z-index -1, so it shows through the page background and the
 * glass navbar/sidebars only; cards stay solid. Without WebGL the theme's
 * static --bg-image gradient remains.
 */
export function AuroraBackground() {
  const { theme } = useTheme();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const active = isAuroraTheme(theme);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !isAuroraTheme(theme)) return;
    const stop = startAurora(canvas, AURORA_PALETTES[theme]);
    if (!stop) {
      canvas.style.display = "none";
      return;
    }
    canvas.style.display = "";
    return stop;
  }, [theme]);

  if (!active) return null;
  return <canvas ref={canvasRef} aria-hidden className="aurora-canvas" />;
}
