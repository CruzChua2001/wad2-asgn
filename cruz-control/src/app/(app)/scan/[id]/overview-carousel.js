"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { motion } from "motion/react";
import { LuChevronLeft, LuChevronRight } from "react-icons/lu";

const PHONE_QUERY = "(max-width: 767px)";
const TURN = { duration: 0.5, ease: [0.22, 1, 0.36, 1] };
const COLUMNS = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-2 md:grid-cols-4" };

// Phones get a flat slide, so watch the screen width
function subscribe(callback) {
  if (!window.matchMedia) return () => {};
  const query = window.matchMedia(PHONE_QUERY);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}

function isPhoneNow() {
  return Boolean(window.matchMedia?.(PHONE_QUERY).matches);
}

// step is 1 when the new card is after the old one, -1 when it's before
function enterPose(step, isPhone) {
  if (isPhone) return { x: [`${step * 40}%`, "0%"], rotateY: 0, opacity: [0, 1] };
  return { x: [`${step * 6}%`, "0%"], rotateY: [step * -35, 0], opacity: [0, 1] };
}

function exitPose(step, isPhone) {
  if (isPhone) return { x: `${step * -40}%`, rotateY: 0, opacity: 0 };
  return { x: `${step * -6}%`, rotateY: step * 35, opacity: 0 };
}

// slides: [{ key, label, Icon, summary, node }]. The page keeps which card is in front,
// and controls (the Carousel / Grid toggle) sits at the end of the tab row
export default function OverviewCarousel({ slides, active, onChange, reduceMotion, controls }) {
  const isPhone = useSyncExternalStore(subscribe, isPhoneNow, () => false);
  const regionRef = useRef(null);
  const draggedRef = useRef(false);
  const count = slides.length;
  const activeIndex = Math.max(0, slides.findIndex((slide) => slide.key === active));
  // The card turning away (from) stays shown until the new one has turned in (done)
  const [turn, setTurn] = useState({ index: activeIndex, from: -1, step: 1, done: true });

  // The page can change the card too (links, the tour), so follow it here
  if (turn.index !== activeIndex) {
    setTurn({ index: activeIndex, from: turn.index, step: activeIndex > turn.index ? 1 : -1, done: reduceMotion });
  }

  // After a long card the page may be scrolled past the tabs, so bring them back
  function showTop() {
    const region = regionRef.current;
    if (region && region.getBoundingClientRect().top < 0) {
      region.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    }
  }

  // Next and Previous keep turning the same way, even when they wrap around
  function go(step) {
    const next = (activeIndex + step + count) % count;
    setTurn({ index: next, from: activeIndex, step, done: reduceMotion });
    onChange(slides[next].key);
    showTop();
  }

  // A swipe on the tabs shouldn't also click the tab under the finger
  function pick(action) {
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }
    action();
  }

  function handleKeyDown(event) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    if (event.defaultPrevented || event.target.closest("input, textarea, select")) return;

    event.preventDefault();
    // The focused card is about to turn away, so keep focus in the carousel
    if (event.target.closest("[data-slide]")) regionRef.current.focus({ preventScroll: true });
    go(event.key === "ArrowLeft" ? -1 : 1);
  }

  function handleDragEnd(event, info) {
    if (info.offset.x < -40) go(1);
    else if (info.offset.x > 40) go(-1);
  }

  const roundButton = "grid h-8 w-8 flex-none cursor-pointer place-items-center rounded-full border border-line bg-surface-strong text-muted transition-colors hover:border-accent hover:text-accent max-md:h-7 max-md:w-7";

  return (
    <div
      ref={regionRef}
      id="overview-carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label="Overview cards"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="flex scroll-mt-4 flex-col gap-4 outline-none"
    >
      {/* The toggle sits above the tabs until lg, so the tab notes have room */}
      <div className="flex flex-col-reverse gap-2 lg:flex-row lg:items-center lg:gap-3">
        {/* On phones the tabs can be swiped, never the map itself */}
        <motion.div
          drag={isPhone ? "x" : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.25}
          onPointerDownCapture={() => { draggedRef.current = false; }}
          onDragStart={() => { draggedRef.current = true; }}
          onDragEnd={handleDragEnd}
          className="flex min-w-0 flex-1 items-center gap-2"
        >
          <button type="button" aria-label="Previous card" onClick={() => pick(() => go(-1))} className={roundButton}>
            <LuChevronLeft aria-hidden="true" />
          </button>

          <div role="group" aria-label="Choose a card" className={`grid min-w-0 flex-1 gap-2 ${COLUMNS[count] ?? "grid-cols-3"}`}>
            {slides.map((slide, index) => {
              const current = index === activeIndex;
              const Icon = slide.Icon;

              return (
                <button
                  key={slide.key}
                  type="button"
                  aria-current={current ? "true" : undefined}
                  onClick={() => pick(() => {
                    onChange(slide.key);
                    showTop();
                  })}
                  className={`relative flex min-w-0 cursor-pointer flex-col gap-1 overflow-hidden rounded-xl border px-4 py-3 text-left transition-[border-color,background-color,translate] max-md:px-2.5 max-md:py-2 ${current
                    ? "border-accent bg-accent-soft/40"
                    : "border-line bg-surface-strong hover:border-accent/40 motion-safe:hover:-translate-y-0.5"}`}
                >
                  <span className={`flex min-w-0 items-center gap-2 text-xs font-semibold max-md:gap-1.5 max-md:text-[11px] ${current ? "text-ink" : "text-muted"}`}>
                    {Icon && <Icon aria-hidden="true" className="flex-none text-accent" />}
                    <span className="truncate">{slide.label}</span>
                  </span>
                  {slide.summary && (
                    <span className="flex min-h-7 min-w-0 items-center gap-2 text-sm text-ink max-md:min-h-0 max-md:text-xs">
                      {slide.summary}
                    </span>
                  )}
                  {current && (
                    <motion.span
                      layoutId="overview-tab-bar"
                      aria-hidden="true"
                      transition={reduceMotion ? { duration: 0 } : { duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                      className="absolute inset-x-3 bottom-0 h-[3px] rounded-t-full bg-accent"
                    />
                  )}
                </button>
              );
            })}
          </div>

          <button type="button" aria-label="Next card" onClick={() => pick(() => go(1))} className={roundButton}>
            <LuChevronRight aria-hidden="true" />
          </button>
        </motion.div>

        {controls && <div className="flex flex-none justify-end">{controls}</div>}
      </div>

      {/* Every card stays mounted so the globe never reloads. Only the front one is in the flow.
          The clip margin leaves room for the card's shadow */}
      <div className="relative overflow-clip perspective-[1800px] perspective-origin-top [overflow-clip-margin:48px]">
        {slides.map((slide, index) => {
          const front = index === activeIndex;
          const leaving = index === turn.from && !turn.done;

          let animate = { opacity: 0 };
          let origin = "center";
          if (front) {
            animate = reduceMotion ? { x: "0%", rotateY: 0, opacity: 1 } : enterPose(turn.step, isPhone);
            origin = turn.step > 0 ? "right top" : "left top";
          } else if (index === turn.from) {
            animate = reduceMotion ? { opacity: 0 } : exitPose(turn.step, isPhone);
            origin = turn.step > 0 ? "left top" : "right top";
          }

          return (
            <motion.div
              key={slide.key}
              data-slide
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${count}: ${slide.label}`}
              inert={!front}
              initial={false}
              animate={animate}
              transition={reduceMotion ? { duration: 0 } : TURN}
              onAnimationComplete={front ? () => setTurn((last) => (last.done ? last : { ...last, done: true })) : undefined}
              style={{ transformOrigin: origin, zIndex: front ? 2 : 1 }}
              className={front
                ? "relative rounded-xl bg-surface-strong shadow-lg shadow-ink/5"
                : `pointer-events-none absolute inset-x-0 top-0 rounded-xl bg-surface-strong ${leaving ? "" : "invisible"}`}
            >
              {slide.node}
            </motion.div>
          );
        })}
      </div>

      <p className="sr-only" aria-live="polite">
        Showing {slides[activeIndex].label}, card {activeIndex + 1} of {count}
      </p>
    </div>
  );
}
