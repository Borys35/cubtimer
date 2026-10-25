/**
 * Fresh-install hint (see CONTEXT.md): on iOS the installed app keeps its own
 * browser storage, so a signed-out user's Safari solves aren't there. Tell
 * them once how to bring them over.
 */

export const FRESH_INSTALL_HINT_KEY = "cstimer-analyzer:fresh-install-hint-dismissed";

export interface FreshInstallState {
  /** `navigator.standalone === true`: running as the installed app on iOS. */
  standalone: boolean;
  /** Auth has resolved, so `signedIn` is meaningful. */
  authReady: boolean;
  signedIn: boolean;
  /** Session data has loaded, so `solveCount` is meaningful. */
  hydrated: boolean;
  /** Solves across all sessions. */
  solveCount: number;
  /** The hint was dismissed (or retired) before. */
  dismissed: boolean;
}

export function shouldShowFreshInstallHint(s: FreshInstallState): boolean {
  return s.standalone && s.authReady && !s.signedIn && s.hydrated && s.solveCount === 0 && !s.dismissed;
}

/**
 * The hint is no longer needed for good: the user signed in or has solves in
 * the installed app. Remember that so it doesn't come back if they later sign
 * out or clear their solves.
 */
export function shouldRetireFreshInstallHint(s: FreshInstallState): boolean {
  if (!s.standalone || !s.authReady || s.dismissed) return false;
  return s.signedIn || (s.hydrated && s.solveCount > 0);
}

/** iOS Safari's non-standard flag; undefined everywhere else. */
export function isIosStandalone(nav: Navigator | undefined = globalThis.navigator): boolean {
  return (nav as (Navigator & { standalone?: boolean }) | undefined)?.standalone === true;
}

export function readHintDismissed(storage: Pick<Storage, "getItem"> | undefined): boolean {
  try {
    return storage?.getItem(FRESH_INSTALL_HINT_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeHintDismissed(storage: Pick<Storage, "setItem"> | undefined): void {
  try {
    storage?.setItem(FRESH_INSTALL_HINT_KEY, "1");
  } catch {}
}
