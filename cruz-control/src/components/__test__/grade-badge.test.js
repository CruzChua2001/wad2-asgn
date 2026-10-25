import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import GradeBadge, { gradeFor } from "../grade-badge";

describe("gradeFor", () => {
    test.each([
        [100, "A"],
        [90, "A"],
        [89, "B"],
        [80, "B"],
        [79, "C"],
        [70, "C"],
        [69, "D"],
        [60, "D"],
        [59, "F"],
        [0, "F"],
    ])("%i gets %s", (score, grade) => {
        expect(gradeFor(score)).toBe(grade);
    });

    test("doesn't round a score just under a cut-off", () => {
        expect(gradeFor(89.9)).toBe("B");
        expect(gradeFor(59.5)).toBe("F");
    });
});

describe("GradeBadge", () => {
    test("shows the letter and reads it out for screen readers", () => {
        render(<GradeBadge grade="B" />);

        expect(screen.getByText("B")).toBeTruthy();
        expect(screen.getByText("Grade B")).toBeTruthy();
    });

    test("shows ? when there is no grade yet", () => {
        const { container } = render(<GradeBadge grade={null} />);

        expect(screen.getByText("?")).toBeTruthy();
        expect(screen.getByText("No grade yet")).toBeTruthy();
        expect(container.firstChild.className).toContain("text-muted");
    });

    test.each([
        ["A", "text-accent"],
        ["B", "text-accent"],
        ["C", "text-warm"],
        ["D", "text-warm"],
        ["F", "text-critical"],
    ])("grade %s uses %s", (grade, tone) => {
        const { container } = render(<GradeBadge grade={grade} />);

        expect(container.firstChild.className).toContain(tone);
    });

    test("an unknown grade falls back to the plain colours", () => {
        const { container } = render(<GradeBadge grade="X" />);

        expect(container.firstChild.className).toContain("text-muted");
        expect(screen.getByText("Grade X")).toBeTruthy();
    });

    test("is medium by default and takes the other sizes", () => {
        const medium = render(<GradeBadge grade="A" />).container.firstChild;
        const small = render(<GradeBadge grade="A" size="sm" />).container.firstChild;
        const large = render(<GradeBadge grade="A" size="lg" />).container.firstChild;

        expect(medium.className).toContain("size-12");
        expect(small.className).toContain("size-7");
        expect(large.className).toContain("size-24");
    });

    test("adds the className it's given", () => {
        const { container } = render(<GradeBadge grade="A" className="-rotate-6" />);

        expect(container.firstChild.className).toContain("-rotate-6");
    });
});
