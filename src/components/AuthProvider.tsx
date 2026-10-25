"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { getSupabase, supabaseConfigured, takeAuthErrorFromUrl } from "@/lib/supabase";
import { SyncQueue, type SyncStatus } from "@/lib/cloud-sync";
import { CloudStorageAdapter } from "@/lib/cloud-adapter";

interface AuthCtx {
  /** Supabase env vars present. When false the app is guest-only. */
  configured: boolean;
  /** The stored session has been checked; `user` is meaningful. */
  ready: boolean;
  user: User | null;
  /** Write queue for the signed-in user. */
  queue: SyncQueue | null;
  syncStatus: SyncStatus | null;
  /**
   * One-off message for the user (failed magic link, signed out). Lives here,
   * not in the navbar, because signing in or out remounts everything below
   * SessionProvider.
   */
  notice: string | null;
  clearNotice: () => void;
  /** Resolves to an error message, or null when the email was sent. */
  sendMagicLink: (email: string) => Promise<string | null>;
  /** Resolves to an error message, or null when signed in. No email is sent. */
  signInWithPassword: (email: string, password: string) => Promise<string | null>;
  /**
   * Creates an account. Signs in straight away when the project has
   * "Confirm email" off; otherwise a confirmation email goes out first.
   */
  signUp: (email: string, password: string) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  /** Sets or changes the signed-in user's password (no email needed). */
  setPassword: (password: string) => Promise<string | null>;
  /** Resolves to the number of changes that couldn't be synced first. */
  signOut: () => Promise<number>;
  /** The navbar's sign-in dialog is open. Shared so other UI (e.g. the fresh-install hint) can open it. */
  signInOpen: boolean;
  setSignInOpen: (open: boolean) => void;
}

const AuthContext = createContext<AuthCtx>({
  configured: false,
  ready: true,
  user: null,
  queue: null,
  syncStatus: null,
  notice: null,
  clearNotice: () => {},
  sendMagicLink: async () => "Sign-in is not configured.",
  signInWithPassword: async () => "Sign-in is not configured.",
  signUp: async () => ({ error: "Sign-in is not configured.", needsConfirmation: false }),
  setPassword: async () => "Sign-in is not configured.",
  signOut: async () => 0,
  signInOpen: false,
  setSignInOpen: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(!supabaseConfigured);
  const [user, setUser] = useState<User | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [signInOpen, setSignInOpen] = useState(false);

  useEffect(() => {
    if (!supabaseConfigured) return;
    setNotice(takeAuthErrorFromUrl());
    const client = getSupabase()!;
    // Keep this callback synchronous: awaiting Supabase calls inside it can deadlock.
    const { data } = client.auth.onAuthStateChange((_event, session) => {
      const next = session?.user ?? null;
      setUser((prev) => (prev?.id === next?.id ? (next ?? prev) : next));
      setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = user?.id ?? null;

  // Signing in closes the dialog; don't let it reappear after signing out.
  useEffect(() => {
    if (userId) setSignInOpen(false);
  }, [userId]);
  const queue = useMemo(() => {
    const client = getSupabase();
    if (!client || !userId) return null;
    return new SyncQueue(client, userId, window.localStorage);
  }, [userId]);

  useEffect(() => {
    if (!queue) {
      setSyncStatus(null);
      return;
    }
    setSyncStatus(queue.getStatus());
    const unsubscribe = queue.subscribe(setSyncStatus);
    // Ops left over from a previous visit (offline, closed tab).
    if (queue.pending) void queue.flush();
    const retry = () => void queue.flush();
    window.addEventListener("online", retry);
    return () => {
      unsubscribe();
      window.removeEventListener("online", retry);
      queue.dispose();
    };
  }, [queue]);

  const sendMagicLink = useCallback(async (email: string) => {
    const client = getSupabase();
    if (!client) return "Sign-in is not configured.";
    const { error } = await client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + window.location.pathname },
    });
    if (!error) return null;
    if (error.code === "over_email_send_rate_limit" || error.status === 429) {
      return "Too many sign-in emails were sent recently. Wait a while and try again.";
    }
    return error.message;
  }, []);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const client = getSupabase();
    if (!client) return "Sign-in is not configured.";
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (!error) return null;
    if (error.code === "invalid_credentials") {
      return "Wrong email or password.";
    }
    if (error.code === "email_not_confirmed") return "Confirm your email first. Check your inbox for the link.";
    return error.message;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const client = getSupabase();
    if (!client) return { error: "Sign-in is not configured.", needsConfirmation: false };
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin + window.location.pathname },
    });
    if (error) {
      if (error.code === "user_already_exists") {
        return { error: "An account with this email already exists. Sign in instead.", needsConfirmation: false };
      }
      if (error.code === "over_email_send_rate_limit" || error.status === 429) {
        return { error: "Too many emails were sent recently. Wait a while and try again.", needsConfirmation: false };
      }
      return { error: error.message, needsConfirmation: false };
    }
    if (data.session) return { error: null, needsConfirmation: false };
    // With "Confirm email" on, an existing address comes back as a user with
    // no identities (Supabase hides whether the email is registered).
    if (data.user && data.user.identities?.length === 0) {
      return { error: "An account with this email already exists. Sign in instead.", needsConfirmation: false };
    }
    return { error: null, needsConfirmation: true };
  }, []);

  const setPassword = useCallback(async (password: string) => {
    const client = getSupabase();
    if (!client) return "Sign-in is not configured.";
    const { error } = await client.auth.updateUser({ password });
    if (!error) return null;
    if (error.code === "same_password") return "That's already your password.";
    if (error.code === "reauthentication_needed") {
      return "For security, sign out and sign in again, then set the password.";
    }
    return error.message;
  }, []);

  const signOut = useCallback(async () => {
    const client = getSupabase();
    if (!client || !userId) return 0;
    const synced = queue ? await queue.flush() : true;
    const unsynced = queue?.pending ?? 0;
    // "local": sign out this device only, not every device on the account.
    await client.auth.signOut({ scope: "local" });
    // Keep the cache while writes are pending; they upload on next sign-in.
    if (synced) CloudStorageAdapter.clearCache(userId);
    setNotice(
      unsynced
        ? `Signed out. ${unsynced} change${unsynced === 1 ? "" : "s"} will sync next time you sign in here.`
        : "Signed out. You're back to sessions saved in this browser.",
    );
    return unsynced;
  }, [queue, userId]);

  const clearNotice = useCallback(() => setNotice(null), []);

  const value = useMemo(
    () => ({
      configured: supabaseConfigured,
      ready,
      user,
      queue,
      syncStatus,
      notice,
      clearNotice,
      sendMagicLink,
      signInWithPassword,
      signUp,
      setPassword,
      signOut,
      signInOpen,
      setSignInOpen,
    }),
    [ready, user, queue, syncStatus, notice, clearNotice, sendMagicLink, signInWithPassword, signUp, setPassword, signOut, signInOpen],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthCtx {
  return useContext(AuthContext);
}
