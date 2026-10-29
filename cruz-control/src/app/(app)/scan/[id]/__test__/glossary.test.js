import { describe, test, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { GLOSSARY, Term, withTerms } from "../glossary";

const showTerms = text => render(<p>{withTerms(text)}</p>);
const termNames = _ => screen.queryAllByRole("button").map(button => button.textContent);

describe("withTerms", () => {
    test("only wraps the first time a term appears", () => {
        showTerms("A CVE here and a CVE there");

        expect(termNames()).toEqual(["CVE"]);
    });

    test("matches whole words only", () => {
        expect(withTerms("export the list")).toBe("export the list");
        expect(withTerms("Two CVEs found")).toBe("Two CVEs found");
    });

    test("acronyms only match in capitals", () => {
        expect(withTerms("a cve here")).toBe("a cve here");
    });

    test("other terms match in any case", () => {
        showTerms("Port 22 is open");

        expect(termNames()).toEqual(["Port"]);
    });

    test("the longest term wins", () => {
        showTerms("Its CVSS is 9.8");

        expect(termNames()).toEqual(["CVSS"]);
    });

    test("matches .gitignore and SECURITY.md", () => {
        showTerms("Add .gitignore and SECURITY.md files");

        expect(termNames()).toEqual([".gitignore", "SECURITY.md"]);
    });

    test("text without terms comes back unchanged", () => {
        expect(withTerms("Nothing to see here")).toBe("Nothing to see here");
        expect(withTerms(5)).toBe(5);
    });
});

describe("Term popup", () => {
    test("is hidden until the term is hovered", () => {
        render(<Term term="CVE" />);
        const button = screen.getByRole("button", { name: "CVE" });

        expect(screen.queryByRole("tooltip")).toBeNull();
        expect(button.getAttribute("aria-describedby")).toBeNull();

        fireEvent.mouseEnter(button);
        const tooltip = screen.getByRole("tooltip");

        expect(tooltip.textContent).toContain(GLOSSARY.CVE);
        // Portalled into the body, so the card's overflow can't clip it
        expect(tooltip.parentElement).toBe(document.body);
        expect(button.getAttribute("aria-describedby")).toBe(tooltip.id);

        fireEvent.mouseLeave(button);

        expect(screen.queryByRole("tooltip")).toBeNull();
    });

    test("shows on focus and Esc hides it", () => {
        render(<Term term="HSTS" />);
        const button = screen.getByRole("button", { name: "HSTS" });

        fireEvent.focus(button);

        expect(screen.getByRole("tooltip").textContent).toContain(GLOSSARY.HSTS);

        fireEvent.keyDown(button, { key: "Escape" });

        expect(screen.queryByRole("tooltip")).toBeNull();
    });
});

describe("GLOSSARY", () => {
    test("every entry is a non-empty string", () => {
        for (const meaning of Object.values(GLOSSARY)) {
            expect(typeof meaning).toBe("string");
            expect(meaning.trim().length).toBeGreaterThan(0);
        }
    });
});
