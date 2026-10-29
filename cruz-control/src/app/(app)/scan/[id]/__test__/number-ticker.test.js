import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import NumberTicker from "../number-ticker";

// Reduced motion so the number shows its final value straight away
vi.mock("motion/react", async importOriginal => ({
    ...await importOriginal(),
    useReducedMotion: () => true,
}));

// jsdom has no IntersectionObserver, which useInView uses to start once it's on screen
vi.stubGlobal("IntersectionObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
});

const showTicker = props => render(<NumberTicker aria-label="ticker" {...props} />);
const ticker = _ => screen.getByLabelText("ticker");

describe("NumberTicker with reduced motion", () => {
    test("shows the final value straight away", () => {
        showTicker({ value: 42 });

        expect(ticker().textContent).toBe("42");
    });

    test("ignores the start value and direction", () => {
        showTicker({ value: 42, startValue: 10, direction: "down" });

        expect(ticker().textContent).toBe("42");
    });

    test("rounds to the decimal places", () => {
        showTicker({ value: 3.14159, decimalPlaces: 2 });

        expect(ticker().textContent).toBe("3.14");
    });

    test("pads to the decimal places", () => {
        showTicker({ value: 7, decimalPlaces: 1 });

        expect(ticker().textContent).toBe("7.0");
    });

    test("rounds whole numbers and adds commas", () => {
        showTicker({ value: 1234.5 });

        expect(ticker().textContent).toBe("1,235");
    });

    test("adds the className after its own", () => {
        showTicker({ value: 1, className: "text-ink" });

        expect(ticker().className).toBe("number-ticker text-ink");
    });
});
