// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { LastSolveActions } from "@/components/LastSolveActions";
import { formatSolveResult, togglePenalty } from "@/lib/timer-utils";
import type { TimerSolve } from "@/lib/types";

function makeSolve(overrides: Partial<TimerSolve> = {}): TimerSolve {
  return { id: "a", timeMs: 12340, penalty: 0, dnf: false, scramble: "R U", dateSec: 1, ...overrides };
}

afterEach(cleanup);

describe("togglePenalty", () => {
  it("+2 turns on and off", () => {
    expect(togglePenalty({ penalty: 0, dnf: false }, "plus2")).toEqual({ penalty: 1, dnf: false });
    expect(togglePenalty({ penalty: 1, dnf: false }, "plus2")).toEqual({ penalty: 0, dnf: false });
  });

  it("DNF turns on and off", () => {
    expect(togglePenalty({ penalty: 0, dnf: false }, "dnf")).toEqual({ penalty: 0, dnf: true });
    expect(togglePenalty({ penalty: 0, dnf: true }, "dnf")).toEqual({ penalty: 0, dnf: false });
  });

  it("+2 and DNF are mutually exclusive", () => {
    expect(togglePenalty({ penalty: 1, dnf: false }, "dnf")).toEqual({ penalty: 0, dnf: true });
    expect(togglePenalty({ penalty: 0, dnf: true }, "plus2")).toEqual({ penalty: 1, dnf: false });
  });
});

describe("formatSolveResult", () => {
  it("shows the plain time, +2 with a trailing plus, or DNF", () => {
    expect(formatSolveResult(makeSolve())).toBe("12.34");
    expect(formatSolveResult(makeSolve({ penalty: 1 }))).toBe("14.34+");
    expect(formatSolveResult(makeSolve({ dnf: true }))).toBe("DNF");
    expect(formatSolveResult(makeSolve({ timeMs: 59000, penalty: 1 }))).toBe("1:01.00+");
  });
});

describe("LastSolveActions", () => {
  it("is marked data-no-timer so taps never arm the timer", () => {
    render(<LastSolveActions solve={makeSolve()} onUpdate={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByTestId("last-solve-actions").hasAttribute("data-no-timer")).toBe(true);
  });

  it("sends the toggle patch and reflects the active penalty", () => {
    const onUpdate = vi.fn();
    const { rerender } = render(<LastSolveActions solve={makeSolve()} onUpdate={onUpdate} onDelete={vi.fn()} />);
    expect(screen.getByRole("button", { name: "+2 penalty" }).getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(screen.getByRole("button", { name: "+2 penalty" }));
    expect(onUpdate).toHaveBeenLastCalledWith({ penalty: 1, dnf: false });

    rerender(<LastSolveActions solve={makeSolve({ penalty: 1 })} onUpdate={onUpdate} onDelete={vi.fn()} />);
    expect(screen.getByRole("button", { name: "+2 penalty" }).getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "DNF" }));
    expect(onUpdate).toHaveBeenLastCalledWith({ penalty: 0, dnf: true });
  });

  it("never submits a surrounding form (typing mode)", () => {
    const onSubmit = vi.fn((e: React.FormEvent) => e.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <LastSolveActions solve={makeSolve()} onUpdate={vi.fn()} onDelete={vi.fn()} />
      </form>,
    );
    fireEvent.click(screen.getByRole("button", { name: "DNF" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete last solve" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("delete calls onDelete", () => {
    const onDelete = vi.fn();
    render(<LastSolveActions solve={makeSolve()} onUpdate={vi.fn()} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete last solve" }));
    expect(onDelete).toHaveBeenCalledOnce();
  });
});
