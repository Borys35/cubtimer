// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import SettingsPage from "@/app/settings/page";
import { useSession } from "@/components/SessionProvider";

vi.mock("@/components/SessionProvider", () => ({
  useSession: vi.fn(),
}));

vi.mock("@/components/ThemeProvider", () => ({
  useTheme: () => ({
    theme: "dark" as const,
    cycleTheme: vi.fn(),
  }),
}));

function mockSession(overrides: Record<string, unknown> = {}) {
  const defaults = {
    settings: {
      startDelayMs: 500,
      inspectionEnabled: false,
      inspectionDurationSec: 15,
      soundEnabled: false,
    },
    sessions: [
      { id: "s1", name: "Session 1", puzzleType: "3x3", solves: [] },
    ],
    importSessions: vi.fn(() => ({ imported: 0, duplicates: 0 })),
    clearAllSessions: vi.fn(),
    updateSettings: vi.fn(),
  };
  return { ...defaults, ...overrides };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("SettingsPage", () => {
  it("renders start delay slider with current value", () => {
    const session = mockSession();
    vi.mocked(useSession).mockReturnValue(session as never);
    render(<SettingsPage />);
    const slider = screen.getByRole("slider", { name: /start delay/i });
    expect(slider).toBeDefined();
    expect(slider.getAttribute("value")).toBe("500");
  });

  it("calls updateSettings when start delay changes", () => {
    const session = mockSession();
    vi.mocked(useSession).mockReturnValue(session as never);
    render(<SettingsPage />);
    const slider = screen.getByRole("slider", { name: /start delay/i });
    fireEvent.change(slider, { target: { value: "1000" } });
    expect(session.updateSettings).toHaveBeenCalledWith({ startDelayMs: 1000 });
  });

  it("renders inspection toggle as off by default", () => {
    const session = mockSession();
    vi.mocked(useSession).mockReturnValue(session as never);
    render(<SettingsPage />);
    const offs = screen.getAllByText("Off");
    expect(offs.length).toBeGreaterThanOrEqual(2);
  });

  it("calls updateSettings when inspection toggle is clicked", () => {
    const session = mockSession();
    vi.mocked(useSession).mockReturnValue(session as never);
    render(<SettingsPage />);
    const offs = screen.getAllByText("Off");
    fireEvent.click(offs[0]);
    expect(session.updateSettings).toHaveBeenCalledWith({ inspectionEnabled: true });
  });

  it("shows inspection duration slider when inspection is enabled", () => {
    const session = mockSession({
      settings: {
        startDelayMs: 500,
        inspectionEnabled: true,
        inspectionDurationSec: 10,
        soundEnabled: false,
      },
    });
    vi.mocked(useSession).mockReturnValue(session as never);
    render(<SettingsPage />);
    expect(screen.getByText("10s")).toBeDefined();
  });

  it("does not show inspection duration slider when inspection is disabled", () => {
    const session = mockSession();
    vi.mocked(useSession).mockReturnValue(session as never);
    render(<SettingsPage />);
    expect(screen.queryByText(/inspection duration/i)).toBeNull();
  });

  it("renders Appearance section with theme options", () => {
    const session = mockSession();
    vi.mocked(useSession).mockReturnValue(session as never);
    render(<SettingsPage />);
    expect(screen.getByText("Appearance")).toBeDefined();
    expect(screen.getAllByText(/dark/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/light/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/aurora/i).length).toBeGreaterThanOrEqual(1);
  });

  it("renders Clear all sessions button in Data section", () => {
    const session = mockSession();
    vi.mocked(useSession).mockReturnValue(session as never);
    render(<SettingsPage />);
    expect(screen.getByText("Clear all")).toBeDefined();
  });

  it("shows confirmation dialog when Clear all is clicked", () => {
    const session = mockSession();
    vi.mocked(useSession).mockReturnValue(session as never);
    render(<SettingsPage />);
    fireEvent.click(screen.getByText("Clear all"));
    expect(screen.getByText(/are you sure/i)).toBeDefined();
  });

  it("calls clearAllSessions when confirmation is confirmed", () => {
    const session = mockSession();
    vi.mocked(useSession).mockReturnValue(session as never);
    render(<SettingsPage />);
    fireEvent.click(screen.getByText("Clear all"));
    fireEvent.click(screen.getByText("Yes, clear all"));
    expect(session.clearAllSessions).toHaveBeenCalled();
  });

  it("does not call clearAllSessions when confirmation is cancelled", () => {
    const session = mockSession();
    vi.mocked(useSession).mockReturnValue(session as never);
    render(<SettingsPage />);
    fireEvent.click(screen.getByText("Clear all"));
    fireEvent.click(screen.getByText("Cancel"));
    expect(session.clearAllSessions).not.toHaveBeenCalled();
  });
});
