"use client";

import Link from "next/link";
import Image from "next/image";
import ThemeToggle from "@/components/ThemeToggle";
import { AccountMenu } from "@/components/AccountMenu";
import { useTheme } from "@/components/ThemeProvider";

export function Navbar() {
  const { theme } = useTheme();

  return (
    <nav className="safe-area-nav flex items-center justify-between px-4 py-2 border-b border-[var(--border)] text-base bg-[var(--surface)] shrink-0">
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
        <Link href="/" className="opacity-60 hover:opacity-100">
          Timer
        </Link>
        <Link href="/stats" className="opacity-60 hover:opacity-100">
          Stats
        </Link>
        <Link href="/settings" className="opacity-60 hover:opacity-100">
          Settings
        </Link>
        <ThemeToggle />
        <AccountMenu />
      </div>
    </nav>
  );
}
