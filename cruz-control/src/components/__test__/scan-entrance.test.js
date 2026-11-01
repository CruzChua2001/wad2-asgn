import { expect, test, vi, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ScanEntrance from "../scan-entrance";

const motionState = vi.hoisted(() => ({ reduced: false, props: null }));
vi.mock("motion/react", () => {
    const element = Tag => function Motion({ initial, animate, transition, children, ...props }) {
        motionState.props = { initial, animate, transition };
        return <Tag {...props}>{children}</Tag>;
    };
    return { useReducedMotion: () => motionState.reduced, motion: { div: element("div"), section: element("section"), li: element("li") } };
});
beforeEach(() => { motionState.reduced = false; });

test("uses the app easing and a capped short stagger without blocking controls", () => {
    const change = vi.fn();
    render(<ScanEntrance as="section" aria-label="Scans" delay={6}><button onClick={change}>Choose scan</button></ScanEntrance>);
    expect(motionState.props).toEqual({ initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.45, delay: 0.24, ease: [0.22, 1, 0.36, 1] } });
    const button = screen.getByRole("button");
    button.focus();
    fireEvent.click(button);
    expect(document.activeElement).toBe(button);
    expect(change).toHaveBeenCalledOnce();
});

test.each(["reduced motion", "already entered"])("skips entrance and delay for %s", mode => {
    motionState.reduced = mode === "reduced motion";
    render(<ScanEntrance enabled={mode !== "already entered"}>Ready</ScanEntrance>);
    expect(motionState.props.initial).toBe(false);
    expect(motionState.props.transition).toEqual({ duration: 0 });
});

test("retains the element and keyboard focus across content updates", () => {
    const { rerender } = render(<ScanEntrance as="section" aria-label="Scan A"><select aria-label="Select scan A"><option>Old</option></select></ScanEntrance>);
    const section = screen.getByRole("region");
    const select = screen.getByRole("combobox");
    select.focus();
    rerender(<ScanEntrance as="section" aria-label="Scan A"><select aria-label="Select scan A"><option>New</option></select></ScanEntrance>);
    expect(screen.getByRole("region")).toBe(section);
    expect(screen.getByRole("combobox")).toBe(select);
    expect(document.activeElement).toBe(select);
});
