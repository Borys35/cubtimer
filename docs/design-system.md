# Design System

Reference for every visual decision in the CubTimer UI. Change a token here, the whole app updates.

## Design philosophy

Warm precision. The UI should feel like a well-built instrument — not a generic analytics dashboard. Amber accent over cold blue, monospace numbers for the scoreboard, sharp corners (0.5rem), generous whitespace. The cube's own colors appear in charts, not as the primary UI accent.

---

## Color system

All colors are CSS custom properties defined in `src/app/globals.css`. There are six theme scopes: `[data-theme="dark"]`, `[data-theme="light"]`, and the aurora themes `[data-theme="borealis"]`, `[data-theme="nebula"]`, `[data-theme="ember"]`, and `[data-theme="ascii"]`. Changing a hex value here changes it everywhere that token is used.

### Core palette (dark theme shown)

| Token          | Hex       | Usage                                 |
| -------------- | --------- | ------------------------------------- |
| `--bg`         | `#0B0E11` | Page background                       |
| `--surface`    | `#141920` | Card/panel background                 |
| `--surface-2`  | `#1B2128` | Inner containers, code blocks         |
| `--surface-3`  | `#232B35` | Hover states, subtle fills            |
| `--border`     | `#2C3540` | Card borders, dividers                |
| `--text`       | `#E8E6E1` | Primary text                          |
| `--text-dim`   | `#7D8590` | Secondary text, labels                |
| `--text-faint` | `#4E5760` | Tertiary text, captions               |
| `--track`      | `#1E2530` | Progress bar backgrounds, gauge track |

### Accent colors

| Token         | Hex       | Usage                                                          |
| ------------- | --------- | -------------------------------------------------------------- |
| `--amber`     | `#E5A126` | Primary accent — buttons, links, active states, frequency axis |
| `--amber-dim` | `#B8801F` | Hover state for amber elements                                 |
| `--green`     | `#2DA44E` | Positive signals — PB badges, "good" tier                      |
| `--red`       | `#CF4B4B` | Alerts — DNFs, "horrible" tier, projection line                |

### Cube sticker colors

Used in chart series and the 3x3 hero grid. These represent the actual physical cube.

| Token           | Hex       | Face   |
| --------------- | --------- | ------ |
| `--cube-red`    | `#ea3323` | Red    |
| `--cube-orange` | `#ff5800` | Orange |
| `--cube-yellow` | `#ffd500` | Yellow |
| `--cube-green`  | `#00a651` | Green  |
| `--cube-blue`   | `#0057c8` | Blue   |
| `--cube-white`  | `#f8fafc` | White  |

### Stat chip colors

Each stat chip in the quick-stats grid gets its accent-bar color via `--chip1` through `--chip9`.

| Token     | Dark value | Chip                 |
| --------- | ---------- | -------------------- |
| `--chip1` | `#E5A126`  | Solves in range      |
| `--chip2` | `#38bdf8`  | DNFs                 |
| `--chip3` | `#2DA44E`  | Abandoned            |
| `--chip4` | `#CF4B4B`  | Current level        |
| `--chip5` | `#818cf8`  | Best single          |
| `--chip6` | `#E8E6E1`  | Active days          |
| `--chip7` | `#2DD4BF`  | Sub-X                |
| `--chip8` | `#38bdf8`  | Best ao5 (all time)  |
| `--chip9` | `#818cf8`  | Best ao12 (all time) |

### Chart series colors

| Token                | Hex       | Series                       |
| -------------------- | --------- | ---------------------------- |
| `--series-raw`       | `#9CA3AF` | Session scatter dots         |
| `--series-ao5`       | `#38bdf8` | Reserved (unused)            |
| `--series-ao12`      | `#818cf8` | 5-session rolling avg line   |
| `--series-ao100`     | `#34d399` | Reserved (unused)            |
| `--series-trend`     | `#E5A126` | Fitted trend line (amber)    |
| `--series-proj`      | `#CF4B4B` | Projection dashed line (red) |
| `--chart-bg`         | `#141920` | Chart plot area background   |
| `--chart-grid`       | `#1E2530` | Grid lines                   |
| `--chart-tick`       | `#7D8590` | Axis labels                  |
| `--chart-volume`     | `#232B35` | Volume bar fill              |
| `--chart-tooltip-bg` | `#1B2128` | Tooltip background           |

### Axis semantic colors

Used in prescription cards and sub-score bars via CSS classes:

| Class               | `--axis`           | `--axis-text`  | Meaning            |
| ------------------- | ------------------ | -------------- | ------------------ |
| `.axis-improvement` | `var(--cube-red)`  | `#ff6b62`      | Improvement metric |
| `.axis-consistency` | `var(--cube-blue)` | `#5b9bff`      | Consistency metric |
| `.axis-frequency`   | `var(--amber)`     | `var(--amber)` | Frequency metric   |

### ASCII theme

`ascii` is a dark theme over an animated ASCII backdrop (`AsciiBackground.tsx`, a 2D `<canvas class="ascii-canvas">` at `z-index: -1`, 15 fps):

- **Cubes**: three 3x3 cubes turn and drift slowly near the corners, clear of the scramble and timer. Each character cell casts a ray at the cube; a hit is drawn in the sticker's color with a character from the ramp `:=+*#%@` by how much the face is lit. Gaps between stickers stay empty.
- **Algorithms**: real algorithms (`R U R' U'`, PLLs, OLLs) type themselves out at random cells in JetBrains Mono, hold, then fade. They are kept very faint so they are never mistaken for the real scramble.
- Same rules as the aurora: visible only through the page background and the glass navbar/sidebars (`--glass-blur` is a light 5px so characters stay recognisable), paused while the tab is hidden, a still frame under `prefers-reduced-motion`.

### Light theme overrides

The light theme redefines the same tokens with lighter values. Key differences:

- `--bg: #F5F3EF` (warm off-white, not pure white)
- `--surface: #FFFFFF`
- `--amber: #B87A10` (darker for contrast on light backgrounds)
- `--text: #1A1A1A`

### Aurora themes

Three dark themes — `borealis` (green / teal / violet), `nebula` (purple / pink / blue) and `ember` (orange / rose / amber) — drawn over an animated aurora. Each block in `globals.css` overrides the surfaces, text, accent (`--amber`) and chart tokens; everything else inherits the dark values from `:root`.

- **Aurora**: `AuroraBackground.tsx` renders one full-viewport `<canvas class="aurora-canvas">` (`position: fixed`, `z-index: -1`) with a WebGL fragment shader — no library. It draws curtains of thin rays with a soft glowing lower rim over a starry sky, spread over the whole viewport height, at device-pixel resolution (up to 2x, capped at 4 MP) and 30 fps, drifting slowly (`TIME_SCALE`); it pauses while the tab is hidden and shows a single still frame under `prefers-reduced-motion`. Its colors come from `AURORA_PALETTES` in `src/lib/theme.ts`; `bg` there must equal the theme's `--bg`.
- **Fallback**: `--bg-image` holds static radial gradients in the same colors, shown before the canvas mounts and when WebGL is unavailable.
- **Glass**: the aurora is visible only through the page background, the navbar and the session sidebars. Those use `.glass` (sidebars: `--glass-bg` tint + `--glass-blur` backdrop blur) or `.glass-tint` (navbar: tint only). Both fall back to solid `--surface` in dark and light. The navbar skips the blur because `backdrop-filter` would make it the containing block for its `position: fixed` modals. Cards, chips and modals stay solid.

---

## Typography

Two font families loaded via Google Fonts in `globals.css`:

### Font families

| Variable      | Font           | Fallback                | Usage                             |
| ------------- | -------------- | ----------------------- | --------------------------------- |
| `--font-sans` |                | system-ui, sans-serif   | Body text, headings, labels       |
| `--font-mono` | JetBrains Mono | ui-monospace, monospace | Score displays, time values, data |

### Usage rules

- **JetBrains Mono**: Use `font-mono` class or `fontFamily: "var(--font-mono)"` for any numeric display — scores, times, percentages, rCV (MAD) values. Tabular figures keep columns aligned.
- **DM Sans**: Use `font-sans` class (default body font) for everything else — headings, paragraph text, labels, button text.

### Type scale (approximate)

| Element                | Size                    | Weight        | Font           |
| ---------------------- | ----------------------- | ------------- | -------------- |
| Page title (upload)    | `text-4xl` / `text-5xl` | 700           | DM Sans        |
| Page title (dashboard) | `text-xl`               | 700           | DM Sans        |
| Scoreboard score       | 48px (SVG)              | 700           | JetBrains Mono |
| Section headings       | `text-sm`               | 600 uppercase | DM Sans        |
| Card body text         | `text-xs` / `text-sm`   | 400           | DM Sans        |
| Stat chip label        | `text-[10px]`           | 400 uppercase | DM Sans        |
| Stat chip value        | `text-base`             | 400           | JetBrains Mono |
| Filter labels          | `text-[11px]`           | 400           | DM Sans        |
| Tier pill              | `text-[0.7rem]`         | 700 uppercase | DM Sans        |
| Timer display          | `text-9xl`              | 700           | JetBrains Mono |
| Scramble text          | `text-[36px]`           | 500           | DM Sans        |
| Timer phase label      | `text-xl`               | 400           | DM Sans        |
| Timer info             | `text-base`             | 400           | DM Sans        |

---

## Components

### Card (`.card`)

The base container for all grouped content.

```css
background: var(--surface);
border: 1px solid var(--border);
border-radius: 0.5rem;
```

Used everywhere: scoreboard hero, stat chips, prescription cards, chart wrapper, session list, filter controls. Add `card` class to any container for consistent surface treatment.

### Stat chip (`.stat-chip`)

Small data cards in the quick-stats grid. Has a 4px left accent bar via `::before` pseudo-element. Color set via inline style `--chip`. An optional `title` explains the value (the Sub-X chip states its formula).

```jsx
<div
  className="stat-chip p-2.5 pl-3.5"
  style={{ "--chip": "var(--chip1)" }}
>
  <div className="chip-label text-[10px] uppercase tracking-wide text-[var(--text-faint)]">
    Label
  </div>
  <div className="mt-0.5 font-mono text-base text-[var(--text)]">Value</div>
</div>
```

### Tier pill (`.tier-pill`)

Colored badge showing the verdict等级. Modifier classes: `.tier-pill-good`, `.tier-pill-decent`, `.tier-pill-bad`, `.tier-pill-horrible`.

| Class                 | Background           | Text             |
| --------------------- | -------------------- | ---------------- |
| `.tier-pill-good`     | `var(--green)`       | white            |
| `.tier-pill-decent`   | `var(--amber)`       | `#0B0E11` (dark) |
| `.tier-pill-bad`      | `var(--cube-orange)` | white            |
| `.tier-pill-horrible` | `var(--red)`         | white            |

### Score hero (`.score-hero`)

The main scoreboard layout. Flexbox: column on mobile, row on desktop (768px+). Contains the gauge ring on the left and sub-score bars on the right.

```jsx
<div className="card score-hero">
  <div className="score-hero-gauge">/* gauge ring + tier pill */</div>
  <div className="score-hero-bars">/* sub-score bars */</div>
</div>
```

Override the gauge width on desktop by targeting `.score-hero-gauge` (default: `flex: 0 0 220px`).

### Gauge ring

SVG component in `ScoreboardHero.tsx`. A circular progress indicator:

- Viewbox: 200x200
- Radius: 82
- Stroke width: 10
- Track color: `var(--track)`
- Fill color: dynamic based on tier (green/amber/orange/red)
- Score text: 48px JetBrains Mono at `--text` color
- "/100" label: 13px DM Sans at `--text-dim` color
- Animation: `stroke-dashoffset` transitions over 0.8s with `cubic-bezier(0.22, 1, 0.36, 1)`

### Sub-score bar

Progress bar for each scoring axis. Consists of:

1. Label row: axis name (left) + score/100 with weight (right, mono)
2. Track: 8px height, `var(--track)` background, fully rounded
3. Fill: colored by axis, animated width transition (0.6s)

Colors per axis:

- Improvement: `var(--cube-red)`
- Consistency: `var(--cube-blue)`
- Frequency: `var(--amber)`

### Prescription card

A `.card` with a 3px left border colored by axis via `--axis` variable. Applied via `.prescription-card` class + axis class (e.g., `.axis-improvement`).

### Hero tile (`.hero-tile`)

Individual cube face in the 3x3 upload grid. Inset shadows create a 3D tile effect. On hover, tiles tilt and scale via CSS custom properties `--tilt` and `--scale`.

```css
border-radius: 0.4rem;
box-shadow:
  inset 0 -3px 0 rgba(0, 0, 0, 0.25),
  inset 0 2px 0 rgba(255, 255, 255, 0.22);
```

### Timer page

Full-height centered layout. Elements stacked vertically:

1. **Scramble**: `text-lg sm:text-[28px] md:text-[36px] font-medium opacity-70`, max-w-4xl, centered, wraps (`min-w-0 break-words`). Capped at `max-h-[35vh]` and scrolls inside itself, so long (6x6/7x7) scrambles can't squeeze the timer
2. **Timer display**: `text-7xl sm:text-8xl md:text-9xl font-mono font-bold`, color varies by phase:
   - idle: `var(--text)` (default)
   - armed (hold < threshold): `var(--red)`
   - armed (hold ≥ threshold): `var(--green)`
   - running with blind mode: shows "Solving..." instead of time
3. **Phase label**: `text-xl opacity-40` — "Hold here to start" on coarse pointers, "Press spacebar to start" otherwise
4. **Info line**: `text-base opacity-30` (puzzle type · session name)
5. **Sessions button**: `absolute top-3 left-3`, mobile only, disabled during solve, hidden in zen mode. Bulleted-list icon, so it doesn't look like the navbar's ☰ Nav menu
6. **Toolbar**: `absolute top-3 right-3` — input-mode toggle (timer ↔ typing) and zen toggle; fades out (`opacity-0 pointer-events-none`) while armed/running/inspecting

**Typing mode** (`settings.inputMode === "typing"`) replaces the timer display + phase label with a large `font-mono` text input (`text-6xl sm:text-8xl`, bottom border turns `--amber` on focus, `--red` on parse error). Enter (or the mobile-only Save button) records the time against the current scramble. While typing, digits are masked live by `formatTypedInput` (decimal point and minute colon placed automatically: `1234` shows as `12.34`, `10245` as `1:02.45`); a trailing `+` marks +2 and text with letters (`DNF`) is left raw.

**Zen mode** (`settings.zenMode`) unmounts the session sidebar and hides the sessions button.

**Start pad** (`.start-pad`, coarse pointer + timer mode only): the layout switches from centered to top-aligned (`pt-14 pb-4`, clearing the sessions button/toolbar). Below the scramble row a `flex-1` rounded box (`border-radius: 1rem`, 2px border) holds the timer display, phase label and info line. Look is driven by `data-state`:

- `idle` (also during inspection): dashed `--border`, `--surface` at 70%, tap-target icon above the time
- `holding` (armed, hold < threshold): solid `--red` border, `--red` 12% fill
- `ready` (armed, hold ≥ threshold): solid `--green` border, `--green` 14% fill
- `running`: border and fill transparent

Border/fill transition 0.15s, disabled under reduced motion. Not rendered in typing mode or on fine pointers.

**Fresh-install hint** (`FreshInstallHint.tsx`): a `.card` banner (`w-full max-w-4xl mb-4 px-4 py-3 text-sm`) between the scramble row and the timer/start pad. Body text `--text-dim`; actions "Sign in" (only when sync is configured) and "Import" are `--amber` text buttons; an `×` dismiss button sits top right in `--text-faint`. Shown only in the iOS installed app to a signed-out user with no solves, once (`localStorage` key `cstimer-analyzer:fresh-install-hint-dismissed`). It is `data-no-timer` and outside the start pad, so tapping it never arms; while armed/running/inspecting it fades out (`opacity-0 pointer-events-none`) keeping its space so the timer doesn't jump.

**Last-solve actions** (`LastSolveActions.tsx`): after a solve finishes on this screen, a row of +2 / DNF toggles (`px-4 py-2 rounded text-sm font-medium`, `--surface-3` fill; active +2 is `--amber` text on `--amber` 20%, active DNF `--red` on `--red` 20%, `aria-pressed`) and a trash-icon "Delete last solve" button (`--text` at 50%, `--red` on hover). Deleting shows the "Solve deleted" toast with Undo. +2 and DNF are mutually exclusive. The timer display shows the result with penalties (`12.34+`, `DNF`; typing mode shows it as the input placeholder). Placed under the timer display on fine pointers, under the start pad on phones, and under the input in typing mode; it reserves its `h-11` row even when empty so nothing jumps. Hidden while armed/running/inspecting, before the first solve on this screen, and after switching session. The row is `data-no-timer` and outside the start pad, so taps never arm.

**Keep screen awake** (`settings.keepAwake`, default on): `useWakeLock` holds a Screen Wake Lock while the timer page is mounted, re-requesting it when the tab becomes visible again. Silently skipped where the API is missing or the request is denied.

**Touch surface** (`.timer-pad`): native non-passive touch listeners. Touches starting on buttons, inputs or `[data-no-timer]` (scramble row, toolbar) never arm. When the start pad is rendered, only touches that begin inside it arm. Multi-touch and drift beyond 12px cancel an arm. While running, any touch stops. CSS sets `touch-action: manipulation`, no callout, no tap highlight.

### Session sidebar

Desktop: fixed `w-64` panel on the left, `.glass`, `border-r border-[var(--border)]`.
Mobile: slide-in overlay from left (`fixed inset-y-0 left-0`, `.glass`), toggled by the sessions button. Creating a session from the puzzle picker closes it.

Structure (top to bottom):

1. **Dropdown button**: shows active session name · puzzle type · solve count
2. **Dropdown menu**: all sessions sorted newest-first, each showing name + puzzle + count
3. **Stats bar**: 2-column × 5-row grid — Best, Mean, Median, Std Dev, rCV (MAD), IQR, Best Ao5, Best Ao12, Ao5, Ao12. Best/Mean/Median and the Ao rows are times; Std Dev is seconds; rCV (MAD) and IQR are percentages. rCV/IQR render only with ≥3 clean solves.
4. **Solve list**: all solves (scrollable), each with time, +2/DNF/delete buttons. Time, Ao5 and Ao12 cells that were a personal best when set stay colored (green / blue / purple): the current best is bold, ex-bests normal weight (`pbHistory` in `src/lib/stats.ts`).

Auto-collapse: sidebar width → 0 during armed/running phases and in zen mode (300ms transition).

### Navbar

Fixed top bar: `glass-tint border-b border-[var(--border)] shrink-0`.
Left: "CubTimer" brand link (class `logo-hover`). Right, `md` and up: Timer/Stats/Settings links + ThemeToggle + AccountMenu.

Below `md`: logo | Install button | AccountMenu | ☰ **Nav menu** button (`h-8 w-8`, icon turns into ✕ while open). The Nav menu is a full-width dropdown under the navbar (`absolute top-full`, `--surface`, bottom border, `shadow-2xl`, `z-50`) listing Timer/Stats/Settings (`py-2.5` rows, `--surface-3` hover) and, under a divider, the ThemeToggle. It closes on link tap, outside tap and Escape. Its state lives in `Navbar.tsx`, not in `MenuContext` (that is the session sidebar).

**Install button** (`InstallButton.tsx`, logic in `src/lib/use-install.ts`): `.card` pill like Sign in, `--amber` text with a download icon. Rendered only on a phone (`(pointer: coarse)` and narrower than 768px, checked after mount) in a browser tab (not `display-mode: standalone`, not `navigator.standalone`), and only where install works: a captured `beforeinstallprompt` (tap shows the native prompt; hidden after `appinstalled`) or iOS (tap opens a bottom sheet: "Tap [share icon] Share, then Add to Home Screen", closed by Got it / backdrop / Escape). Never dismissable.

Brand logo (`Navbar.tsx`):

- Mobile: `logo.svg` at 34×28, `md:hidden`
- Desktop: `logo-dark.svg` / `logo-light.svg` (theme-aware) at 130×28 with `h-[28px] w-auto`, `hidden md:block`

Logo hover eyes: two `.logo-eye-overlay` spans sit over the cube's eyes inside the link. Mobile placement `left-[45%]` / `left-[65%]`, `top-[29%]`, `w-[9%] h-[39%]`; desktop `md:left-[12%]` / `md:left-[17%]`, `md:top-[34%]`, `md:w-[2.3%] md:h-[29%]`. Rounded dark squares, `pointer-events: none`, `opacity` transition 0.2s. `.logo-hover:hover .logo-eye-overlay { opacity: 0 }` hides the eyes on hover.

Favicon: `src/app/icon.svg` is `public/logo.svg` (the cube mark) with a square `viewBox="0 -6 68 68"` so it centers in browser tabs; Next.js links it automatically. `src/app/apple-icon.tsx` renders the same SVG at 132px on a 180×180 `#0B0E11` tile as the PNG iOS home-screen icon (iOS doesn't accept SVG there). Change the logo in both `public/logo.svg` and `src/app/icon.svg`.

PWA icons: `src/app/icons/[file]/route.tsx` renders `icon-192.png`, `icon-512.png` (logo at 132/180 of the tile, like the apple icon) and `icon-512-maskable.png` (logo at 56%, so its whole box sits inside the 80% maskable safe circle) at build time. Apple and PWA icons share `renderAppIcon` in `src/lib/appIcon.tsx`. The manifest (`src/app/manifest.ts`) uses `#0B0E11` for `background_color` and `theme_color`; the `theme-color` meta is `#0B0E11` for dark and `#F5F3EF` (light `--bg`) for light `prefers-color-scheme`.

### Safe areas

The installed iOS app uses `viewport-fit=cover` and a `black-translucent` status bar, so the page draws under the notch and home indicator. Classes in `globals.css` pad with `env(safe-area-inset-*)` (0 on desktop and in normal browser tabs):

- `.safe-area-nav` (Navbar): top inset added to `py-2`; left/right `max(1rem, inset)`
- `.safe-area-content` (layout content area): left/right/bottom insets, so the start pad and page bottoms clear the home indicator and landscape notch
- `.safe-area-sidebar` (mobile slide-in sidebar): top/bottom/left insets, `--surface` fill
- `.safe-area-toast` (Toast): bottom/right offsets include the insets

---

## Layout

### Page structure

```
Layout (all pages):
  Navbar (fixed top)
  Content area (flex-1 overflow-auto)

Timer page (/):
  Flex row: Sidebar (w-64, collapses to 0 during solve) + TimerPage (flex-1)
  TimerPage: centered column — scramble, timer display, phase label, info
  Mobile: sessions button in timer container, sidebar slides in from left

Stats page (/stats):
  Dashboard component (full width, no sidebar)

Settings page (/settings):
  Settings form (max-w-2xl centered)
```

### Breakpoints

Uses Tailwind defaults:

| Prefix | Width   | Usage                                                           |
| ------ | ------- | --------------------------------------------------------------- |
| (none) | < 640px | Mobile — single column, stacked layout                          |
| `sm:`  | 640px+  | Small desktop — slightly larger tiles/padding                   |
| `lg:`  | 1024px+ | Large desktop — 2-column prescription grid, 3-column stat chips   |

### Key layout classes

| Element            | Mobile           | Desktop                          |
| ------------------ | ---------------- | -------------------------------- |
| Score hero         | Column (stacked) | Row (gauge left, bars right)     |
| Prescription cards | Single column    | 2-column grid (`lg:grid-cols-2`) |
| Quick stats        | 2-column grid    | 3-column grid (`sm:grid-cols-3`) |
| Filter bar         | Wrapping flex    | Single row                       |

### Spacing

- Page padding: `px-4` mobile, `sm:px-6` desktop
- Section gaps: `mb-5` (1.25rem) between major sections
- Card internal padding: `p-3.5` to `p-4` depending on card type
- Stat chip padding: `p-2.5 pl-3.5` (extra left for accent bar)

---

## Theming

### How it works

1. Theme is stored in `localStorage` under key `cta-theme`
2. Applied as `data-theme` attribute on `<html>`
3. CSS variables in `globals.css` are scoped to one `[data-theme="…"]` block per theme
4. A no-flash script in `layout.tsx` reads localStorage before paint to prevent flicker
5. System preference (`prefers-color-scheme`) is used as default on first visit

### Theme cycle

Dark → Light → Borealis → Nebula → Ember → ASCII → Dark (via `ThemeToggle` component)

### Adding a new theme

1. Add `"newtheme"` to the `Theme` type in `src/lib/theme.ts`
2. Add it to the `THEMES` array
3. Add a `[data-theme="newtheme"] { ... }` block in `globals.css` with all token overrides
4. Add its label to `THEME_LABELS` and its icon in `ThemeToggle.tsx`; persistence picks it up automatically
5. For an aurora theme, also add it to `AuroraTheme` and `AURORA_PALETTES`, and define `--glass-bg`, `--glass-blur` and a `--bg-image` fallback in its block

### Chart palette

Charts read their colors at runtime via `readChartPalette()` in `src/lib/theme.ts`. It reads `--chart-*` and `--series-*` CSS variables from the computed style. This means chart colors automatically follow the active theme.

If you add new chart series, add corresponding `--series-*` tokens in every theme block and extend the `ChartPalette` interface.

---

## Animation

### Current animations

| Element          | Property            | Duration | Easing                              | Reduced motion          |
| ---------------- | ------------------- | -------- | ----------------------------------- | ----------------------- |
| Gauge ring fill  | `stroke-dashoffset` | 0.8s     | `cubic-bezier(0.22, 1, 0.36, 1)`    | Respected               |
| Score bar fill   | `width`             | 0.6s     | `cubic-bezier(0.22, 1, 0.36, 1)`    | Respected               |
| Hero tile hover  | `transform`         | 0.35s    | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Respected               |
| Body background  | `background-color`  | 0.2s     | `ease`                              | Not explicitly disabled |
| Sidebar collapse | `width`             | 0.3s     | `ease`                              | Not explicitly disabled |
| Mobile sidebar   | `transform`         | 0.2s     | `ease`                              | Not explicitly disabled |
| Timer color      | `color`             | 0.15s    | `ease`                              | Not explicitly disabled |

### Reduced motion

All animated elements are wrapped in:

```css
@media (prefers-reduced-motion: reduce) {
  .hero-tile {
    transition: none;
  }
  .score-bar-fill {
    transition: none;
  }
}
```

The gauge ring transition is set via inline `style` attribute — to disable it for reduced motion, add a CSS rule targeting the SVG circle or move the transition to a class.

---

## How to make common changes

### Change the primary accent color

1. Update `--amber` and `--amber-dim` in every theme block in `globals.css`
2. Update `--chip1` if you want the first stat chip to match
3. Update `--series-trend` if you want the trend line to match
4. The `.axis-frequency` class also uses `--amber`

### Change the card style

Edit the `.card` rule in `globals.css`. Current: 0.5rem radius, 1px border, `var(--surface)` background.

### Change the scoreboard gauge

Edit the `GaugeRing` function in `src/components/ScoreboardHero.tsx`. Key values: radius (82), stroke width (10), viewBox (200x200), font sizes (48px score, 13px label).

### Add a new stat chip

1. Add a new `--chipN` token in the dark and light blocks (aurora themes inherit dark's)
2. Add the chip to the array in `Dashboard.tsx` in the quick-stats section
3. Reference it with `style={{ "--chip": "var(--chipN)" }}`

### Change typography

1. Swap the Google Fonts import URL in `globals.css`
2. Update `--font-sans` and/or `--font-mono` in `:root`
3. All components reference these via `font-sans`/`font-mono` Tailwind classes or `var(--font-*)` in inline styles

### Modify the chart

The chart uses Recharts components in `Dashboard.tsx`. Series are toggled by pill buttons above the plot (Sessions, 5-session avg, Trend + projection, Volume) instead of a Recharts legend; defaults are Sessions + Trend, and the viewer's choice is kept in `localStorage` under `cta-chart-series`. All chart-related CSS tokens are `--chart-*` and `--series-*`. The chart reads colors at runtime via `readChartPalette()`, so changing the CSS variables is all that's needed.

### Adjust responsive behavior

The `.score-hero` layout is the only component using custom CSS for responsive behavior (media query at 768px). All other responsive layouts use Tailwind's `sm:` and `lg:` prefixes. To change breakpoints, update the `@media` query in the `.score-hero` block or the Tailwind classes in components.

---

## File reference

| File                                   | What it controls                                                   |
| -------------------------------------- | ------------------------------------------------------------------ |
| `src/app/globals.css`                  | All color tokens, typography imports, component styles, animations |
| `src/app/layout.tsx`                   | HTML structure, no-flash theme script, metadata, providers         |
| `src/app/icon.svg`                     | Favicon (square copy of `public/logo.svg`)                         |
| `src/app/apple-icon.tsx`               | 180×180 PNG home-screen icon rendered from `icon.svg` at build     |
| `src/app/page.tsx`                     | Timer page layout — sidebar + timer, auto-collapse logic           |
| `src/lib/theme.ts`                     | Theme type, localStorage persistence, chart palette reader         |
| `src/lib/use-timer.ts`                 | Timer phase machine, scramble generation, keyboard/touch handlers  |
| `src/lib/use-wake-lock.ts`             | Screen Wake Lock while the timer page is open                      |
| `src/lib/types.ts`                     | TimerSettings, TimerSession, TimerSolve types                      |
| `src/components/TimerPage.tsx`         | Timer display, scramble, blind mode, sessions button                |
| `src/components/LastSolveActions.tsx`  | +2 / DNF / delete for the just-finished solve on the timer screen   |
| `src/components/TimerPhaseContext.tsx` | Shares timer phase between TimerPage and page layout               |
| `src/components/SessionSidebar.tsx`    | Dropdown picker, stats bar, solve list, session management         |
| `src/components/Navbar.tsx`            | Top navigation bar, page links, theme toggle, phone Nav menu      |
| `src/components/InstallButton.tsx`     | Phone Install button and iOS Add to Home Screen sheet              |
| `src/lib/use-install.ts`               | Install button decision: phone, standalone, beforeinstallprompt, iOS |
| `src/components/MenuContext.tsx`       | Mobile sidebar open/close state                                    |
| `src/components/ThemeProvider.tsx`     | Theme context, cycle function, localStorage persistence            |
| `src/components/ScoreboardHero.tsx`    | Gauge ring SVG, score display, sub-score bars                      |
| `src/components/Dashboard.tsx`         | Upload screen, filter bar, chart, prescriptions, sessions          |
| `src/components/StatsPage.tsx`         | Per-session stat cards, session solve table, import/export         |
| `src/components/Toast.tsx`             | Toast notification with optional undo action                       |
| `src/components/UpdateToast.tsx`       | "New version available" toast with Reload; only while timer idle   |
| `src/lib/stats.ts`                     | Statistics — median, rollingAverage, madCv, iqrCv, bucketing, trend/projection, analyze |
| `src/lib/chartData.ts`                 | Chart row aggregation — per-session mean/std/CV, rolling averages, trend, projection, volume |
