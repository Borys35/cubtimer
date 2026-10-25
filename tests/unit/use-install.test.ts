import { describe, it, expect } from "vitest";
import { installMode, isIOS, isStandalone } from "@/lib/use-install";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const IPHONE_CHROME =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0.6478.54 Mobile/15E148 Safari/604.1";
const IPADOS_AS_MAC =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36";

describe("isIOS", () => {
  it("detects iPhone Safari and other iOS browsers", () => {
    expect(isIOS(IPHONE_SAFARI, 5)).toBe(true);
    expect(isIOS(IPHONE_CHROME, 5)).toBe(true);
  });

  it("detects iPadOS reporting as a Mac by its touch points", () => {
    expect(isIOS(IPADOS_AS_MAC, 5)).toBe(true);
    expect(isIOS(IPADOS_AS_MAC, 0)).toBe(false); // a real Mac
  });

  it("is false on Android", () => {
    expect(isIOS(ANDROID_CHROME, 5)).toBe(false);
  });
});

describe("isStandalone", () => {
  it("is true for display-mode standalone or navigator.standalone === true", () => {
    expect(isStandalone(true, undefined)).toBe(true);
    expect(isStandalone(false, true)).toBe(true);
  });

  it("is false in a browser tab", () => {
    expect(isStandalone(false, undefined)).toBe(false);
    expect(isStandalone(false, false)).toBe(false);
    expect(isStandalone(false, "true")).toBe(false);
  });
});

describe("installMode", () => {
  const base = { phone: true, standalone: false, installed: false, hasPrompt: false, ios: false };

  it("uses the native prompt when beforeinstallprompt was captured", () => {
    expect(installMode({ ...base, hasPrompt: true })).toBe("prompt");
  });

  it("shows the iOS sheet on iOS", () => {
    expect(installMode({ ...base, ios: true })).toBe("ios");
  });

  it("prefers the native prompt over the iOS sheet", () => {
    expect(installMode({ ...base, ios: true, hasPrompt: true })).toBe("prompt");
  });

  it("is hidden where install isn't possible (no prompt, not iOS)", () => {
    expect(installMode(base)).toBeNull();
  });

  it("is hidden off phones", () => {
    expect(installMode({ ...base, phone: false, hasPrompt: true })).toBeNull();
    expect(installMode({ ...base, phone: false, ios: true })).toBeNull();
  });

  it("is hidden in the installed app", () => {
    expect(installMode({ ...base, standalone: true, hasPrompt: true })).toBeNull();
    expect(installMode({ ...base, standalone: true, ios: true })).toBeNull();
  });

  it("is hidden after appinstalled", () => {
    expect(installMode({ ...base, installed: true, hasPrompt: true })).toBeNull();
  });
});
