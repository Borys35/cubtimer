import { describe, it, expect } from "vitest";
import {
  APP_SHELL_PAGES,
  PRECACHE_IGNORED_PARAMS,
  bypassesServiceWorker,
  offlinePageFor,
} from "@/lib/sw-routing";

const origin = "https://timer.boryskaczmarek.pl";
const bypass = (href: string) => bypassesServiceWorker(new URL(href, origin), origin);

describe("bypassesServiceWorker", () => {
  it("never handles Supabase API, auth or storage requests", () => {
    expect(bypass("https://abcdefgh.supabase.co/rest/v1/timer_solves?select=*")).toBe(true);
    expect(bypass("https://abcdefgh.supabase.co/auth/v1/token?grant_type=refresh_token")).toBe(true);
    expect(bypass("https://abcdefgh.supabase.co/auth/v1/user")).toBe(true);
    expect(bypass("https://db.example.com/rest/v1/x")).toBe(true);
  });

  it("never handles Vercel analytics", () => {
    expect(bypass("/_vercel/insights/script.js")).toBe(true);
    expect(bypass("/_vercel/insights/view")).toBe(true);
    expect(bypass("/_vercel/speed-insights/vitals")).toBe(true);
  });

  it("handles the app's own pages and assets", () => {
    expect(bypass("/")).toBe(false);
    expect(bypass("/stats")).toBe(false);
    expect(bypass("/cubing/scramble/index.js")).toBe(false);
    expect(bypass("/_next/static/chunks/main.js")).toBe(false);
  });

  it("treats another port or scheme as cross-origin", () => {
    expect(bypass("http://timer.boryskaczmarek.pl/")).toBe(true);
    expect(bypass("https://timer.boryskaczmarek.pl:8443/")).toBe(true);
  });
});

describe("offlinePageFor", () => {
  it("serves each shell page for itself", () => {
    for (const page of APP_SHELL_PAGES) expect(offlinePageFor(page)).toBe(page);
    expect(offlinePageFor("/stats/")).toBe("/stats");
  });

  it("falls back to the timer for anything else", () => {
    expect(offlinePageFor("/nope")).toBe("/");
    expect(offlinePageFor("/stats/deep")).toBe("/");
  });
});

describe("PRECACHE_IGNORED_PARAMS", () => {
  const ignored = (name: string) => PRECACHE_IGNORED_PARAMS.some((re) => re.test(name));

  it("ignores Next's metadata icon content hash", () => {
    expect(ignored("da6f2d006f7060bd")).toBe(true);
  });

  it("keeps RSC and auth parameters significant", () => {
    expect(ignored("_rsc")).toBe(false);
    expect(ignored("error")).toBe(false);
    expect(ignored("error_description")).toBe(false);
  });
});
