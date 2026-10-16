"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// The jargon our findings use, each with one plain sentence. Ask Cruz can reuse these later.
export const GLOSSARY = {
  CVE: "A public ID for a known security bug, like a case number.",
  CVSS: "A 0-10 rating of how bad a bug is. 10 is the worst.",
  EPSS: "The chance this bug gets attacked in the next 30 days.",
  KEV: "A US government list of bugs attackers are using right now.",
  CDN: "A network of servers that delivers your site from close to each visitor.",
  port: "A numbered door on a server that a service listens on.",
  SPF: "A DNS record listing which servers may send email for your domain.",
  DMARC: "A DNS record telling inboxes what to do with email that fakes your domain.",
  CAA: "A DNS record saying which companies may issue certificates for your domain.",
  HSTS: "A setting telling browsers to always use HTTPS for your site.",
  TLS: "The encryption behind HTTPS and the padlock in the address bar.",
  Dependabot: "A free GitHub bot that opens pull requests to update your packages.",
  lockfile: "A file (like package-lock.json) that pins the exact version of every package.",
  ".gitignore": "A file telling Git which files never to upload.",
  "SECURITY.md": "A file telling people how to report a security problem to you privately.",
};

// Acronyms only count in capitals, so "Port" still matches but "cve" in a word doesn't
function isAcronym(term) {
  return /^[A-Z]{2,}$/.test(term);
}

function escapeTerm(term) {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Whole words only. \b doesn't work next to a dot, so ".gitignore" needs a lookaround instead.
function termPattern(term) {
  const left = /^\w/.test(term) ? "\\b" : "(?<!\\w)";
  const right = /\w$/.test(term) ? "\\b" : "(?!\\w)";
  return `(${left}${escapeTerm(term)}${right})`;
}

// Longest first, so "CVSS" wins over "CVE" and "SECURITY.md" isn't cut short
const TERMS = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length);
const TERM_PATTERN = new RegExp(TERMS.map(termPattern).join("|"), "gi");

// Which glossary term a match belongs to: one capture group per term, in TERMS order
function matchedTerm(match) {
  for (let i = 0; i < TERMS.length; i++) {
    if (match[i + 1] !== undefined) {
      return TERMS[i];
    }
  }
  return null;
}

// The popup floats 6px under the term and stays 16px inside the viewport
const GAP = 6;
const EDGE = 16;

/**
 * One highlighted term. Hovering or focusing it shows the meaning in a popup,
 * and a tap toggles it. The popup is fixed and portalled into the body, so the
 * card's hidden overflow can't clip it and the sentence never moves.
 */
export function Term({ term, children }) {
  const [open, setOpen] = useState(false);
  const [spot, setSpot] = useState({ left: 0, top: 0 });
  const termRef = useRef(null);
  const popupRef = useRef(null);
  const tapped = useRef(false);
  const popupId = useId();

  // Place the popup before the browser paints, so it never flashes in the corner
  useLayoutEffect(() => {
    if (!open) {
      return;
    }

    const term = termRef.current.getBoundingClientRect();
    const popup = popupRef.current.getBoundingClientRect();
    const room = window.innerWidth - EDGE - popup.width;
    const below = term.bottom + GAP;
    const fitsBelow = below + popup.height <= window.innerHeight - EDGE;

    setSpot({
      left: Math.max(EDGE, Math.min(term.left, room)),
      top: fitsBelow ? below : term.top - GAP - popup.height,
    });
  }, [open]);

  // Scrolling or resizing would leave the popup behind, so close it instead
  useEffect(() => {
    if (!open) {
      return;
    }

    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);

    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  // Touch screens have no hover, so remember how the term was pressed
  function onPointerDown(event) {
    tapped.current = event.pointerType === "touch";
  }

  // The term sits in the finding's row, so don't let a tap reach anything else
  function onClick(event) {
    event.stopPropagation();

    if (tapped.current) {
      setOpen(!open);
    }
  }

  function onFocus() {
    if (!tapped.current) {
      setOpen(true);
    }
  }

  function onBlur() {
    tapped.current = false;
    setOpen(false);
  }

  function onKeyDown(event) {
    if (event.key === "Escape") {
      setOpen(false);
    }
  }

  // .findings button styles every button in the card, and globals.css has button { font: inherit }
  return (
    <>
      <button
        ref={termRef}
        type="button"
        aria-describedby={open ? popupId : undefined}
        onPointerDown={onPointerDown}
        onClick={onClick}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={onFocus}
        onBlur={onBlur}
        onKeyDown={onKeyDown}
        className="inline! w-auto! cursor-pointer rounded border-0! bg-accent-soft/40! px-0.5! py-0! text-xs! font-medium text-ink underline decoration-accent decoration-dotted underline-offset-2 hover:bg-accent-soft!"
      >
        {children ?? term}
      </button>

      {open && createPortal(
        <span
          ref={popupRef}
          id={popupId}
          role="tooltip"
          style={{ left: spot.left, top: spot.top }}
          className="pointer-events-none fixed z-50 block max-w-60 rounded-md border border-line bg-surface-strong px-2.5 py-1.5 text-xs! text-ink shadow-lg"
        >
          <strong>{term}:</strong> {GLOSSARY[term]}
        </span>,
        document.body
      )}
    </>
  );
}

/**
 * Wrap the first appearance of each glossary term in text with a Term.
 */
export function withTerms(text) {
  if (typeof text !== "string") {
    return text;
  }

  const parts = [];
  const used = new Set();
  let from = 0;

  TERM_PATTERN.lastIndex = 0;
  let match = TERM_PATTERN.exec(text);

  while (match) {
    const term = matchedTerm(match);
    const sameCase = !isAcronym(term) || match[0] === term;

    if (term && sameCase && !used.has(term)) {
      used.add(term);
      parts.push(text.slice(from, match.index));
      parts.push(<Term key={`${term}-${match.index}`} term={term}>{match[0]}</Term>);
      from = match.index + match[0].length;
    }

    match = TERM_PATTERN.exec(text);
  }

  if (parts.length === 0) {
    return text;
  }

  parts.push(text.slice(from));
  return parts;
}
