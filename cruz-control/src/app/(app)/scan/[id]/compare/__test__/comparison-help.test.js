import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import ComparisonHelp from "../comparison-help";

const preference = vi.hoisted(() => ({ reduced: false }));
// Inspect the animation configuration while retaining the real disclosure state.
// jsdom cannot measure browser layout or prove that animation frames look smooth.
vi.mock("motion/react", () => ({
    useReducedMotion: () => preference.reduced,
    motion: { div: ({ initial, animate, transition, children, ...props }) => <div {...props} data-initial={String(initial)} data-height={animate.height} data-duration={transition.duration}>{children}</div> },
}));
beforeEach(() => { preference.reduced = false; });

test.each([false, true])("help keeps its controls mounted, blocks closed content and respects reduced motion: %s", reduced => {
    preference.reduced = reduced;
    render(<div><ComparisonHelp /></div>);
    const button = screen.getByRole("button", { name: "How comparison works" });
    const panel = document.getElementById(button.getAttribute("aria-controls"));
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(panel.hasAttribute("inert")).toBe(true);
    expect(panel.getAttribute("data-height")).toBe("0");
    expect(panel.getAttribute("data-initial")).toBe("false");
    expect(panel.getAttribute("data-duration")).toBe(reduced ? "0" : "0.28");
    expect(screen.queryByRole("region")).toBeNull();
    button.focus();
    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");
    expect(panel.hasAttribute("inert")).toBe(false);
    expect(screen.getByRole("region", { name: "How comparison works explanation" })).toBe(panel);
    expect(panel.getAttribute("data-height")).toBe("auto");
    expect(screen.getByText(/check completed successfully in both scans/)).toBeTruthy();
    fireEvent.click(button);
    expect(screen.getByRole("button", { name: "How comparison works" })).toBe(button);
    expect(document.getElementById(button.getAttribute("aria-controls"))).toBe(panel);
    expect(document.activeElement).toBe(button);
    expect(panel.hasAttribute("inert")).toBe(true);
    expect(panel.getAttribute("aria-hidden")).toBe("true");
    expect(panel.getAttribute("data-height")).toBe("0");
    expect(screen.queryByRole("region")).toBeNull();
});
