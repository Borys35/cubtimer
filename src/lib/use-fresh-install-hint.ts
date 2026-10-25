import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useSession } from "@/components/SessionProvider";
import {
  isIosStandalone,
  readHintDismissed,
  shouldRetireFreshInstallHint,
  shouldShowFreshInstallHint,
  writeHintDismissed,
} from "@/lib/fresh-install-hint";

function storage(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/** Whether to show the fresh-install hint, and how to dismiss it for good. */
export function useFreshInstallHint(): { show: boolean; dismiss: () => void } {
  const { ready, user } = useAuth();
  const { hydrated, sessions } = useSession();
  // Browser-only checks; read after mount so SSR and first render agree.
  const [env, setEnv] = useState<{ standalone: boolean; dismissed: boolean } | null>(null);

  useEffect(() => {
    setEnv({ standalone: isIosStandalone(), dismissed: readHintDismissed(storage()) });
  }, []);

  const solveCount = useMemo(() => sessions.reduce((n, s) => n + s.solves.length, 0), [sessions]);

  const state = env && {
    standalone: env.standalone,
    dismissed: env.dismissed,
    authReady: ready,
    signedIn: Boolean(user),
    hydrated,
    solveCount,
  };
  const show = state ? shouldShowFreshInstallHint(state) : false;
  const retire = state ? shouldRetireFreshInstallHint(state) : false;

  const dismiss = useCallback(() => {
    writeHintDismissed(storage());
    setEnv((e) => e && { ...e, dismissed: true });
  }, []);

  useEffect(() => {
    if (retire) dismiss();
  }, [retire, dismiss]);

  return { show, dismiss };
}
