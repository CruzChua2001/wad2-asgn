import { useState } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useAuth } from "@/components/auth/auth-provider";
import ProductTour from "../product-tour";

const route = vi.hoisted(() => ({ pathname: "/scan" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));
vi.mock("@/components/auth/auth-provider", () => ({ useAuth: vi.fn() }));
const seenKey = (part, user = "guest") => `cruz-control-tour-seen-v1:${part}:${user}`;
const tick = (time = 0) => act(() => vi.advanceTimersByTime(time));
function Tour({ initial = "intro", onClose = vi.fn() }) {
    const [part, setPart] = useState(initial);
    return <ProductTour part={part} onStart={setPart} onClose={() => { onClose(); setPart(null); }} />;
}
beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    localStorage.clear();
    route.pathname = "/scan";
    useAuth.mockReturnValue({ status: "guest" });
    vi.stubGlobal("requestAnimationFrame", callback => setTimeout(callback, 0));
    vi.stubGlobal("cancelAnimationFrame", id => clearTimeout(id));
    vi.stubGlobal("scrollTo", vi.fn());
});
afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
});

test("intro advances, goes back, completes and stores completion for the current user", () => {
    useAuth.mockReturnValue({ status: "authenticated", user: { id: "user-1" } });
    const onClose = vi.fn();
    render(<Tour onClose={onClose} />);
    tick();
    expect(screen.getByRole("dialog", { name: "Hi, I'm Cruz" })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "NEXT" }));
    fireEvent.click(screen.getByRole("button", { name: "NEXT" }));
    expect(screen.getByRole("dialog", { name: "What to scan" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "BACK" }));
    expect(screen.getByRole("dialog", { name: "Hi, I'm Cruz" })).toBeTruthy();
    for (let step = 0; step < 3; step++) fireEvent.click(screen.getByRole("button", { name: "NEXT" }));
    fireEvent.click(screen.getByRole("button", { name: "GOT IT" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(onClose).toHaveBeenCalledOnce();
    expect(localStorage.getItem(seenKey("intro", "user-1"))).toBe("1");
    expect(localStorage.getItem(seenKey("intro"))).toBeNull();
});

test.each(["Skip", "Escape"])("dismissal by %s stores seen state and suppresses a later automatic intro", action => {
    const view = render(<Tour />);
    tick();
    if (action === "Skip") fireEvent.click(screen.getByRole("button", { name: "Skip" }));
    else fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(localStorage.getItem(seenKey("intro"))).toBe("1");
    view.unmount();
    const onStart = vi.fn();
    render(<ProductTour part={null} onStart={onStart} onClose={vi.fn()} />);
    tick(1000);
    expect(onStart).not.toHaveBeenCalled();
});

test("automatic intro waits for authentication and its delay, and unmount cancels the timer", () => {
    const onStart = vi.fn();
    useAuth.mockReturnValue({ status: "loading" });
    const view = render(<ProductTour part={null} onStart={onStart} onClose={vi.fn()} />);
    tick(1000);
    expect(onStart).not.toHaveBeenCalled();
    useAuth.mockReturnValue({ status: "guest" });
    view.rerender(<ProductTour part={null} onStart={onStart} onClose={vi.fn()} />);
    tick(899);
    expect(onStart).not.toHaveBeenCalled();
    tick(1);
    expect(onStart).toHaveBeenCalledExactlyOnceWith("intro");
    view.unmount();
    onStart.mockClear();
    const second = render(<ProductTour part={null} onStart={onStart} onClose={vi.fn()} />);
    second.unmount();
    tick(1000);
    expect(onStart).not.toHaveBeenCalled();
});

test("results wait for the score target, skip absent optional map/repo steps, and finish", () => {
    route.pathname = "/scan/scan-1";
    render(<Tour initial={null} />);
    tick(600);
    expect(screen.queryByRole("dialog")).toBeNull();
    const target = document.createElement("section");
    target.setAttribute("aria-labelledby", "score-title");
    document.body.append(target);
    try {
        tick(300);
        tick();
        expect(screen.getByRole("dialog", { name: "Your results are in" })).toBeTruthy();
        expect(screen.getByText("Step 1 of 5")).toBeTruthy();
        for (const title of ["Your pages", "Your score", "What is wrong", "Stuck? Ask me"]) {
            fireEvent.click(screen.getByRole("button", { name: "NEXT" }));
            tick(500);
            expect(screen.getByRole("dialog", { name: title })).toBeTruthy();
        }
        fireEvent.click(screen.getByRole("button", { name: "DONE" }));
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(localStorage.getItem(seenKey("results"))).toBe("1");
    } finally { target.remove(); }
});
