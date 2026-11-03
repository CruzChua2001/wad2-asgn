import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import CardCarousel from "../card-carousel";

// jsdom can't lay anything out, so the Swiper is a stub the tests can drive
const stub = vi.hoisted(() => ({ swiper: null, props: null }));
vi.mock("swiper/react", () => ({
    Swiper: function MockSwiper({ children, onSwiper, onSlidesUpdated, ...props }) {
        stub.props = props;
        stub.onSlidesUpdated = onSlidesUpdated;
        stub.onSwiper = onSwiper;
        return <ul>{children}</ul>;
    },
    SwiperSlide: ({ children }) => <li>{children}</li>,
}));
vi.mock("swiper/modules", () => ({ EffectCoverflow: {}, Keyboard: {}, Mousewheel: {}, FreeMode: {} }));
vi.mock("swiper/css", () => ({}));
vi.mock("swiper/css/effect-coverflow", () => ({}));
vi.mock("swiper/css/navigation", () => ({}));
vi.mock("motion/react", () => ({ useReducedMotion: () => false }));

const swiperAt = ({ slidesSizesGrid = [420, 420, 420], ...overrides } = {}) => ({
    destroyed: false,
    size: 800,
    params: { spaceBetween: 24 },
    slidesSizesGrid,
    slides: slidesSizesGrid,
    activeIndex: 0,
    isBeginning: true,
    isEnd: false,
    slidePrev: vi.fn(),
    slideNext: vi.fn(),
    slideTo: vi.fn(),
    ...overrides,
});

const show = (cards = 3, props = {}) => render(
    <CardCarousel label="Projects" {...props}>
        {Array.from({ length: cards }, (_, i) => <li key={i}>Card {i}</li>)}
    </CardCarousel>
);

// Gives the carousel a Swiper and tells it the slides were measured. Async so a queued microtask runs
const measure = async swiper => {
    await act(async () => {
        stub.onSwiper(swiper);
        stub.onSlidesUpdated(swiper);
    });
};

beforeEach(() => {
    stub.swiper = null;
    stub.props = null;
});

test("names the carousel for screen readers", () => {
    show();
    expect(screen.getByRole("region", { name: "Projects" }).getAttribute("aria-roledescription")).toBe("carousel");
});

test("cards that don't fit get arrows and one dot per card, with the front card marked", async () => {
    show();
    await measure(swiperAt({ activeIndex: 1, isBeginning: false }));

    const dots = screen.getAllByRole("button", { name: /^Card \d of 3$/ });
    expect(dots).toHaveLength(3);
    expect(dots.map(dot => dot.getAttribute("aria-current"))).toEqual([null, "true", null]);
    expect(screen.getByRole("button", { name: "Previous card" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Next card" })).toBeTruthy();
    expect(stub.props.allowTouchMove).toBe(true);
    expect(stub.props.centeredSlidesBounds).toBe(false);
});

test("the arrows and dots move the Swiper", async () => {
    show();
    const swiper = swiperAt({ activeIndex: 1, isBeginning: false });
    await measure(swiper);

    fireEvent.click(screen.getByRole("button", { name: "Previous card" }));
    fireEvent.click(screen.getByRole("button", { name: "Next card" }));
    fireEvent.click(screen.getByRole("button", { name: "Card 3 of 3" }));
    expect(swiper.slidePrev).toHaveBeenCalledTimes(1);
    expect(swiper.slideNext).toHaveBeenCalledTimes(1);
    expect(swiper.slideTo).toHaveBeenCalledWith(2, undefined);
});

test("the arrow at either end is marked disabled and does nothing", async () => {
    show();
    const swiper = swiperAt();
    await measure(swiper);

    const previous = screen.getByRole("button", { name: "Previous card" });
    expect(previous.getAttribute("aria-disabled")).toBe("true");
    expect(screen.getByRole("button", { name: "Next card" }).getAttribute("aria-disabled")).toBe("false");
    fireEvent.click(previous);
    expect(swiper.slidePrev).not.toHaveBeenCalled();
});

test("cards that all fit are centered as a group with nothing to scroll", async () => {
    show(2);
    await measure(swiperAt({ size: 1122, slidesSizesGrid: [420, 420] }));

    expect(screen.queryByRole("button", { name: "Next card" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Choose a card" })).toBeNull();
    expect(stub.props.centerInsufficientSlides).toBe(true);
    expect(stub.props.centeredSlidesBounds).toBe(true);
    expect(stub.props.allowTouchMove).toBe(false);
});

test("two cards that are a little too wide to fit keep scrolling", async () => {
    show(2);
    await measure(swiperAt({ size: 800, slidesSizesGrid: [420, 420] }));

    expect(screen.getByRole("button", { name: "Next card" })).toBeTruthy();
    expect(stub.props.centerInsufficientSlides).toBe(false);
});

test("a single card has no arrows or dots", () => {
    show(1);
    expect(screen.queryByRole("button", { name: "Next card" })).toBeNull();
    expect(screen.queryByRole("group", { name: "Choose a card" })).toBeNull();
});

test("ignores a Swiper that hasn't measured its slides yet", async () => {
    show(2);
    await measure(swiperAt({ size: 0, slidesSizesGrid: [] }));

    expect(screen.getByRole("button", { name: "Next card" })).toBeTruthy();
    expect(stub.props.centerInsufficientSlides).toBe(false);
});

test("opens on the second card when the first two cards fit side by side", async () => {
    show(6, { startOnSecond: true });
    const swiper = swiperAt({ size: 1122, slidesSizesGrid: [420, 420, 420, 420, 420, 420] });
    await measure(swiper);

    expect(swiper.slideTo).toHaveBeenCalledWith(1, 0);
});

test("opens on the first card when only one card fits, like on a phone", async () => {
    show(6, { startOnSecond: true });
    const swiper = swiperAt({ size: 343, slidesSizesGrid: [295, 295, 295, 295, 295, 295] });
    await measure(swiper);

    expect(swiper.slideTo).not.toHaveBeenCalled();
});

test("a carousel without startOnSecond opens on the first card", async () => {
    show(6);
    const swiper = swiperAt({ size: 1122, slidesSizesGrid: [420, 420, 420, 420, 420, 420] });
    await measure(swiper);

    expect(swiper.slideTo).not.toHaveBeenCalled();
});

test("moves to the start position once, so later updates don't pull the user back", async () => {
    show(6, { startOnSecond: true });
    const swiper = swiperAt({ size: 1122, slidesSizesGrid: [420, 420, 420, 420, 420, 420] });
    await measure(swiper);
    await act(async () => stub.onSlidesUpdated(swiper));

    expect(swiper.slideTo).toHaveBeenCalledTimes(1);
});

test("waits until there is a card after the first before moving", async () => {
    show(1, { startOnSecond: true });
    const swiper = swiperAt({ size: 1122, slidesSizesGrid: [420] });
    await measure(swiper);
    expect(swiper.slideTo).not.toHaveBeenCalled();

    swiper.slides = [420, 420, 420, 420, 420];
    swiper.slidesSizesGrid = [420, 420, 420, 420, 420];
    await act(async () => stub.onSlidesUpdated(swiper));
    expect(swiper.slideTo).toHaveBeenCalledWith(1, 0);
});