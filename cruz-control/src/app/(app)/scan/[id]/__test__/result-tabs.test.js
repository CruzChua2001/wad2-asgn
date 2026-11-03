import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import ResultTabs from "../result-tabs";

const route = vi.hoisted(() => ({ pathname: "/scan/abc", reduceMotion: false }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname, useParams: () => ({ id: "abc" }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a> }));
vi.mock("motion/react", async original => ({ ...await original(), useReducedMotion: () => route.reduceMotion }));

// jsdom has no layout, so the strip's size and each tab's place are set here. A phone: 5 tabs, 343px wide strip
const TAB_LEFT = { "/scan/abc": 0, "/scan/abc/fix-guide": 130, "/scan/abc/checklist": 212, "/scan/abc/report-card": 294, "/scan/abc/compare": 396 };
const TAB_WIDTH = 80;
const strip = { clientWidth: 343, scrollWidth: 480, scrollLeft: 0 };

const isStrip = element => element.tagName === "DIV" && element.parentElement?.tagName === "NAV";

let observers;
let scrollTo;

beforeEach(() => {
    route.pathname = "/scan/abc";
    route.reduceMotion = false;
    Object.assign(strip, { clientWidth: 343, scrollWidth: 480, scrollLeft: 0 });
    observers = [];

    vi.stubGlobal("ResizeObserver", class {
        constructor(callback) { this.callback = callback; observers.push(this); }
        observe() {}
        disconnect() {}
    });
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockImplementation(function () { return isStrip(this) ? strip.clientWidth : 0; });
    vi.spyOn(HTMLElement.prototype, "scrollWidth", "get").mockImplementation(function () { return isStrip(this) ? strip.scrollWidth : 0; });
    vi.spyOn(HTMLElement.prototype, "offsetLeft", "get").mockImplementation(function () { return TAB_LEFT[this.getAttribute("href")] ?? 0; });
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(function () { return this.getAttribute("href") ? TAB_WIDTH : 0; });
    Object.defineProperty(Element.prototype, "scrollLeft", {
        configurable: true,
        get() { return isStrip(this) ? strip.scrollLeft : 0; },
        set(value) { if (isStrip(this)) strip.scrollLeft = value; },
    });
    scrollTo = vi.fn(function ({ left }) { strip.scrollLeft = left; });
    HTMLElement.prototype.scrollTo = scrollTo;
    HTMLElement.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete Element.prototype.scrollLeft;
    delete HTMLElement.prototype.scrollTo;
    delete HTMLElement.prototype.scrollIntoView;
});

const showTabs = () => render(<ResultTabs hasRepository={false} findingsCount={10} />);
const scroller = () => screen.getByRole("navigation", { name: "Scan result sections" }).firstElementChild;
const measure = () => act(() => observers.forEach(observer => observer.callback([])));
const scrollStripTo = left => {
    strip.scrollLeft = left;
    fireEvent.scroll(scroller());
};

test("shows the five tabs and marks the current one", () => {
    route.pathname = "/scan/abc/checklist";
    showTabs();

    const links = screen.getByRole("navigation", { name: "Scan result sections" }).querySelectorAll("a");
    expect(links).toHaveLength(5);
    expect(screen.getByRole("link", { name: "Checklist" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("link", { name: /Overview/ }).textContent).toContain("10 findings");
});

test("fades the right side at the start, where there are more tabs", () => {
    showTabs();
    measure();

    expect(scroller().hasAttribute("data-fade")).toBe(true);
    expect(scroller().style.getPropertyValue("--fade-start")).toBe("0px");
    expect(scroller().style.getPropertyValue("--fade-end")).toBe("28px");
});

test("fades both sides in the middle and only the left at the end", () => {
    showTabs();
    measure();

    scrollStripTo(60);
    expect(scroller().style.getPropertyValue("--fade-start")).toBe("28px");
    expect(scroller().style.getPropertyValue("--fade-end")).toBe("28px");

    scrollStripTo(137);
    expect(scroller().style.getPropertyValue("--fade-start")).toBe("28px");
    expect(scroller().style.getPropertyValue("--fade-end")).toBe("0px");
});

test("no fade when every tab fits", () => {
    Object.assign(strip, { clientWidth: 900, scrollWidth: 900 });
    showTabs();
    measure();

    expect(scroller().hasAttribute("data-fade")).toBe(false);
});

test("a fade appears when the strip is resized so tabs no longer fit", () => {
    Object.assign(strip, { clientWidth: 900, scrollWidth: 900 });
    showTabs();
    measure();
    expect(scroller().hasAttribute("data-fade")).toBe(false);

    Object.assign(strip, { clientWidth: 343, scrollWidth: 480 });
    measure();
    expect(scroller().hasAttribute("data-fade")).toBe(true);
});

test("scrolls a hidden active tab into view, with the end of the strip as far as it goes", () => {
    route.pathname = "/scan/abc/compare";
    showTabs();

    // The Compare tab ends at 476, and the strip ends at 480 - 343 = 137
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ left: 137, behavior: "auto" });
});

test("scrolls to show part of the next tab after the active one", () => {
    route.pathname = "/scan/abc/fix-guide";
    Object.assign(strip, { scrollWidth: 800 });
    showTabs();

    // Fix Guide ends at 210, plus 40 of the next tab, minus the 343px strip: already inside, so no scroll
    expect(scrollTo).not.toHaveBeenCalled();

    route.pathname = "/scan/abc/report-card";
    render(<ResultTabs hasRepository={false} findingsCount={10} />);
    // Report Card ends at 374, plus 40, minus 343 = 71
    expect(scrollTo).toHaveBeenCalledWith({ left: 71, behavior: "auto" });
});

test("leaves the strip alone when the active tab is already in view", () => {
    showTabs();

    expect(scrollTo).not.toHaveBeenCalled();
});

test("only the strip moves, never the page", () => {
    route.pathname = "/scan/abc/compare";
    showTabs();

    expect(HTMLElement.prototype.scrollIntoView).not.toHaveBeenCalled();
});

test("later changes of page scroll smoothly, and instantly with reduced motion", () => {
    route.pathname = "/scan/abc/compare";
    const view = showTabs();
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 137, behavior: "auto" });

    route.pathname = "/scan/abc";
    view.rerender(<ResultTabs hasRepository={false} findingsCount={10} />);
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 0, behavior: "smooth" });

    route.reduceMotion = true;
    route.pathname = "/scan/abc/compare";
    view.rerender(<ResultTabs hasRepository={false} findingsCount={10} />);
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 137, behavior: "auto" });
});

test("works where scrollTo and ResizeObserver are missing", () => {
    delete HTMLElement.prototype.scrollTo;
    vi.stubGlobal("ResizeObserver", undefined);
    route.pathname = "/scan/abc/compare";
    showTabs();

    expect(strip.scrollLeft).toBe(137);
    expect(scroller().hasAttribute("data-fade")).toBe(false);
});
