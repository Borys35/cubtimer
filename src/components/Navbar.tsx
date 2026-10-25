"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import ThemeToggle from "@/components/ThemeToggle";
import { AccountMenu } from "@/components/AccountMenu";
import { InstallButton } from "@/components/InstallButton";
import { useTheme } from "@/components/ThemeProvider";

const LINKS = [
  { href: "/", label: "Timer" },
  { href: "/stats", label: "Stats" },
  { href: "/settings", label: "Settings" },
];

export function Navbar() {
  const { theme } = useTheme();
  // Nav menu (☰, below md). Separate from MenuContext's `mobileOpen`, which is the SessionSidebar.
  const [navOpen, setNavOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!navOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!navRef.current?.contains(e.target as Node)) setNavOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setNavOpen(false);
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [navOpen]);

  return (
    <nav
      ref={navRef}
      className="safe-area-nav relative flex items-center justify-between px-4 py-2 border-b border-[var(--border)] text-base bg-[var(--surface)] shrink-0"
    >
      <div className="flex items-center gap-3">
        <Link href="/" className="logo-hover relative inline-block">
          {/* Icon only — mobile */}
          <Image
            src="/logo.svg"
            alt="CubTimer"
            width={34}
            height={28}
            className="md:hidden"
            priority
          />
          {/* Logo with text — desktop, theme-aware */}
          <Image
            src={theme === "light" ? "/logo-light.svg" : "/logo-dark.svg"}
            alt="CubTimer"
            width={130}
            height={28}
            className="hidden md:block h-[28px] w-auto"
            priority
          />
          {/* Eye overlays — hidden on hover */}
          <span className="logo-eye-overlay left-[45%] top-[29%] w-[9%] h-[39%] md:left-[12%] md:top-[34%] md:w-[2.3%] md:h-[29%]" />
          <span className="logo-eye-overlay left-[65%] top-[29%] w-[9%] h-[39%] md:left-[17%] md:top-[34%] md:w-[2.3%] md:h-[29%]" />
        </Link>
      </div>
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Desktop: links + theme toggle inline, laid out as direct flex children. */}
        <div className="hidden md:contents">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="opacity-60 hover:opacity-100">
              {l.label}
            </Link>
          ))}
          <ThemeToggle />
        </div>
        <InstallButton />
        <AccountMenu />
        <button
          type="button"
          onClick={() => setNavOpen((o) => !o)}
          aria-label="Menu"
          aria-expanded={navOpen}
          aria-controls="nav-menu"
          className="md:hidden flex h-8 w-8 items-center justify-center rounded hover:bg-[var(--surface-3)] transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            {navOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 6l12 12M18 6L6 18" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>
      {navOpen && (
        <div
          id="nav-menu"
          className="md:hidden absolute left-0 right-0 top-full z-50 border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2 shadow-2xl"
        >
          <ul className="flex flex-col">
            {LINKS.map((l) => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={() => setNavOpen(false)}
                  className="block rounded px-2 py-2.5 opacity-80 hover:opacity-100 hover:bg-[var(--surface-3)]"
                >
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-2 border-t border-[var(--border)] px-2 pt-3 pb-1">
            <ThemeToggle />
          </div>
        </div>
      )}
    </nav>
  );
}
