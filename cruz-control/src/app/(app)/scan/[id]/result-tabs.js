"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import styles from "@/styles/overview/scan-results.module.css";

const RESULT_TABS = [
  { href: "", label: "Overview", showsCount: true },
  { href: "/fix-guide", label: "Fix Guide" },
  { href: "/checklist", label: "Checklist" },
  { href: "/report-card", label: "Report Card" },
  { href: "/compare", label: "Compare" },
];

// Width of the fade on a side with more tabs
const FADE = 28;
// How far past the active tab to keep in view, so the next tab peeks out from under the fade
const PEEK = 40;

// Tabs for the scan result pages. When they don't all fit, the strip scrolls sideways: the sides with
// more tabs fade out, and the active tab is scrolled into view
export default function ResultTabs({ hasRepository, findingsCount }) {
  const pathname = usePathname();
  const { id } = useParams();
  const reduceMotion = useReducedMotion();
  const scrollerRef = useRef(null);
  const placedRef = useRef(false);
  const [moreBefore, setMoreBefore] = useState(false);
  const [moreAfter, setMoreAfter] = useState(false);
  const tabs = RESULT_TABS.filter((tab) => !tab.requiresRepository || hasRepository);

  // Tracks which sides have more tabs, so a fade only shows where there is something to scroll to
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return undefined;

    const update = () => {
      setMoreBefore(scroller.scrollLeft > 1);
      setMoreAfter(scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 1);
    };

    scroller.addEventListener("scroll", update, { passive: true });
    // Also runs once when it starts watching, and again when the strip or a tab changes width
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(scroller);
    for (const tab of scroller.children) observer?.observe(tab);
    return () => {
      scroller.removeEventListener("scroll", update);
      observer?.disconnect();
    };
  }, [tabs.length]);

  // Brings the active tab into view, with a bit of the next tab showing. It moves the strip only,
  // never the page, and leaves it alone when the tab is already comfortably in view
  useEffect(() => {
    const scroller = scrollerRef.current;
    const tab = scroller?.querySelector('[aria-current="page"]');
    if (!tab) return;

    const hiddenBefore = tab.offsetLeft - PEEK;
    const hiddenAfter = tab.offsetLeft + tab.offsetWidth + PEEK - scroller.clientWidth;
    let left = scroller.scrollLeft;
    if (hiddenBefore < left) left = hiddenBefore;
    else if (hiddenAfter > left) left = hiddenAfter;
    left = Math.max(0, Math.min(left, scroller.scrollWidth - scroller.clientWidth));
    if (left === scroller.scrollLeft) return;

    // The first placement is instant, so the page doesn't open with the strip sliding
    const behavior = placedRef.current && !reduceMotion ? "smooth" : "auto";
    placedRef.current = true;
    if (scroller.scrollTo) scroller.scrollTo({ left, behavior });
    else scroller.scrollLeft = left;
  }, [pathname, reduceMotion]);

  return (
    <nav className={styles.tabs} aria-label="Scan result sections">
      <div
        ref={scrollerRef}
        className={styles.tabScroller}
        data-fade={moreBefore || moreAfter ? "" : undefined}
        style={{ "--fade-start": `${moreBefore ? FADE : 0}px`, "--fade-end": `${moreAfter ? FADE : 0}px` }}
      >
        {tabs.map((tab) => {
          const href = `/scan/${id}${tab.href}`;
          const active = href === pathname;
          return (
            <Link key={href} href={href} className={`${active ? styles.tabActive : ""} focus-visible:-outline-offset-2!`} aria-current={active ? "page" : undefined}>
              {/* One pill that slides to the active tab */}
              {active && (
                <motion.span
                  layoutId="result-tab-pill"
                  className="absolute -inset-px rounded-md border border-accent/25 bg-surface-strong shadow-sm"
                  transition={reduceMotion ? { duration: 0 } : { type: "spring", bounce: 0.2, duration: 0.45 }}
                  aria-hidden="true"
                />
              )}
              <span className="relative">{tab.label}</span>
              {tab.showsCount && <span className={`${styles.tabCount} relative`}>{findingsCount}<span className="sr-only">{findingsCount === 1 ? " finding" : " findings"}</span></span>}
            </Link>
          )
        })}
      </div>
    </nav>
  );
}
