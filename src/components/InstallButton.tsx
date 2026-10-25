"use client";

import { useEffect, useState } from "react";
import { useInstall } from "@/lib/use-install";

const ShareIcon = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v12M8 7l4-4 4 4M6 11H5a1 1 0 00-1 1v8a1 1 0 001 1h14a1 1 0 001-1v-8a1 1 0 00-1-1h-1" />
  </svg>
);

/** Navbar Install button: phones in a browser tab only (see `useInstall`). */
export function InstallButton() {
  const { mode, install } = useInstall();
  const [sheetOpen, setSheetOpen] = useState(false);

  if (!mode) return null;

  return (
    <>
      <button
        onClick={() => (mode === "prompt" ? void install() : setSheetOpen(true))}
        className="card flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--amber)] transition-colors hover:text-[var(--text)]"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v11M7 10l5 5 5-5M5 20h14" />
        </svg>
        Install
      </button>
      {sheetOpen && <IosInstallSheet onClose={() => setSheetOpen(false)} />}
    </>
  );
}

function IosInstallSheet({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-end justify-center z-50 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-sheet-title"
    >
      <div
        className="bg-[var(--surface-2)] border border-[var(--border)] rounded-lg p-6 shadow-2xl w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="install-sheet-title" className="text-lg font-semibold mb-3">
          Install CubTimer
        </h2>
        <p className="text-sm leading-relaxed text-[var(--text-dim)]">
          Tap <ShareIcon className="inline-block w-5 h-5 align-text-bottom text-[var(--amber)]" />{" "}
          <span className="text-[var(--text)]">Share</span>, then{" "}
          <span className="text-[var(--text)]">Add to Home Screen</span>.
        </p>
        <button
          onClick={onClose}
          autoFocus
          className="mt-5 w-full px-4 py-2 text-sm opacity-60 hover:opacity-100 transition-opacity"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
