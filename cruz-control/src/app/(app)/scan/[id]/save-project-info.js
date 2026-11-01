"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LuInfo, LuX } from "react-icons/lu";

// Like the glossary popup, use a body portal and viewport coordinates so
// scrolling tabs, animated headers and card overflow cannot clip the help.
export default function SaveProjectInfo() {
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState({ left: 16, top: 16 });
    const trigger = useRef(null);
    const popup = useRef(null);
    const closeButton = useRef(null);
    const id = useId();

    useLayoutEffect(() => {
        if (!open) return;
        const button = trigger.current.getBoundingClientRect();
        const box = popup.current.getBoundingClientRect();
        const below = button.bottom + 8;
        setPosition({
            left: Math.max(16, Math.min(button.right - box.width, window.innerWidth - box.width - 16)),
            top: Math.max(16, Math.min(below + box.height <= window.innerHeight - 16 ? below : button.top - box.height - 8, window.innerHeight - box.height - 16)),
        });
        closeButton.current.focus();
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const outside = event => {
            if (!trigger.current.contains(event.target) && !popup.current.contains(event.target)) setOpen(false);
        };
        const keyboard = event => {
            if (event.key === "Escape") {
                event.preventDefault();
                setOpen(false);
                trigger.current.focus();
            } else if (event.key === "Tab" && popup.current.contains(document.activeElement)) {
                // Resume normal header tab order instead of leaving focus at
                // the portal's position at the end of the document.
                setOpen(false);
                trigger.current.focus();
            }
        };
        const close = () => setOpen(false);
        const scroll = event => {
            if (!(event.target instanceof Node) || !popup.current.contains(event.target)) close();
        };
        document.addEventListener("pointerdown", outside);
        document.addEventListener("focusin", outside);
        document.addEventListener("keydown", keyboard);
        window.addEventListener("resize", close);
        window.addEventListener("scroll", scroll, true);
        return () => {
            document.removeEventListener("pointerdown", outside);
            document.removeEventListener("focusin", outside);
            document.removeEventListener("keydown", keyboard);
            window.removeEventListener("resize", close);
            window.removeEventListener("scroll", scroll, true);
        };
    }, [open]);

    return <>
        <button ref={trigger} type="button" aria-label="About saving to a project" aria-expanded={open} aria-haspopup="dialog" aria-controls={open ? id : undefined} onClick={() => setOpen(value => !value)} className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md border border-line bg-surface-strong text-accent hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
            <LuInfo size={17} aria-hidden="true" />
        </button>
        {open && createPortal(
            <section ref={popup} id={id} role="dialog" aria-label="About saving to a project" aria-describedby={`${id}-text`} aria-modal="false" style={position} className="fixed z-70 max-h-[calc(100dvh-2rem)] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-xl border border-line bg-surface-strong p-4 text-sm text-ink shadow-lg [overflow-wrap:anywhere]">
                <div className="flex items-start gap-2">
                    <p id={`${id}-text`} className="min-w-0 flex-1">Creates a new project. To scan an existing project again, go to Projects &rarr; Re-scan.</p>
                    <button ref={closeButton} type="button" aria-label="Close save information" onClick={() => { setOpen(false); trigger.current.focus(); }} className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-accent"><LuX size={18} aria-hidden="true" /></button>
                </div>
            </section>, document.body
        )}
    </>;
}
