import { describe, test, expect, vi, afterEach } from "vitest";
import { useState } from "react";
import { render, screen, within, fireEvent, waitFor } from "@testing-library/react";
import OverviewCarousel from "../overview-carousel";

const slides = [
    { key: "map", label: "Servers", summary: <span>9 servers</span>, node: <p>Map card</p> },
    { key: "score", label: "Score", summary: <span>50</span>, node: <p>Score card <button type="button">Score button</button></p> },
    { key: "findings", label: "Findings", summary: <span>3 findings</span>, node: <p>Findings card <input aria-label="Plan to fix" /></p> },
];

const showCarousel = (active = "map", props = {}) => {
    const onChange = vi.fn();
    const view = render(<OverviewCarousel slides={slides} active={active} onChange={onChange} reduceMotion {...props} />);
    return { onChange, view };
}

const tabs = _ => within(screen.getByRole("group", { name: "Choose a card" })).getAllByRole("button");
const tabLabel = tab => tab.firstChild.textContent;
const currentTab = _ => tabs().find(tab => tab.getAttribute("aria-current") === "true");
const region = _ => screen.getByRole("region", { name: "Overview cards" });
const slideOf = text => screen.getByText(text).closest("[data-slide]");
const slideNamed = label => document.querySelector(`[data-slide][aria-label$=": ${label}"]`);
const isInert = text => slideOf(text).hasAttribute("inert");
const isHidden = text => slideOf(text).classList.contains("invisible");
const shownCards = _ => [...document.querySelectorAll("[data-slide]")].filter(slide => !slide.classList.contains("invisible"));

// Keeps the front card in state like the page does, so the turn animation really plays
const Turning = ({ start = "map", reduceMotion = false }) => {
    const [active, setActive] = useState(start);
    return <OverviewCarousel slides={slides} active={active} onChange={setActive} reduceMotion={reduceMotion} />;
}

afterEach(() => {
    delete window.matchMedia;
});

describe("OverviewCarousel tabs", () => {
    test("shows one tab per card and marks the front one", () => {
        showCarousel("score");

        expect(tabs().map(tabLabel)).toEqual(["Servers", "Score", "Findings"]);
        expect(tabLabel(currentTab())).toBe("Score");
        expect(tabs().filter(tab => tab.hasAttribute("aria-current"))).toHaveLength(1);
    });

    test("each tab shows its card's summary after the label", () => {
        showCarousel("map");

        expect(tabs().map(tab => tab.textContent)).toEqual(["Servers9 servers", "Score50", "Findings3 findings"]);
        expect(screen.getByRole("button", { name: /^Findings/ })).toBe(tabs()[2]);
    });

    test("starts on the first card when the active key isn't a card", () => {
        showCarousel(null);

        expect(tabLabel(currentTab())).toBe("Servers");
    });

    test("clicking a tab picks that card", () => {
        const { onChange } = showCarousel("map");

        fireEvent.click(screen.getByRole("button", { name: /^Findings/ }));

        expect(onChange).toHaveBeenCalledWith("findings");
    });

    test("Next and Previous move one card", () => {
        const { onChange } = showCarousel("score");

        fireEvent.click(screen.getByRole("button", { name: "Next card" }));
        fireEvent.click(screen.getByRole("button", { name: "Previous card" }));

        expect(onChange.mock.calls).toEqual([["findings"], ["map"]]);
    });

    test("wraps around at both ends", () => {
        const { onChange } = showCarousel("map");

        fireEvent.click(screen.getByRole("button", { name: "Previous card" }));

        expect(onChange).toHaveBeenLastCalledWith("findings");

        const onLastChange = vi.fn();
        render(<OverviewCarousel slides={slides} active="findings" onChange={onLastChange} reduceMotion />);
        fireEvent.click(screen.getAllByRole("button", { name: "Next card" })[1]);

        expect(onLastChange).toHaveBeenCalledWith("map");
    });

    test("the cards behind can't be clicked to the front any more", () => {
        showCarousel("map");

        expect(document.querySelectorAll("button[aria-hidden='true']")).toHaveLength(0);
    });

    test("shows the extra controls in the tab row", () => {
        showCarousel("map", { controls: <button type="button">Grid</button> });

        expect(within(region()).getByRole("button", { name: "Grid" })).toBeTruthy();
    });

    test("the extra controls are outside the cards, so they never turn away", () => {
        showCarousel("map", { controls: <button type="button">Grid</button> });

        const grid = screen.getByRole("button", { name: "Grid" });
        expect(grid.closest("[data-slide]")).toBeNull();
        expect(within(screen.getByRole("group", { name: "Choose a card" })).queryByRole("button", { name: "Grid" })).toBeNull();
    });

    test("has no extra controls when none are given", () => {
        showCarousel("map");

        expect(tabs()).toHaveLength(3);
        expect(screen.getAllByRole("button").map(button => button.getAttribute("aria-label") || tabLabel(button))).toEqual([
            "Previous card", "Servers", "Score", "Findings", "Next card",
        ]);
    });

    test("four cards get four columns from md up", () => {
        const four = [...slides, { key: "repo", label: "Repository", node: <p>Repo card</p> }];
        render(<OverviewCarousel slides={four} active="repo" onChange={vi.fn()} reduceMotion />);

        expect(screen.getByRole("group", { name: "Choose a card" }).className).toContain("grid-cols-2 md:grid-cols-4");
        expect(screen.getByText(/^Showing /).textContent).toBe("Showing Repository, card 4 of 4");
    });
});

describe("OverviewCarousel keyboard", () => {
    test("the arrow keys turn the carousel", () => {
        const { onChange } = showCarousel("score");

        fireEvent.keyDown(region(), { key: "ArrowRight" });
        fireEvent.keyDown(region(), { key: "ArrowLeft" });

        expect(onChange.mock.calls).toEqual([["findings"], ["map"]]);
    });

    test("other keys do nothing", () => {
        const { onChange } = showCarousel("score");

        fireEvent.keyDown(region(), { key: "Enter" });

        expect(onChange).not.toHaveBeenCalled();
    });

    test("arrow keys inside an input are left alone", () => {
        const { onChange } = showCarousel("findings");

        fireEvent.keyDown(screen.getByRole("textbox", { name: "Plan to fix" }), { key: "ArrowLeft" });

        expect(onChange).not.toHaveBeenCalled();
    });

    test("an arrow key from inside a card moves focus back to the carousel", () => {
        const { onChange } = showCarousel("score");
        const button = screen.getByRole("button", { name: "Score button" });
        button.focus();

        fireEvent.keyDown(button, { key: "ArrowRight" });

        expect(onChange).toHaveBeenCalledWith("findings");
        expect(document.activeElement).toBe(region());
    });
});

describe("OverviewCarousel slides", () => {
    test("labels each slide with its place", () => {
        showCarousel("map");

        expect(screen.getByRole("group", { name: "1 of 3: Servers" }).getAttribute("aria-roledescription")).toBe("slide");
        expect(screen.getByRole("group", { name: "3 of 3: Findings" })).toBeTruthy();
    });

    test("only the front card can be used", () => {
        showCarousel("score");

        expect(slideNamed("Servers").hasAttribute("inert")).toBe(true);
        expect(isInert("Score card")).toBe(false);
        expect(slideNamed("Findings").hasAttribute("inert")).toBe(true);
    });

    test("the front card is in the page flow and the others are hidden on top of it", () => {
        showCarousel("score");

        expect(slideOf("Score card").className).toContain("relative");
        expect(slideOf("Score card").className).not.toContain("invisible");
        expect(slideNamed("Servers").className).toContain("absolute");
        expect(slideNamed("Servers").className).toContain("invisible");
    });

    test("keeps every card mounted when the front one changes", () => {
        const { view, onChange } = showCarousel("map");
        const mapCard = screen.getByText("Map card");

        view.rerender(<OverviewCarousel slides={slides} active="findings" onChange={onChange} reduceMotion />);

        expect(screen.getByText("Map card")).toBe(mapCard);
        expect(isInert("Map card")).toBe(true);
        expect(slideOf("Map card").className).toContain("invisible");
        expect(isInert("Findings card")).toBe(false);
        expect(tabLabel(currentTab())).toBe("Findings");
    });

    test("tells screen readers which card is showing", () => {
        showCarousel("score");

        expect(screen.getByText(/^Showing /).textContent).toBe("Showing Score, card 2 of 3");
    });
});

describe("OverviewCarousel turning", () => {
    test("the old card stays shown while it turns away, then hides", async () => {
        render(<Turning />);

        fireEvent.click(screen.getByRole("button", { name: "Next card" }));

        // Mid-turn both cards show, but only the new one can be used
        expect(isHidden("Map card")).toBe(false);
        expect(isInert("Map card")).toBe(true);
        expect(isInert("Score card")).toBe(false);
        expect(shownCards()).toHaveLength(2);

        await waitFor(() => expect(isHidden("Map card")).toBe(true));
        expect(shownCards()).toEqual([slideOf("Score card")]);
    });

    test("Next turns forwards and Previous turns backwards", () => {
        render(<Turning start="score" />);

        fireEvent.click(screen.getByRole("button", { name: "Next card" }));

        expect(slideOf("Findings card").style.transformOrigin).toBe("right top");
        expect(slideOf("Score card").style.transformOrigin).toBe("left top");

        fireEvent.click(screen.getByRole("button", { name: "Previous card" }));

        expect(slideOf("Score card").style.transformOrigin).toBe("left top");
        expect(slideOf("Findings card").style.transformOrigin).toBe("right top");
    });

    test("Next on the last card wraps but still turns forwards", () => {
        render(<Turning start="findings" />);

        fireEvent.click(screen.getByRole("button", { name: "Next card" }));

        expect(tabLabel(currentTab())).toBe("Servers");
        expect(slideOf("Map card").style.transformOrigin).toBe("right top");
    });

    test("Previous on the first card wraps but still turns backwards", () => {
        render(<Turning start="map" />);

        fireEvent.click(screen.getByRole("button", { name: "Previous card" }));

        expect(tabLabel(currentTab())).toBe("Findings");
        expect(slideOf("Findings card").style.transformOrigin).toBe("left top");
    });

    test("clicking the first tab from the last card turns backwards", () => {
        render(<Turning start="findings" />);

        fireEvent.click(tabs()[0]);

        expect(tabLabel(currentTab())).toBe("Servers");
        expect(slideOf("Map card").style.transformOrigin).toBe("left top");
    });

    test("a card change from the page turns too, in list order", async () => {
        const onChange = vi.fn();
        const { rerender } = render(<OverviewCarousel slides={slides} active="findings" onChange={onChange} reduceMotion={false} />);

        rerender(<OverviewCarousel slides={slides} active="score" onChange={onChange} reduceMotion={false} />);

        expect(slideOf("Score card").style.transformOrigin).toBe("left top");
        expect(isHidden("Findings card")).toBe(false);
        expect(onChange).not.toHaveBeenCalled();

        await waitFor(() => expect(isHidden("Findings card")).toBe(true));
    });

    test("switching twice quickly only keeps the last card turning away", async () => {
        render(<Turning />);

        fireEvent.click(screen.getByRole("button", { name: "Next card" }));
        fireEvent.click(screen.getByRole("button", { name: "Next card" }));

        expect(tabLabel(currentTab())).toBe("Findings");
        expect(isHidden("Map card")).toBe(true);
        expect(shownCards()).toEqual([slideOf("Score card"), slideOf("Findings card")]);

        await waitFor(() => expect(shownCards()).toEqual([slideOf("Findings card")]));
    });

    test("with reduced motion the old card hides straight away", () => {
        render(<Turning reduceMotion />);

        fireEvent.click(screen.getByRole("button", { name: "Next card" }));

        expect(isHidden("Map card")).toBe(true);
        expect(shownCards()).toEqual([slideOf("Score card")]);

        fireEvent.click(tabs()[2]);

        expect(isHidden("Score card")).toBe(true);
        expect(shownCards()).toEqual([slideOf("Findings card")]);
    });

    test("an arrow key turns the same way as the buttons", () => {
        render(<Turning start="findings" />);

        fireEvent.keyDown(region(), { key: "ArrowRight" });

        expect(tabLabel(currentTab())).toBe("Servers");
        expect(slideOf("Map card").style.transformOrigin).toBe("right top");
    });
});

describe("OverviewCarousel on phones", () => {
    test("still has every control at phone width", () => {
        window.matchMedia = vi.fn(_ => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
        const { onChange } = showCarousel("map");

        expect(window.matchMedia).toHaveBeenCalledWith("(max-width: 767px)");
        expect(tabs()).toHaveLength(3);
        expect(slideNamed("Score").hasAttribute("inert")).toBe(true);

        fireEvent.click(screen.getByRole("button", { name: "Next card" }));

        expect(onChange).toHaveBeenCalledWith("score");
    });

    test("works when the browser has no matchMedia", () => {
        delete window.matchMedia;
        const { onChange } = showCarousel("map");

        fireEvent.keyDown(region(), { key: "ArrowRight" });

        expect(onChange).toHaveBeenCalledWith("score");
    });
});
