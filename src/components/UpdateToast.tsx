"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Toast } from "@/components/Toast";
import { useTimerPhase } from "@/components/TimerPhaseContext";
import { SKIP_WAITING_MESSAGE, shouldShowUpdateToast } from "@/lib/sw-update";

/**
 * "New version available" toast. Watches the service worker registration for
 * a new worker that has installed and is waiting (including one already
 * waiting at page load), and shows the toast only while the timer is idle.
 * Reload tells the waiting worker to skip waiting, then reloads once it has
 * taken over. Production only: there is no service worker in `next dev`.
 */
export function UpdateToast() {
  const { phase } = useTimerPhase();
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [reloading, setReloading] = useState(false);
  const reloadedRef = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    let cancelled = false;
    let registration: ServiceWorkerRegistration | null = null;

    // A worker that installs while another is active is an update; the very
    // first install activates straight away and never waits.
    const trackInstalling = (worker: ServiceWorker | null) => {
      if (!worker) return;
      const onState = () => {
        if (worker.state === "installed" && registration?.active && !cancelled) setWaiting(worker);
      };
      worker.addEventListener("statechange", onState);
      onState();
    };
    const onUpdateFound = () => trackInstalling(registration?.installing ?? null);

    // `ready` resolves once a worker is active, i.e. after Serwist's client
    // entry has registered it.
    navigator.serviceWorker.ready.then((reg) => {
      if (cancelled) return;
      registration = reg;
      if (reg.waiting && reg.active) setWaiting(reg.waiting);
      trackInstalling(reg.installing);
      reg.addEventListener("updatefound", onUpdateFound);
    });

    return () => {
      cancelled = true;
      registration?.removeEventListener("updatefound", onUpdateFound);
    };
  }, []);

  const reload = useCallback(() => {
    if (!waiting) return;
    setReloading(true);
    const reloadOnce = () => {
      if (reloadedRef.current) return;
      reloadedRef.current = true;
      window.location.reload();
    };
    // Already activated (e.g. another tab tapped Reload first): just reload.
    if (waiting.state === "activated") return reloadOnce();
    // A controlled page sees controllerchange; an uncontrolled one (first
    // visit) only sees the worker reach "activated".
    navigator.serviceWorker.addEventListener("controllerchange", reloadOnce);
    waiting.addEventListener("statechange", () => {
      if (waiting.state === "activated") reloadOnce();
    });
    waiting.postMessage(SKIP_WAITING_MESSAGE);
  }, [waiting]);

  const noop = useCallback(() => {}, []);

  if (reloading || !shouldShowUpdateToast(waiting !== null, phase)) return null;
  return (
    <Toast
      testId="update-toast"
      message="New version available"
      onClose={noop}
      duration={null}
      action={{ label: "Reload", onClick: reload }}
    />
  );
}
