import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ScoreSparkline, { scoreTone } from "../score-sparkline";

// The [x, y] of each point on the line
const pointsOf = container => container.querySelector("polyline")
    .getAttribute("points")
    .split(" ")
    .map(point => point.split(",").map(Number));

describe("scoreTone", () => {
    test.each([
        [100, "text-accent"],
        [80, "text-accent"],
        [79, "text-warm"],
        [60, "text-warm"],
        [59, "text-critical"],
        [0, "text-critical"],
    ])("%i is %s", (score, tone) => {
        expect(scoreTone(score)).toBe(tone);
    });
});

describe("ScoreSparkline", () => {
    test("draws nothing without at least two scores", () => {
        expect(render(<ScoreSparkline />).container.innerHTML).toBe("");
        expect(render(<ScoreSparkline scores={[]} />).container.innerHTML).toBe("");
        expect(render(<ScoreSparkline scores={[72]} />).container.innerHTML).toBe("");
    });

    test("has one point per score, oldest on the left", () => {
        const { container } = render(<ScoreSparkline scores={[40, 55, 70, 90]} />);
        const xs = pointsOf(container).map(([x]) => x);

        expect(xs).toHaveLength(4);
        expect(xs[0]).toBe(4);
        expect(xs.at(-1)).toBe(92);
        expect(xs).toEqual([...xs].sort((a, b) => a - b));
    });

    test("draws a higher score higher up", () => {
        const { container } = render(<ScoreSparkline scores={[40, 90]} />);
        const [first, last] = pointsOf(container);

        expect(last[1]).toBeLessThan(first[1]);
    });

    test.each([
        [[0, 100]],
        [[100, 100]],
        [[0, 0]],
        [[50, 50, 50]],
    ])("stays inside the box for %j", scores => {
        const { container } = render(<ScoreSparkline scores={scores} />);

        for (const [x, y] of pointsOf(container)) {
            expect(Number.isNaN(x) || Number.isNaN(y)).toBe(false);
            expect(y).toBeGreaterThanOrEqual(4);
            expect(y).toBeLessThanOrEqual(24);
        }
    });

    test("colours the last dot by the latest score", () => {
        const down = render(<ScoreSparkline scores={[90, 40]} />).container;
        const up = render(<ScoreSparkline scores={[40, 90]} />).container;

        expect(down.querySelector("circle").getAttribute("class")).toContain("text-critical");
        expect(up.querySelector("circle").getAttribute("class")).toContain("text-accent");
    });

    test("puts the last dot at the end of the line", () => {
        const { container } = render(<ScoreSparkline scores={[40, 55, 70]} />);
        const circle = container.querySelector("circle");
        const [x, y] = pointsOf(container).at(-1);

        expect(Number(circle.getAttribute("cx"))).toBe(x);
        expect(Number(circle.getAttribute("cy"))).toBe(y);
    });

    test("describes the change for screen readers", () => {
        render(<ScoreSparkline scores={[40, 55, 90]} />);

        expect(screen.getByText("Score went from 40 to 90 over the last 3 scans")).toBeTruthy();
    });
});
