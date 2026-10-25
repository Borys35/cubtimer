"use client";

import { useCallback } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Toast } from "@/components/Toast";
import { useImportExport } from "@/lib/use-import-export";
import { useFreshInstallHint } from "@/lib/use-fresh-install-hint";

const actionClass = "font-medium text-[var(--amber)] hover:underline";

/**
 * One-time banner in the iOS installed app for a signed-out user with no
 * solves: browser data doesn't carry over, here's how to get it back.
 * `suppressed` hides it (keeping its space) while a solve is in progress.
 */
export function FreshInstallHint({ suppressed }: { suppressed: boolean }) {
  const { configured, setSignInOpen } = useAuth();
  const { show, dismiss } = useFreshInstallHint();
  const { toast, setToast, fileInputRef, handleImport } = useImportExport();
  const closeToast = useCallback(() => setToast(null), [setToast]);

  return (
    <>
      {show && (
        <div
          data-no-timer
          data-testid="fresh-install-hint"
          aria-hidden={suppressed || undefined}
          className={`card shrink-0 w-full max-w-4xl mb-4 flex items-start gap-3 px-4 py-3 text-sm transition-opacity ${
            suppressed ? "opacity-0 pointer-events-none" : ""
          }`}
        >
          <div className="flex-1 min-w-0">
            <p className="text-[var(--text-dim)]">
              Solves from your browser don&apos;t carry over to the installed app.{" "}
              {configured ? "Sign in to sync them, or import an export." : "Import an export to bring them over."}
            </p>
            <div className="mt-2 flex gap-4">
              {configured && (
                <button className={actionClass} onClick={() => setSignInOpen(true)} disabled={suppressed}>
                  Sign in
                </button>
              )}
              <button className={actionClass} onClick={() => fileInputRef.current?.click()} disabled={suppressed}>
                Import
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.json,application/json,text/plain"
                onChange={handleImport}
                className="hidden"
              />
            </div>
          </div>
          <button
            onClick={dismiss}
            disabled={suppressed}
            aria-label="Dismiss"
            className="shrink-0 -m-1 p-1 rounded text-[var(--text-faint)] hover:text-[var(--text)] hover:bg-[var(--surface-3)] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
      {/* Outside the banner: a successful import adds solves, which hides it. */}
      {toast && <Toast message={toast} onClose={closeToast} duration={4000} />}
    </>
  );
}
