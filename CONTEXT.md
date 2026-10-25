# CubTimer — Domain Glossary

**CubTimer** is the canonical product name (not "CubeTimer").

## Core concepts

- **Session**: A named collection of solves for a specific puzzle type. Has `name`, `puzzleType`, `createdAt`, `endedAt`, and `solves`. Sessions are ordered by `createdAt` descending in the dropdown.
- **Solve**: A single timed attempt. Has `timeMs` (raw), `penalty` (0 = none, n>0 = +2n seconds), `dnf` (did not finish), `scramble`, `dateSec`. Display time = `timeMs + penalty * 2000`.
- **Scramble**: A random-state sequence of moves generated per puzzle type via cubing.js (WCA standard). Stored in the solve record. History is session-scoped; prev/next navigation cycles through all scrambles (used and unused).

## Timer phases

- **idle**: Timer waiting for input.
- **armed**: Hold in progress, waiting for start delay threshold.
- **running**: Timer actively counting.
- **inspection**: WCA-style countdown before the solve (default 15s). Hold-and-release (space or touch, honoring the start delay) starts timing: within the limit = no penalty, within 2s after = +2, later = DNF (recorded automatically when the grace window runs out). Releasing too early returns to inspection.

## Input modes

- **Timer mode**: built-in stackmat-style timer — hold space (or touch-and-hold) past the start delay, release to start, any key/touch to stop.
- **Typing mode**: the user times on an external timer and types the result. Parsed by `parseTypedTime` (`12.34`, `1:02.45`, bare digits `1234` = 12.34, trailing `+` = +2, `DNF`). Saved against the current scramble, then the scramble advances.
- **Zen mode**: timer screen without the session sidebar. Independent of input mode.

## Statistics

- **Mean**: Average of all non-DNF solve times (penalties applied).
- **Median**: Middle value of the same clean solve times (penalties applied). Insensitive to single blow-ups.
- **Ao5 / Ao12**: WCA trimmed average — drop best and worst, mean the rest. Multiple DNFs in window = DNF average.
- **rCV (MAD)**: Robust coefficient of variation — `1.4826 × median(|xᵢ − median|) / median`. Unitless ratio displayed as percentage; lower = more consistent. One large outlier can't wreck it, so it replaces plain std-dev CV as the consistency metric. Computed for ≥3 clean times; backs `consistencyScore` and the chart's `sessionCv`.
- **IQR ratio**: `(Q3 − Q1) / median` (interquartile range over the median), displayed as percentage; requires ≥3 clean times.
- **Std Dev**: Population standard deviation of solve times (penalties applied). Displayed in seconds.

## UI components

- **SessionSidebar**: Desktop fixed panel, mobile slide-in overlay. Contains dropdown picker, stats bar, solve table.
- **SolveTable**: `<table>` with columns #, Time, Ao5, Ao12. Click opens SolveDetailModal.
- **SolveDetailModal**: Shows time, date, scramble, +2/DNF/delete controls. +2 and DNF are mutually exclusive — toggling one clears the other.
- **TimerPage**: Centered scramble display with prev/next arrows, timer (or typed-time input), phase label, and a top-right toolbar for input mode and zen mode. The next arrow generates a fresh scramble once the session's history is exhausted.
- **Start pad**: on touch devices, the visible area of the timer screen where a hold arms the timer. Only holds that begin inside it start a solve; stopping a running solve is not limited to it. Not shown in typing mode or on keyboard/mouse devices.

## Installed app

- **Installed app**: CubTimer launched from the home screen (or as a desktop app) instead of a browser tab. Opens full-screen, in any orientation, and works offline, scrambles included. On iOS it keeps its own browser storage, separate from Safari's, so a signed-out user's solves from Safari are not there.
- **Install button**: shown in the navbar only on a phone that has CubTimer open in a browser tab. Never shown inside the installed app.
- **Fresh-install hint**: a one-time message in the installed app telling a signed-out user with no solves that browser data doesn't carry over, and how to get it back (sign in to sync, or import an export).
