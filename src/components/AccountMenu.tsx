"use client";

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Toast } from "@/components/Toast";
import type { SyncStatus } from "@/lib/cloud-sync";

const RESEND_COOLDOWN_SEC = 60; // Supabase's default per-email rate limit

const STATUS: Record<SyncStatus, { label: string; color: string }> = {
  synced: { label: "All changes synced", color: "var(--green)" },
  syncing: { label: "Syncing…", color: "var(--amber)" },
  offline: { label: "Offline: changes will sync when you're back online", color: "var(--red)" },
};

/** Navbar entry: "Sign in" when signed out, account menu when signed in. */
export function AccountMenu() {
  const { configured, ready, user, syncStatus, notice, clearNotice, signOut, signInOpen, setSignInOpen } =
    useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  if (!configured || !ready) return null;

  const toasts = notice && <Toast message={notice} onClose={clearNotice} duration={6000} />;

  if (!user) {
    return (
      <>
        <button
          onClick={() => setSignInOpen(true)}
          className="card flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--text-dim)] transition-colors hover:text-[var(--text)]"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A8 8 0 0112 14a8 8 0 016.879 3.804M15 10a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="hidden sm:inline">Sign in</span>
          <span className="sr-only sm:hidden">Sign in</span>
        </button>
        {signInOpen && <SignInDialog onClose={() => setSignInOpen(false)} />}
        {toasts}
      </>
    );
  }

  const email = user.email ?? "Account";
  const status = syncStatus ? STATUS[syncStatus] : null;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setMenuOpen((o) => !o)}
        aria-label={`Account: ${email}${status ? `. ${status.label}` : ""}`}
        aria-expanded={menuOpen}
        className="relative flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-3)] text-sm font-semibold uppercase text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors"
      >
        {email[0]}
        {status && (
          <span
            className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--surface)]"
            style={{ background: status.color }}
          />
        )}
      </button>
      {menuOpen && (
        <div className="absolute right-0 top-10 z-50 w-64 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3 shadow-2xl">
          <div className="text-[11px] uppercase tracking-wide text-[var(--text-faint)]">Signed in as</div>
          <div className="truncate text-sm font-medium" title={email}>{email}</div>
          {status && (
            <div className="mt-2 flex items-start gap-2 text-xs text-[var(--text-dim)]">
              <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ background: status.color }} />
              {status.label}
            </div>
          )}
          <SetPasswordForm />
          <button
            onClick={async () => {
              setMenuOpen(false);
              await signOut();
            }}
            className="mt-1 w-full rounded px-3 py-1.5 text-left text-sm text-[var(--text-dim)] hover:bg-[var(--surface-3)] hover:text-[var(--text)] transition-colors"
          >
            Sign out
          </button>
        </div>
      )}
      {toasts}
    </div>
  );
}

const MIN_PASSWORD_LENGTH = 6; // Supabase's default minimum

const inputClass =
  "w-full rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm outline-none focus:border-[var(--amber)]";
const primaryClass =
  "w-full px-4 py-2 rounded bg-[var(--amber)] text-[var(--bg)] font-medium hover:bg-[var(--amber-dim)] disabled:opacity-60 transition-colors";
const linkClass = "text-[var(--amber)] hover:underline";

/** Lets a signed-in user (e.g. one who came in by magic link) add or change a password. */
function SetPasswordForm() {
  const { setPassword } = useAuth();
  const [open, setOpen] = useState(false);
  const [password, setPasswordValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  if (!open) {
    return (
      <>
        <button
          onClick={() => {
            setOpen(true);
            setMessage(null);
          }}
          className="mt-3 w-full rounded px-3 py-1.5 text-left text-sm text-[var(--text-dim)] hover:bg-[var(--surface-3)] hover:text-[var(--text)] transition-colors"
        >
          Set password
        </button>
        {message?.ok && <p className="px-3 text-xs text-[var(--green)]">{message.text}</p>}
      </>
    );
  }

  return (
    <form
      className="mt-3 space-y-2"
      onKeyDown={(e) => e.stopPropagation()}
      onKeyUp={(e) => e.stopPropagation()}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        const err = await setPassword(password);
        setBusy(false);
        if (err) {
          setMessage({ text: err, ok: false });
          return;
        }
        setPasswordValue("");
        setOpen(false);
        setMessage({ text: "Password saved. You can now sign in with it.", ok: true });
      }}
    >
      <input
        type="password"
        required
        autoFocus
        minLength={MIN_PASSWORD_LENGTH}
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPasswordValue(e.target.value)}
        placeholder="New password"
        aria-label="New password"
        className={inputClass}
      />
      {message && !message.ok && <p className="text-xs text-[var(--red)]">{message.text}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={`${primaryClass} py-1.5 text-sm`}>
          {busy ? "Saving…" : "Save password"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-3 text-sm text-[var(--text-dim)] hover:text-[var(--text)]"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

/**
 * Magic-link sign-in is parked until the project has custom SMTP: Supabase's
 * built-in mailer only sends a handful of auth emails per hour. Flip to
 * re-enable; the flow itself is complete.
 */
const MAGIC_LINK_ENABLED = false;

type Mode = "signin" | "signup" | "magic";

const TITLES: Record<Mode, string> = {
  signin: "Sign in",
  signup: "Create account",
  magic: "Sign in with a magic link",
};

function SignInDialog({ onClose }: { onClose: () => void }) {
  const { sendMagicLink, signInWithPassword, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<null | "magic" | "confirm">(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
  };

  const sendLink = async () => {
    const err = await sendMagicLink(email.trim());
    if (err) {
      setError(err);
      return;
    }
    setSent("magic");
    setCooldown(RESEND_COOLDOWN_SEC);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "magic") {
        await sendLink();
      } else if (mode === "signin") {
        // On success the auth state flips and this dialog unmounts.
        const err = await signInWithPassword(email.trim(), password);
        if (err) setError(err);
      } else {
        const res = await signUp(email.trim(), password);
        if (res.error) setError(res.error);
        else if (res.needsConfirmation) setSent("confirm");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4"
      onClick={onClose}
      // Keep typing here from reaching the timer's window key listeners.
      onKeyDown={(e) => e.key !== "Escape" && e.stopPropagation()}
      onKeyUp={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sign-in-title"
    >
      <div
        className="bg-[var(--surface-2)] border border-[var(--border)] rounded-lg p-6 shadow-2xl w-full max-w-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="sign-in-title" className="text-lg font-semibold mb-1">
          {sent ? "Check your email" : TITLES[mode]}
        </h2>
        {sent ? (
          <>
            <p className="text-sm text-[var(--text-dim)] mb-5">
              {sent === "magic" ? (
                <>
                  We sent a sign-in link to <span className="text-[var(--text)]">{email}</span>. Open it on
                  this or any other device to sync your sessions.
                </>
              ) : (
                <>
                  We sent a confirmation link to <span className="text-[var(--text)]">{email}</span>. Open
                  it to finish creating your account.
                </>
              )}
            </p>
            {sent === "magic" && (
              <button
                onClick={() => void sendLink()}
                disabled={cooldown > 0}
                className="w-full px-4 py-2 rounded text-sm border border-[var(--border)] hover:bg-[var(--surface-3)] disabled:opacity-40 transition-colors"
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend link"}
              </button>
            )}
            {error && <p className="mt-2 text-xs text-[var(--red)]">{error}</p>}
          </>
        ) : (
          <form onSubmit={submit}>
            <p className="text-sm text-[var(--text-dim)] mb-4">
              {mode === "magic"
                ? "We'll email you a link. No password needed."
                : "Your sessions sync across devices once you're signed in."}
            </p>
            <div className="space-y-2">
              <input
                type="email"
                required
                autoFocus
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                aria-label="Email"
                className={inputClass}
              />
              {mode !== "magic" && (
                <input
                  type="password"
                  required
                  minLength={mode === "signup" ? MIN_PASSWORD_LENGTH : undefined}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "signup" ? `Password (${MIN_PASSWORD_LENGTH}+ characters)` : "Password"}
                  aria-label="Password"
                  className={inputClass}
                />
              )}
            </div>
            {error && <p className="mt-2 text-xs text-[var(--red)]">{error}</p>}
            <button type="submit" disabled={busy} className={`${primaryClass} mt-4`}>
              {busy
                ? "Please wait…"
                : mode === "signin"
                  ? "Sign in"
                  : mode === "signup"
                    ? "Create account"
                    : "Send magic link"}
            </button>
            <div className="mt-3 space-y-1 text-center text-xs text-[var(--text-dim)]">
              {mode === "signin" ? (
                <p>
                  No account?{" "}
                  <button type="button" className={linkClass} onClick={() => switchMode("signup")}>
                    Create one
                  </button>
                </p>
              ) : (
                <p>
                  Have a password?{" "}
                  <button type="button" className={linkClass} onClick={() => switchMode("signin")}>
                    Sign in
                  </button>
                </p>
              )}
              {mode !== "magic" &&
                (MAGIC_LINK_ENABLED ? (
                  <p>
                    Forgot it, or no password yet?{" "}
                    <button type="button" className={linkClass} onClick={() => switchMode("magic")}>
                      Email me a link
                    </button>
                  </p>
                ) : (
                  <p>
                    <button
                      type="button"
                      disabled
                      aria-disabled="true"
                      className="inline-flex items-center gap-1.5 cursor-not-allowed opacity-50"
                    >
                      Sign in with an email link
                      <span className="rounded bg-[var(--surface-3)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[var(--text-faint)]">
                        Soon
                      </span>
                    </button>
                  </p>
                ))}
            </div>
          </form>
        )}
        <button
          onClick={onClose}
          className="mt-2 w-full px-4 py-2 text-sm opacity-60 hover:opacity-100 transition-opacity"
        >
          {sent ? "Close" : "Cancel"}
        </button>
      </div>
    </div>
  );
}
