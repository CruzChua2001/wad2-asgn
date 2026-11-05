"use client";

import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { LuMenu, LuX } from "react-icons/lu";

// Shared look for the links and buttons each header puts in the menu.
// text-ink! because the global "a { color: inherit }" rule beats Tailwind colours
export const menuItemClass = "flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-md px-3 text-left text-ink! no-underline hover:bg-surface-soft hover:text-accent! focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent aria-[current=page]:bg-accent-soft/20 aria-[current=page]:text-accent!";

// Hamburger button for phones (below md). Each header passes its own items as children
export default function MobileMenu({ children, className = "" }) {
  // The page it was opened on, so moving to another page closes it
  const [openOn, setOpenOn] = useState(null);
  const pathname = usePathname();
  const open = openOn === pathname;
  const rootRef = useRef(null);
  const buttonRef = useRef(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = event => {
      if (!rootRef.current?.contains(event.target)) setOpenOn(null);
    };

    const handleKeyDown = event => {
      if (event.key === "Escape") {
        setOpenOn(null);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  // Picking any item closes the menu
  const closeOnItem = event => {
    if (event.target.closest("a, button")) setOpenOn(null);
  };

  return (
    <div ref={rootRef} className={`md:hidden ${className}`.trim()}>
      <button
        ref={buttonRef}
        type="button"
        className="inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-md border border-line bg-surface/60 text-ink hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpenOn(open ? null : pathname)}
      >
        {open ? <LuX className="h-5 w-5" aria-hidden="true" /> : <LuMenu className="h-5 w-5" aria-hidden="true" />}
      </button>

      {open && (
        <div
          id={panelId}
          className="absolute inset-x-0 top-[calc(100%+0.5rem)] z-30 grid gap-1 rounded-xl border border-line bg-surface p-2 text-sm font-semibold text-ink shadow-lg"
          onClick={closeOnItem}
        >
          {children}
        </div>
      )}
    </div>
  );
}
