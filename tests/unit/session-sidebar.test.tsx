// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { SessionProvider } from "@/components/SessionProvider";
import { SessionSidebar } from "@/components/SessionSidebar";
import { MenuProvider, useMenu } from "@/components/MenuContext";
import type { StorageAdapter, AppData, TimerSession, TimerSolve } from "@/lib/types";
import { DEFAULT_SETTINGS } from "@/lib/types";

function makeSession(overrides: Partial<TimerSession> = {}): TimerSession {
  return {
    id: "s1",
    name: "Session_310826_01",
    puzzleType: "3x3",
    solves: [],
    createdAt: 1725110400,
    endedAt: null,
    ...overrides,
  };
}

function makeData(sessions: TimerSession[], activeSessionId = "s1"): AppData {
  return { sessions, activeSessionId, settings: DEFAULT_SETTINGS };
}

function renderWithProvider(ui: React.ReactNode, adapter: StorageAdapter) {
  return render(
    <SessionProvider adapter={adapter}>{ui}</SessionProvider>,
  );
}

function makeAdapter(data: AppData) {
  return {
    load: vi.fn().mockReturnValue(data),
    save: vi.fn().mockReturnValue(undefined),
    updateSession: vi.fn().mockReturnValue(undefined),
    setActiveSession: vi.fn().mockReturnValue(undefined),
  } as unknown as StorageAdapter;
}

describe("SessionSidebar", () => {
  let adapter: StorageAdapter;

  beforeEach(() => {
    const data = makeData([
      makeSession({ id: "s1", name: "Session_310826_01", puzzleType: "3x3" }),
      makeSession({ id: "s2", name: "Session_310826_02", puzzleType: "2x2" }),
    ], "s1");
    adapter = makeAdapter(data);
  });

  it("renders dropdown with active session name and puzzle type", () => {
    renderWithProvider(<SessionSidebar />, adapter);
    expect(screen.getAllByText(/Session_310826_01/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/3x3/).length).toBeGreaterThanOrEqual(1);
  });

  it("shows + button for new session", () => {
    renderWithProvider(<SessionSidebar />, adapter);
    expect(screen.getAllByText("+").length).toBeGreaterThanOrEqual(1);
  });

  it("opens puzzle picker when + is clicked", () => {
    renderWithProvider(<SessionSidebar />, adapter);
    const plusBtns = screen.getAllByText("+");
    fireEvent.click(plusBtns[0]);
    expect(screen.getAllByText("Pick puzzle").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Pyraminx").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Square-1").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("4x4").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("5x5").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Skewb").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Megaminx").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Clock").length).toBeGreaterThanOrEqual(1);
  });

  it("creates new session when puzzle is selected", () => {
    renderWithProvider(<SessionSidebar />, adapter);
    const plusBtns = screen.getAllByText("+");
    fireEvent.click(plusBtns[0]);
    const pickers = screen.getAllByText("Pick puzzle");
    const picker = pickers[0].closest("div")!;
    const pyraminxBtn = Array.from(picker.querySelectorAll("button")).find(
      (b) => b.textContent === "Pyraminx"
    )!;
    fireEvent.click(pyraminxBtn);
    expect(screen.getAllByText(/Session_/i).length).toBeGreaterThanOrEqual(3);
  });

  it("closes the mobile sidebar as soon as a new session is created", () => {
    function OpenState() {
      const { mobileOpen, setMobileOpen } = useMenu();
      return (
        <button data-testid="menu-state" onClick={() => setMobileOpen(true)}>
          {mobileOpen ? "open" : "closed"}
        </button>
      );
    }
    // Earlier tests leave their renders in the document, so query this one only.
    const view = within(
      renderWithProvider(
        <MenuProvider>
          <OpenState />
          <SessionSidebar />
        </MenuProvider>,
        adapter,
      ).container,
    );
    fireEvent.click(view.getByTestId("menu-state"));
    expect(view.getByTestId("menu-state").textContent).toBe("open");
    fireEvent.click(view.getAllByText("+")[0]);
    fireEvent.click(view.getAllByText("Pyraminx")[0]);
    expect(view.getByTestId("menu-state").textContent).toBe("closed");
  });

  it("keeps ex-best singles highlighted after a new best", () => {
    const mk = (id: string, timeMs: number): TimerSolve => ({
      id,
      timeMs,
      dnf: false,
      penalty: 0,
      scramble: "",
      dateSec: 1725110400,
    });
    // 20.00 was the best, then 18.00 beat it; 25.00 was never a best.
    const solves = [mk("a", 20000), mk("b", 25000), mk("c", 18000)];
    adapter = makeAdapter(makeData([makeSession({ id: "s1", solves })], "s1"));
    const view = within(renderWithProvider(<SessionSidebar />, adapter).container);
    const cell = (text: string) =>
      view.getAllByText(text).map((el) => el.closest("td")).find((td) => td !== null)!;
    expect(cell("18.00").className).toContain("text-green-400");
    expect(cell("18.00").className).toContain("font-bold");
    expect(cell("20.00").className).toContain("text-green-400");
    expect(cell("20.00").className).not.toContain("font-bold");
    expect(cell("25.00").className).not.toContain("text-green-400");
  });
});
