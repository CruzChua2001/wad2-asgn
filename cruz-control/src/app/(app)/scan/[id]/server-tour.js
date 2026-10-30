"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { motion } from "motion/react";
import { LuPause, LuPlay, LuSkipForward, LuX } from "react-icons/lu";

// How long the tour stays on each server
export const TOUR_STEP_MS = 4000;

const STATUS_RANK = { critical: 0, attention: 1, healthy: 2 };
const STATUS_LABELS = { healthy: "Healthy", attention: "Needs attention", critical: "Critical" };
const STATUS_TONES = { healthy: "text-accent", attention: "text-warm", critical: "text-critical" };
const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 };

const ICON_BUTTON = "grid size-7 cursor-pointer place-items-center rounded-md border border-line bg-surface text-muted hover:text-accent";

// Servers we can show on the globe, worst first, and the main site first among equals
export function tourOrder(nodes, mainHost = null) {
  return nodes
    .filter((node) => node.located)
    .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || Number(b.host === mainHost) - Number(a.host === mainHost));
}

function worstFinding(findings, node) {
  return findings
    .filter((finding) => finding.hosts?.includes(node.id))
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity])[0];
}

// tour is "off", "playing" or "paused". The page keeps it, so clicking a server or changing view can stop it.
// With reduced motion there's no timer, and the user steps through with Next
export default function ServerTour({ nodes, findings, mainHost = null, onSelect, reduceMotion = false, tour, onTourChange }) {
  const [step, setStep] = useState(0);
  const buttonRef = useRef(null);
  const captionRef = useRef(null);
  const wasTouring = useRef(false);
  const order = tourOrder(nodes, mainHost);
  const touring = tour !== "off";
  const node = order[Math.min(step, order.length - 1)];

  function start() {
    setStep(0);
    onSelect(order[0].id);
    onTourChange("playing");
  }

  // The tour ends after the last server and leaves it selected
  function goTo(next) {
    if (next >= order.length) {
      onTourChange("off");
      return;
    }
    setStep(next);
    onSelect(order[next].id);
  }

  const advance = useEffectEvent(() => goTo(step + 1));

  useEffect(() => {
    if (tour !== "playing" || reduceMotion) return undefined;
    const timer = setTimeout(() => advance(), TOUR_STEP_MS);
    return () => clearTimeout(timer);
  }, [tour, step, reduceMotion]);

  // Focus moves to the caption, and back to the button if it was lost when the caption closed
  useEffect(() => {
    if (touring) {
      captionRef.current?.focus({ preventScroll: true });
    } else if (wasTouring.current && document.activeElement === document.body) {
      buttonRef.current?.focus({ preventScroll: true });
    }
    wasTouring.current = touring;
  }, [touring]);

  if (order.length < 2) return null;

  if (!touring) {
    return (
      <button
        ref={buttonRef}
        type="button"
        onClick={start}
        className="absolute top-3 right-3 z-[2] inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-line bg-surface-strong px-3 py-1.5 text-xs! font-semibold! text-ink hover:text-accent"
      >
        <LuPlay aria-hidden="true" /> Tour my servers
      </button>
    );
  }

  const finding = worstFinding(findings, node);
  const playing = tour === "playing";

  return (
    <div
      ref={captionRef}
      tabIndex={-1}
      role="group"
      aria-label="Server tour"
      className="absolute bottom-3 left-3 z-[2] w-72 max-w-[calc(100%-4.5rem)] rounded-lg border border-line bg-surface-strong/90 p-3 text-xs shadow backdrop-blur outline-none"
    >
      <div aria-live="polite">
        <div className="flex items-center justify-between gap-2">
          <span className="font-mono text-[10px] tracking-[.08em] text-muted uppercase">{step + 1} of {order.length}</span>
          <span className={`rounded-full border border-current px-2 py-0.5 font-mono text-[9px] font-semibold uppercase ${STATUS_TONES[node.status]}`}>
            {STATUS_LABELS[node.status]}
          </span>
        </div>
        <p className="m-0 mt-1.5 truncate font-mono text-sm font-semibold text-ink">{node.host}</p>
        <p className="m-0 truncate text-muted">{node.city}, {node.country} · {node.org || node.provider || "Unknown provider"}</p>
        <p className={`m-0 mt-1.5 line-clamp-2 ${finding ? "text-ink" : "text-accent"}`}>
          {finding ? finding.title : "No issues found on this server"}
        </p>
      </div>

      {!reduceMotion && (
        <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-line" aria-hidden="true">
          {playing && (
            <motion.div
              key={step}
              data-testid="tour-progress"
              className={`h-full rounded-full bg-current ${STATUS_TONES[node.status]}`}
              initial={{ width: "0%" }}
              animate={{ width: "100%" }}
              transition={{ duration: TOUR_STEP_MS / 1000, ease: "linear" }}
            />
          )}
        </div>
      )}

      <div className="mt-2.5 flex items-center gap-1.5">
        {!reduceMotion && (
          <button type="button" onClick={() => onTourChange(playing ? "paused" : "playing")} aria-label={playing ? "Pause tour" : "Resume tour"} className={ICON_BUTTON}>
            {playing ? <LuPause aria-hidden="true" /> : <LuPlay aria-hidden="true" />}
          </button>
        )}
        <button type="button" onClick={() => goTo(step + 1)} aria-label="Next server" className={ICON_BUTTON}>
          <LuSkipForward aria-hidden="true" />
        </button>
        <button type="button" onClick={() => onTourChange("off")} aria-label="Stop tour" className={`${ICON_BUTTON} ml-auto`}>
          <LuX aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
