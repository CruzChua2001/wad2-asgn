import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import FixText from "../fix-text";

// The words in these fixes aren't glossary terms, so no Term buttons get in the way
const showFix = (text, props = {}) => render(<FixText text={text} {...props} />).container;

describe("FixText one-line fixes", () => {
    test("shows the label and the fix", () => {
        const container = showFix("Turn on two-factor sign in.");

        expect(screen.getByText("What to do:")).toBeTruthy();
        expect(container.textContent).toContain("Turn on two-factor sign in.");
    });

    test("label={null} hides the label", () => {
        const container = showFix("Turn on two-factor sign in.", { label: null });

        expect(screen.queryByText("What to do:")).toBeNull();
        expect(container.textContent).toBe("Turn on two-factor sign in.");
    });

    test("never injects the text as HTML", () => {
        const container = showFix("<b>x</b>");

        expect(container.querySelector("b")).toBeNull();
        expect(container.textContent).toContain("<b>x</b>");
    });
});

describe("FixText steps", () => {
    test("numbered lines become a list with the label in bold", () => {
        const container = showFix("1. Open settings: go to the page\n2. Save it: click save");
        const items = container.querySelectorAll("ol li");

        expect(container.querySelectorAll("ol").length).toBe(1);
        expect(items.length).toBe(2);
        expect(items[0].querySelector("strong").textContent).toBe("Open settings:");
        expect(items[0].textContent).toContain("go to the page");
        expect(items[1].querySelector("strong").textContent).toBe("Save it:");
    });

    test("the list starts at the first step's number", () => {
        const container = showFix("3. Open settings: go to the page\n4. Save it: click save");

        expect(container.querySelector("ol").getAttribute("start")).toBe("3");
    });

    test("a step with code before its colon has no bold label", () => {
        const container = showFix("1. Run `a:b` first\n2. Save it: click save");
        const items = container.querySelectorAll("ol li");

        expect(items[0].querySelector("strong")).toBeNull();
        expect(items[0].querySelector("code").textContent).toBe("a:b");
    });

    test("`code` becomes a code element", () => {
        const container = showFix("Run `npm audit fix` now.");

        expect(container.querySelector("code").textContent).toBe("npm audit fix");
        expect(container.textContent).not.toContain("`");
    });

    test("a ``` block becomes a pre that keeps its line breaks", () => {
        const container = showFix("1. Add this: to the file\n```\nline one\n  line two\n```");

        expect(container.querySelector("pre").textContent).toBe("line one\n  line two");
    });

    test("a Tip: line shows on its own after the steps", () => {
        const container = showFix("1. Open settings: go to the page\nTip: Do it again next month.");

        expect(screen.getByText("Tip:")).toBeTruthy();
        expect(container.textContent).toContain("Do it again next month.");
        expect(container.querySelector("ol").textContent).not.toContain("Do it again next month.");
    });
});
