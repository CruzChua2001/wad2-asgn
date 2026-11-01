"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { TOUR_PARTS } from "./tour-steps";

const STORAGE_KEY = "cruz-control-tour-seen-v1";
const CARD_WIDTH = 352;
const CARD_HEIGHT = 260;
const GAP = 16;
const PAD = 6;
const RESULTS_READY = 'section[aria-labelledby="score-title"]';
const CARD_TURN = 500; // how long an Overview card takes to turn to the front

const readSeen = (part, who) => {
    try {
        return localStorage.getItem(`${STORAGE_KEY}:${part}:${who}`) === "1";
    } catch {
        return true;
    }
};

const markSeen = (part, who) => {
    try {
        localStorage.setItem(`${STORAGE_KEY}:${part}:${who}`, "1");
    } catch {
    }
};

const shouldSkip = step => {
    if (step.skipIfMissing && step.selector && !document.querySelector(step.selector)) return true;
    if (step.skipIfPresent && document.querySelector(step.skipIfPresent)) return true;
    return false;
};

const scrollToTarget = el => {
    const r = el.getBoundingClientRect();
    if (r.top >= 0 && r.bottom <= window.innerHeight) return; // already fully in view
    window.scrollTo({ top: window.scrollY + r.top - Math.max(16, (window.innerHeight - r.height) / 2) });
};

export default function ProductTour({ part, onStart, onClose }) {
    const { status, user } = useAuth();
    const pathname = usePathname();
    const who = status === "authenticated" ? user?.id : status === "guest" ? "guest" : null; // null while loading
    const open = part !== null && part !== undefined;
    const [step, setStep] = useState(0);
    const [filtered, setFiltered] = useState({ part: null, list: [] });
    const [view, setView] = useState(null);
    const cardRef = useRef(null);
    const nextRef = useRef(null);
    const startScrollRef = useRef(0);
    const onStartRef = useRef(onStart);

    useEffect(() => {
        onStartRef.current = onStart;
    });

    useEffect(() => {
        if (!who || open) return;

        if (pathname === "/scan" && !readSeen("intro", who)) {
            const timer = setTimeout(() => onStartRef.current("intro"), 900);
            return () => clearTimeout(timer);
        }

        if (pathname.startsWith("/scan/") && !readSeen("results", who)) {
            let tries = 0;
            const poll = setInterval(() => {
                tries += 1;
                if (document.querySelector(RESULTS_READY)) {
                    clearInterval(poll);
                    onStartRef.current("results");
                } else if (tries > 40) {
                    clearInterval(poll);
                }
            }, 300);
            return () => clearInterval(poll);
        }
    }, [who, pathname, open]);

    useEffect(() => {
        if (!open) return;
        const frame = requestAnimationFrame(() => {
            setFiltered({ part, list: TOUR_PARTS[part].filter(s => !shouldSkip(s)) });
        });
        return () => cancelAnimationFrame(frame);
    }, [open, part, pathname]);

    const base = open ? TOUR_PARTS[part] : [];
    const steps = filtered.part === part ? filtered.list : base;
    const current = steps[step] ?? steps[steps.length - 1] ?? {};
    const selector = current.selector;
    const card = current.card;
        useEffect(() => {
            if (open) startScrollRef.current = window.scrollY;
        }, [open]);

        useEffect(() => {
        // Steps on an Overview card bring it to the front of the carousel first, then measure once it has turned
        if (card) window.dispatchEvent(new CustomEvent("cruz:overview-card", { detail: card }));
        const measure = () => {
            const el = selector ? document.querySelector(selector) : null;
            const r = el?.getBoundingClientRect();
            const visible = r && r.width > 0 && r.height > 0;
            setView({
                part,
                step,
                vw: window.innerWidth,
                vh: window.innerHeight,
                rect: visible ? { top: r.top, left: r.left, width: r.width, height: r.height } : null,
            });
        };

        const timer = setTimeout(() => {
            const target = selector ? document.querySelector(selector) : null;
            if (target) scrollToTarget(target);
            measure();
        }, card ? CARD_TURN : 0);
        window.addEventListener("resize", measure);
        window.addEventListener("scroll", measure, true);
        return () => {
            clearTimeout(timer);
            window.removeEventListener("resize", measure);
            window.removeEventListener("scroll", measure, true);
        };
    }, [open, part, step, selector, card]);

    useEffect(() => {
        if (open) nextRef.current?.focus();
    }, [open, part, step]);

    if (!open) return null;

    const finish = () => {
        if (who) markSeen(part, who);
        window.scrollTo(0, startScrollRef.current);
        setStep(0);
        setView(null);
        onClose();
    };

    const isLast = step >= steps.length - 1;
    const goNext = () => (isLast ? finish() : setStep(step + 1));
    const goBack = () => setStep(Math.max(0, step - 1));

    const onKeyDown = e => {
        if (e.key === "Escape") {
            finish();
            return;
        }
        if (e.key !== "Tab") return;
        const items = cardRef.current?.querySelectorAll("button");
        if (!items?.length) return;
        const first = items[0];
        const lastItem = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            lastItem.focus();
        } else if (!e.shiftKey && document.activeElement === lastItem) {
            e.preventDefault();
            first.focus();
        }
    };

    const ready = view?.part === part && view?.step === step; 
    const rect = ready ? view.rect : null;

    const cardWidth = ready ? Math.min(CARD_WIDTH, view.vw - 32) : CARD_WIDTH;
    let cardClass = "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2";
    let cardStyle = { width: cardWidth };

    if (rect) {
        cardClass = "";
        const left = Math.min(Math.max(rect.left + rect.width / 2 - cardWidth / 2, 16), view.vw - cardWidth - 16);
        const below = rect.top + rect.height + PAD + GAP;
        if (below + CARD_HEIGHT <= view.vh) {
            cardStyle = { width: cardWidth, left, top: below };
        } else if (rect.top - PAD - GAP - CARD_HEIGHT >= 0) {
            cardStyle = { width: cardWidth, left, bottom: view.vh - rect.top + PAD + GAP };
        } else {
            cardStyle = { width: cardWidth, left, bottom: 16 };
        }
    }

    return (
        <>
            {/* Catches clicks so the page behind can't be used during the tour. preventDefault keeps focus in the card. */}
            <div className="fixed inset-0 z-60" onMouseDown={e => e.preventDefault()} aria-hidden="true" />

            {/* The dimmed background, with a hole around the highlighted element */}
            {rect ? (
                <div
                    className="pointer-events-none fixed z-61 rounded-xl shadow-[0_0_0_9999px_rgba(0,0,0,0.6)] ring-2 ring-accent transition-all duration-300 motion-reduce:transition-none"
                    style={{ top: rect.top - PAD, left: rect.left - PAD, width: rect.width + PAD * 2, height: rect.height + PAD * 2 }}
                    aria-hidden="true"
                />
            ) : (
                <div className="pointer-events-none fixed inset-0 z-61 bg-black/60" aria-hidden="true" />
            )}

            <section
                ref={cardRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby="tour-title"
                aria-describedby="tour-text"
                onKeyDown={onKeyDown}
                className={`fixed z-62 rounded-2xl border border-accent/40 bg-surface p-5 shadow-2xl ${cardClass}`}
                style={cardStyle}
            >
                <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-accent-soft">
                        {/* eslint-disable-next-line @next/next/no-img-element -- tiny static icon, next/image adds nothing here */}
                        <img src="/favicon.ico" alt="" className="h-6 w-6 object-contain" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                        <h2 id="tour-title" className="font-semibold uppercase tracking-wide text-accent">
                            {current.title}
                        </h2>
                        <p className="text-xs uppercase tracking-wide text-muted">
                            Step {step + 1} of {steps.length}
                        </p>
                    </div>
                </div>

                <p id="tour-text" className="mt-3 text-sm text-ink">
                    {current.text}
                </p>

                <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="flex gap-1.5" aria-hidden="true">
                        {steps.map((s, i) => (
                            <span key={s.id} className={`h-1.5 w-1.5 rounded-full ${i === step ? "bg-accent" : "bg-line"}`} />
                        ))}
                    </div>
                    <div className="flex items-center gap-2">
                        {!isLast && (
                            <button type="button" onClick={finish} className="px-2 py-1.5 cursor-pointer text-xs! text-muted hover:text-ink">
                                Skip
                            </button>
                        )}
                        {step > 0 && (
                            <button
                                type="button"
                                onClick={goBack}
                                className="rounded-full cursor-pointer border border-line px-3 py-1.5 text-xs! font-semibold! tracking-wide text-accent hover:bg-accent-soft"
                            >
                                BACK
                            </button>
                        )}
                        <button
                            ref={nextRef}
                            type="button"
                            onClick={goNext}
                            className="rounded-full cursor-pointer border border-accent bg-accent-soft px-3 py-1.5 text-xs! font-semibold! tracking-wide text-accent hover:bg-accent hover:text-page"
                        >
                            {isLast ? (part === "intro" ? "GOT IT" : "DONE") : "NEXT"}
                        </button>
                    </div>
                </div>
            </section>
        </>
    );
}