"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

/** Chromium's install prompt event (not in lib.dom). */
export interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/** What tapping the Install button does, or `null` when it's hidden. */
export type InstallMode = "prompt" | "ios" | null;

export const PHONE_QUERY = "(pointer: coarse) and (max-width: 767.98px)";
export const STANDALONE_QUERY = "(display-mode: standalone)";

/**
 * iPhone/iPod/iPad, including iPadOS 13+ which reports itself as a Mac:
 * a "Macintosh" UA with touch points is an iPad (real Macs report 0).
 */
export function isIOS(ua: string, maxTouchPoints: number): boolean {
  if (/iPhone|iPad|iPod/.test(ua)) return true;
  return /Macintosh/.test(ua) && maxTouchPoints > 1;
}

/** Running as the Installed app: display-mode media query, or iOS's legacy flag. */
export function isStandalone(displayModeStandalone: boolean, navigatorStandalone: unknown): boolean {
  return displayModeStandalone || navigatorStandalone === true;
}

/**
 * Decide the Install button. Shown only on a phone in a browser tab, and only
 * where installing is possible: a captured `beforeinstallprompt` (Chrome/Edge
 * on Android) or iOS.
 *
 * iOS counts regardless of browser: since iOS 16.4, Chrome (CriOS), Firefox
 * (FxiOS) and Edge on iOS can also Add to Home Screen from their share sheet,
 * and they are all WebKit underneath, so the same instructions apply. In-app
 * webviews (Instagram etc.) can't, but they are not reliably detectable and
 * the instructions are harmless there.
 *
 * Android Chrome is preferred over the iOS sheet when both are somehow true.
 */
export function installMode(s: {
  phone: boolean;
  standalone: boolean;
  installed: boolean;
  hasPrompt: boolean;
  ios: boolean;
}): InstallMode {
  if (!s.phone || s.standalone || s.installed) return null;
  if (s.hasPrompt) return "prompt";
  if (s.ios) return "ios";
  return null;
}

// --- beforeinstallprompt store -------------------------------------------
// The event can fire before React hydrates, so capture it as soon as this
// module loads on the client instead of waiting for a component effect.

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let appInstalled = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // keep Chrome's mini-infobar away; we prompt from the button
    deferredPrompt = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    appInstalled = true;
    emit();
  });
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

function useMatchMedia(query: string): boolean {
  // false until mounted, so server markup and the first client render agree.
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(query);
    const update = () => setMatches(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [query]);
  return matches;
}

/** Install button state for the navbar: `mode` to render, `install()` on tap (prompt mode). */
export function useInstall() {
  const phone = useMatchMedia(PHONE_QUERY);
  const displayStandalone = useMatchMedia(STANDALONE_QUERY);
  const [env, setEnv] = useState({ ios: false, navStandalone: false });
  const hasPrompt = useSyncExternalStore(subscribe, () => deferredPrompt !== null, () => false);
  const installed = useSyncExternalStore(subscribe, () => appInstalled, () => false);

  useEffect(() => {
    setEnv({
      ios: isIOS(navigator.userAgent, navigator.maxTouchPoints ?? 0),
      navStandalone: isStandalone(false, (navigator as { standalone?: unknown }).standalone),
    });
  }, []);

  const mode = installMode({
    phone,
    standalone: isStandalone(displayStandalone, env.navStandalone),
    installed,
    hasPrompt,
    ios: env.ios,
  });

  const install = useCallback(async () => {
    const e = deferredPrompt;
    if (!e) return;
    await e.prompt();
    const { outcome } = await e.userChoice;
    // A prompt can only be used once. Chrome fires a fresh beforeinstallprompt
    // later if the user dismissed it; on accept, appinstalled hides the button.
    deferredPrompt = null;
    if (outcome === "accepted") appInstalled = true;
    emit();
  }, []);

  return { mode, install };
}
