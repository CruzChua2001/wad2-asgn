"use client";

import { Children, useState } from "react";
import { useReducedMotion } from "motion/react";
import { LuChevronLeft, LuChevronRight } from "react-icons/lu";
import { Swiper } from "swiper/react";
import { EffectCoverflow, Keyboard, Mousewheel, FreeMode } from "swiper/modules";
import "swiper/css";
import "swiper/css/effect-coverflow";
import "swiper/css/navigation";

// Beside the cards on desktop, in the dots row on phones so they never cover a card
const arrowButton = "grid size-9 flex-none cursor-pointer place-items-center rounded-full border border-line bg-surface-strong text-ink shadow-sm transition-colors hover:border-accent hover:text-accent aria-disabled:cursor-default aria-disabled:opacity-60 aria-disabled:hover:border-line aria-disabled:hover:text-ink sm:absolute sm:top-[calc(50%-1rem)] sm:z-10 sm:-translate-y-1/2";

// Takes a Swiper and returns the width of its first few slides plus the gaps between them
const widthOfFirst = (swiper, howMany) => {
    const sizes = swiper.slidesSizesGrid.slice(0, howMany);
    return sizes.reduce((sum, size) => sum + size, 0) + swiper.params.spaceBetween * (sizes.length - 1);
}

// Takes a Swiper and returns true when every slide fits inside it at once, so there is nothing to scroll to
const allSlidesFit = swiper => widthOfFirst(swiper, swiper.slidesSizesGrid.length) <= swiper.size + 1;

// Cards in a draggable coverflow, label names it for screen readers. When the cards all fit they sit
// centered as a group, otherwise it gets arrows and dots to show it scrolls. startOnSecond is for a
// carousel whose first card is an "add" card: it opens on the card after it, unless only one card fits
const CardCarousel = ({ label, startOnSecond = false, children }) => {
    const reduceMotion = useReducedMotion();
    const [swiper, setSwiper] = useState(null);
    const [fits, setFits] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const [atStart, setAtStart] = useState(true);
    const [atEnd, setAtEnd] = useState(true);
    // Each Swiper is moved to its start position once
    const [positioned] = useState(() => new WeakSet());
    const count = Children.toArray(children).length;
    // No animation when the user asks for reduced motion
    const speed = reduceMotion ? 0 : undefined;

    // Opens on the second card when the first two fit side by side, so the first card is the one centered
    const moveToStart = current => {
        if (!startOnSecond || positioned.has(current) || current.slides.length < 2) return;
        positioned.add(current);
        if (widthOfFirst(current, 2) > current.size + 1 || allSlidesFit(current)) return;
        // Wait for the Swiper to finish starting up, which would move it back to the first card
        queueMicrotask(() => {
            if (!current.destroyed) current.slideTo(1, 0);
        });
    }

    // Copies what the Swiper knows into state. It is skipped until the Swiper has measured its slides
    const sync = current => {
        if (current.destroyed || !current.size || current.slidesSizesGrid.length === 0) return;
        moveToStart(current);
        setFits(allSlidesFit(current));
        setActiveIndex(current.activeIndex);
        setAtStart(current.isBeginning);
        setAtEnd(current.isEnd);
    }

    const previous = _ => {
        if (!atStart) swiper.slidePrev(speed);
    }

    const next = _ => {
        if (!atEnd) swiper.slideNext(speed);
    }

    return (
        <div role="region" aria-roledescription="carousel" aria-label={label} className="relative grid min-w-0 gap-2">
            {/* Swiper can't change these on the fly, so the key starts a new one when the cards start or stop fitting */}
            <Swiper
                key={fits ? "fits" : "scrolls"}
                modules={[EffectCoverflow, Keyboard, Mousewheel, FreeMode]}
                effect="coverflow"
                coverflowEffect={{ rotate: 15, depth: 80, slideShadows: false }}
                spaceBetween={24}
                slidesPerView="auto"
                centeredSlides
                centeredSlidesBounds={fits}
                centerInsufficientSlides={fits}
                allowTouchMove={!fits}
                grabCursor={!fits}
                keyboard={{ enabled: true }}
                mousewheel={{ forceToAxis: true }}
                freeMode={{ enabled: true, sticky: true }}
                wrapperTag="ul"
                touchEventsTarget="container"
                className="w-full py-4! [&_.swiper-wrapper]:pointer-events-none [&_.swiper-slide]:pointer-events-auto"
                onSwiper={setSwiper}
                onSlidesUpdated={sync}
                onSetTranslate={sync}
                onSlideChange={sync}
                onTransitionEnd={sync}
            >
                {children}
            </Swiper>

            {!fits && count > 1 && (
                <div className="flex items-center gap-2 sm:justify-center">
                    <button type="button" aria-label="Previous card" aria-disabled={atStart} onClick={previous} className={`sm:left-1 ${arrowButton}`}>
                        <LuChevronLeft size={18} aria-hidden="true" />
                    </button>

                    <div role="group" aria-label="Choose a card" className="flex flex-1 flex-wrap items-center justify-center">
                        {Array.from({ length: count }, (_, index) => (
                            <button
                                key={index}
                                type="button"
                                aria-label={`Card ${index + 1} of ${count}`}
                                aria-current={index === activeIndex ? "true" : undefined}
                                onClick={() => swiper.slideTo(index, speed)}
                                className="group grid size-6 cursor-pointer place-items-center"
                            >
                                <span className={`h-2 rounded-full border transition-[width,background-color,border-color] duration-200 motion-reduce:transition-none ${index === activeIndex
                                    ? "w-5 border-accent bg-accent"
                                    : "w-2 border-muted group-hover:border-accent"}`}
                                />
                            </button>
                        ))}
                    </div>

                    <button type="button" aria-label="Next card" aria-disabled={atEnd} onClick={next} className={`sm:right-1 ${arrowButton}`}>
                        <LuChevronRight size={18} aria-hidden="true" />
                    </button>
                </div>
            )}
        </div>
    );
}

export default CardCarousel;
