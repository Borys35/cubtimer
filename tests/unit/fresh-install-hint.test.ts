import { describe, it, expect } from "vitest";
import {
  FRESH_INSTALL_HINT_KEY,
  isIosStandalone,
  readHintDismissed,
  shouldRetireFreshInstallHint,
  shouldShowFreshInstallHint,
  writeHintDismissed,
  type FreshInstallState,
} from "@/lib/fresh-install-hint";

const fresh: FreshInstallState = {
  standalone: true,
  authReady: true,
  signedIn: false,
  hydrated: true,
  solveCount: 0,
  dismissed: false,
};

describe("shouldShowFreshInstallHint", () => {
  it("shows in the iOS installed app, signed out, with no solves", () => {
    expect(shouldShowFreshInstallHint(fresh)).toBe(true);
  });

  it.each<[string, Partial<FreshInstallState>]>([
    ["not the installed app", { standalone: false }],
    ["auth still loading", { authReady: false }],
    ["signed in", { signedIn: true }],
    ["sessions not hydrated yet", { hydrated: false }],
    ["has solves", { solveCount: 1 }],
    ["dismissed before", { dismissed: true }],
  ])("hidden when %s", (_, patch) => {
    expect(shouldShowFreshInstallHint({ ...fresh, ...patch })).toBe(false);
  });
});

describe("shouldRetireFreshInstallHint", () => {
  it("does not retire while the hint still applies", () => {
    expect(shouldRetireFreshInstallHint(fresh)).toBe(false);
  });

  it("retires once the user has solves", () => {
    expect(shouldRetireFreshInstallHint({ ...fresh, solveCount: 3 })).toBe(true);
  });

  it("retires once the user signs in", () => {
    expect(shouldRetireFreshInstallHint({ ...fresh, signedIn: true, hydrated: false })).toBe(true);
  });

  it.each<[string, Partial<FreshInstallState>]>([
    ["outside the installed app", { standalone: false, solveCount: 3 }],
    ["before auth resolves", { authReady: false, signedIn: true }],
    ["before sessions hydrate", { hydrated: false, solveCount: 3 }],
    ["already dismissed", { dismissed: true, solveCount: 3 }],
  ])("does not retire %s", (_, patch) => {
    expect(shouldRetireFreshInstallHint({ ...fresh, ...patch })).toBe(false);
  });
});

describe("isIosStandalone", () => {
  it("is true only for navigator.standalone === true", () => {
    expect(isIosStandalone({ standalone: true } as unknown as Navigator)).toBe(true);
    expect(isIosStandalone({ standalone: false } as unknown as Navigator)).toBe(false);
    expect(isIosStandalone({} as Navigator)).toBe(false);
    expect(isIosStandalone(undefined)).toBe(false);
  });
});

describe("dismissal storage", () => {
  it("round-trips through storage", () => {
    const map = new Map<string, string>();
    const storage = {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
    };
    expect(readHintDismissed(storage)).toBe(false);
    writeHintDismissed(storage);
    expect(map.get(FRESH_INSTALL_HINT_KEY)).toBe("1");
    expect(readHintDismissed(storage)).toBe(true);
  });

  it("treats storage that throws as not dismissed, and ignores write errors", () => {
    const broken = {
      getItem: () => {
        throw new Error("SecurityError");
      },
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    expect(readHintDismissed(broken)).toBe(false);
    expect(() => writeHintDismissed(broken)).not.toThrow();
    expect(readHintDismissed(undefined)).toBe(false);
  });
});
