import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { useState } from "react";
import { render, screen, within, fireEvent, act } from "@testing-library/react";
import OverviewCarousel from "../overview-carousel";

// jsdom can't move a pointer far enough for motion's drag, so the real motion.div
// is wrapped to keep its props, and the tests call the drag handlers themselves
const seen = vi.hoisted(() => ({ strip: null, cards: {} }));

vi.mock("motion/react", async importOriginal => {
    const actual = await importOriginal();
    const Div = props => {
        if ("drag" in props) seen.strip = props;
        if (props["data-slide"]) seen.cards[props["aria-label"]] = props;
        return <actual.motion.div {...props} />;
    };
    return { ...actual, motion: new Proxy(actual.motion, { get: (target, key) => key === "div" ? Div : target[key] }) };
});

const slides = [
    { key: "map", label: "Servers", node: <p>Map card</p> },
    { key: "score", label: "Score", node: <p>Score card</p> },
    { key: "findings", label: "Findings", node: <p>Findings card</p> },
];

const phone = matches => {
    window.matchMedia = vi.fn(_ => ({ matches, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
}

const showCarousel = (active = "score", reduceMotion = true) => {
    const onChange = vi.fn();
    render(<OverviewCarousel slides={slides} active={active} onChange={onChange} reduceMotion={reduceMotion} />);
    return onChange;
}

const tab = label => within(screen.getByRole("group", { name: "Choose a card" })).getByRole("button", { name: label });
const swipe = x => act(() => {
    seen.strip.onDragStart();
    seen.strip.onDragEnd({}, { offset: { x, y: 0 } });
});

beforeEach(() => {
    seen.strip = null;
    seen.cards = {};
});

afterEach(() => {
    delete window.matchMedia;
});

describe("OverviewCarousel swiping", () => {
    test("only phones can swipe the tab strip", () => {
        phone(false);
        showCarousel();

        expect(seen.strip.drag).toBe(false);
    });

    test("phones can swipe the tab strip sideways", () => {
        phone(true);
        showCarousel();

        expect(seen.strip.drag).toBe("x");
    });

    test("swiping left goes to the next card and right to the one before", () => {
        phone(true);
        const onChange = showCarousel("score");

        swipe(-60);
        swipe(60);

        expect(onChange.mock.calls).toEqual([["findings"], ["map"]]);
    });

    test("a short swipe does nothing", () => {
        phone(true);
        const onChange = showCarousel("score");

        swipe(-40);
        swipe(40);
        swipe(0);

        expect(onChange).not.toHaveBeenCalled();
    });

    test("swiping wraps around at the ends", () => {
        phone(true);
        const onChange = showCarousel("findings");

        swipe(-41);

        expect(onChange).toHaveBeenCalledWith("map");
    });

    test("the click at the end of a swipe doesn't also pick the tab", () => {
        phone(true);
        const onChange = showCarousel("score");

        fireEvent.pointerDown(tab("Servers"));
        swipe(-10);
        fireEvent.click(tab("Servers"));

        expect(onChange).not.toHaveBeenCalled();

        // The next tap is a normal click again
        fireEvent.pointerDown(tab("Servers"));
        fireEvent.click(tab("Servers"));

        expect(onChange).toHaveBeenCalledWith("map");
    });

    test("after a swipe, the next tap on Next works again", () => {
        phone(true);
        const onChange = showCarousel("score");

        swipe(-60);
        fireEvent.click(screen.getByRole("button", { name: "Next card" }));

        expect(onChange.mock.calls).toEqual([["findings"]]);

        fireEvent.pointerDown(screen.getByRole("button", { name: "Next card" }));
        fireEvent.click(screen.getByRole("button", { name: "Next card" }));

        expect(onChange.mock.calls).toEqual([["findings"], ["findings"]]);
    });
});

describe("OverviewCarousel turn styles", () => {
    // Keeps the front card in state like the page does
    const Turning = ({ start }) => {
        const [active, setActive] = useState(start);
        return <OverviewCarousel slides={slides} active={active} onChange={setActive} reduceMotion={false} />;
    }

    test("bigger screens turn the card in 3D", () => {
        phone(false);
        render(<Turning start="map" />);

        fireEvent.click(screen.getByRole("button", { name: "Next card" }));

        expect(seen.cards["2 of 3: Score"].animate).toEqual({ x: ["6%", "0%"], rotateY: [-35, 0], opacity: [0, 1] });
        expect(seen.cards["1 of 3: Servers"].animate).toEqual({ x: "-6%", rotateY: 35, opacity: 0 });
    });

    test("phones slide the card flat", () => {
        phone(true);
        render(<Turning start="score" />);

        fireEvent.click(screen.getByRole("button", { name: "Previous card" }));

        expect(seen.cards["1 of 3: Servers"].animate).toEqual({ x: ["-40%", "0%"], rotateY: 0, opacity: [0, 1] });
        expect(seen.cards["2 of 3: Score"].animate).toEqual({ x: "40%", rotateY: 0, opacity: 0 });
    });

    test("cards that aren't turning just stay faded out", () => {
        phone(false);
        render(<Turning start="map" />);

        fireEvent.click(screen.getByRole("button", { name: "Next card" }));

        expect(seen.cards["3 of 3: Findings"].animate).toEqual({ opacity: 0 });
    });
});
