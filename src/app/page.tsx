"use client";

import TimerPage from "@/components/TimerPage";
import { SessionSidebar } from "@/components/SessionSidebar";
import { useTimerPhase } from "@/components/TimerPhaseContext";
import { useSession } from "@/components/SessionProvider";

function TimerLayout() {
  const { phase } = useTimerPhase();
  const { settings } = useSession();
  const zen = settings.zenMode;
  const collapsed = zen || phase !== "idle";

  return (
    <div className="flex h-full">
      <div
        className={`h-full overflow-hidden transition-all duration-300 ${
          collapsed ? "w-0" : "w-0 md:w-64"
        }`}
      >
        {!zen && <SessionSidebar />}
      </div>
      <div className="flex-1 overflow-hidden">
        <TimerPage />
      </div>
    </div>
  );
}

// TimerPhaseProvider lives in the root layout so the update toast can see
// the phase on every page.
export default function Home() {
  return <TimerLayout />;
}
