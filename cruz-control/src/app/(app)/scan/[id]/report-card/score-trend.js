"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { LuBookmarkPlus } from "react-icons/lu";
import api from "@/lib/api";
import { useScan } from "../../scan-context";

const MAX_SCANS = 10;
const WIDTH = 520;
const HEIGHT = 140;
// Room above the dots for their scores, and on the right for the "50" label
const PAD = { left: 16, right: 36, top: 30, bottom: 2 };
// Seconds the line takes to draw itself
const LINE_TIME = 0.9;

function dotTone(score) {
  if (score >= 80) return "text-accent";
  if (score >= 60) return "text-warm";
  return "text-critical";
}

function scanDate(createdAt) {
  return new Date(createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

// Score 0 to 100 turned into a y position, 100 at the top
function yFor(score) {
  return PAD.top + ((100 - score) / 100) * (HEIGHT - PAD.top - PAD.bottom);
}

// Chart positions as percentages, for the HTML labels placed on top of the chart
function leftOf(x) {
  return `${(x / WIDTH) * 100}%`;
}

function topOf(y) {
  return `${(y / HEIGHT) * 100}%`;
}

// Roughly when the line (drawn with an ease out) reaches dot i of count
function dotDelay(i, count) {
  return LINE_TIME * (1 - Math.sqrt(1 - i / (count - 1)));
}

// Near the left or right edge the tooltip grows inwards, so it doesn't get cut off
function tipAlign(x) {
  if (x < WIDTH / 3) return "-ml-3";
  if (x > (WIDTH * 2) / 3) return "-translate-x-full ml-3";
  return "-translate-x-1/2";
}

// Change between the scan being viewed and the one before it
function scoreChange(scans, scanId) {
  const index = Math.max(0, scans.findIndex((scan) => scan.id === scanId));
  const previous = scans[index + 1];
  if (!previous) return null;
  return scans[index].score - previous.score;
}

function ChangeNote({ change }) {
  if (change === null) return null;
  if (change === 0) return <span className="text-xs text-muted">Same as the last scan</span>;

  return (
    <span className={`text-xs font-semibold ${change > 0 ? "text-accent" : "text-critical"}`}>
      {change > 0 ? `Up ${change}` : `Down ${-change}`} since the last scan
    </span>
  );
}

// Every state sits in the same box, so the header looks the same with or without a chart
function Panel({ title, change = null, children }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="m-0 font-mono text-[10px] font-semibold tracking-wider text-muted uppercase">{title}</h3>
        <ChangeNote change={change} />
      </div>
      {children}
    </div>
  );
}

export default function ScoreTrend({ projectId, scanId }) {
  const { saveToProject, savedScanId, saving } = useScan();
  const [scans, setScans] = useState(null);
  const [error, setError] = useState("");
  // Index of the dot whose tooltip is showing
  const [active, setActive] = useState(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!projectId) return;

    async function loadScans() {
      try {
        const response = await api.get(`/api/project/${projectId}/scan`);
        setScans(response.data);
      } catch (e) {
        setError(e.response?.data?.error ?? "Could not load your score history.");
      }
    }

    loadScans();
  }, [projectId]);

  // Uses the same save as the results header, so both show "Saved" together
  if (!projectId) {
    return (
      <Panel title="Score history">
        <p className="m-0 text-sm text-muted">Save to a project to track your score over time.</p>
        {savedScanId === scanId ? (
          <p className="m-0 mt-3 text-sm text-ink">
            Saved. <Link href="/project" className="font-semibold text-accent! hover:underline">View it in Projects</Link>
          </p>
        ) : (
          <div className="mt-3 text-xs font-semibold">
            <button
              type="button"
              onClick={() => saveToProject(scanId)}
              disabled={saving}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-accent px-3 py-2 text-page hover:bg-accent-bright disabled:cursor-default disabled:opacity-60"
            >
              <LuBookmarkPlus aria-hidden="true" /> {saving ? "Saving..." : "Save to project"}
            </button>
          </div>
        )}
      </Panel>
    );
  }
  if (error) {
    return <Panel title="Score history"><p role="alert" className="m-0 text-sm text-critical">{error}</p></Panel>;
  }
  if (!scans) {
    return <Panel title="Score history"><p className="m-0 text-sm text-muted">Loading score history...</p></Panel>;
  }
  if (scans.length < 2) {
    return <Panel title="Score history"><p className="m-0 text-sm text-muted">This is the project&apos;s first scan. Re-scan later to see your score over time.</p></Panel>;
  }

  // The API sends newest first, the chart goes oldest to newest
  const shown = scans.slice(0, MAX_SCANS).reverse();
  const offset = scans.length - shown.length;
  const step = (WIDTH - PAD.left - PAD.right) / (shown.length - 1);
  const points = shown.map((scan, i) => ({ ...scan, x: PAD.left + i * step, y: yFor(scan.score) }));
  const last = points.at(-1);
  const line = points.map((p) => `${p.x},${p.y}`).join(" ");
  const summary = `Scores over the last ${shown.length} scans: ${shown.map((scan) => scan.score).join(", ")}`;
  const tip = active === null ? null : points[active];

  // With reduced motion everything starts in its final state
  const from = (values) => (reduceMotion ? false : values);

  return (
    <Panel title={`Score over last ${shown.length} scans`} change={scoreChange(scans, scanId)}>
      <div className="pt-3">
        <div className="relative">
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="block h-auto w-full overflow-visible" role="img" aria-label={summary}>
            {/* Neutral line and a faint area, so only the dots carry the good / warn / bad colours */}
            <motion.polygon
              points={`${points[0].x},${yFor(0)} ${line} ${last.x},${yFor(0)}`}
              fill="currentColor"
              className="text-accent"
              initial={from({ opacity: 0 })}
              animate={{ opacity: 0.08 }}
              transition={{ duration: 0.5, delay: LINE_TIME }}
            />
            <line x1={PAD.left} x2={WIDTH - PAD.right} y1={yFor(50)} y2={yFor(50)} stroke="currentColor" strokeDasharray="4 4" opacity="0.5" className="text-muted" />
            <motion.polyline
              points={line}
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
              opacity="0.6"
              className="text-muted"
              initial={from({ pathLength: 0 })}
              animate={{ pathLength: 1 }}
              transition={{ duration: LINE_TIME, ease: "easeOut" }}
            />

            {points.map((p, i) => (
              <motion.g
                key={p.id}
                className={dotTone(p.score)}
                initial={from({ scale: 0 })}
                animate={{ scale: 1 }}
                transition={{ duration: 0.3, delay: dotDelay(i, points.length), ease: "backOut" }}
                onMouseEnter={() => setActive(i)}
                onMouseLeave={() => setActive(null)}
              >
                {/* The current scan's ring pulses once after it pops in */}
                {p.id === scanId && (
                  <motion.circle
                    cx={p.x}
                    cy={p.y}
                    r="8"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    animate={reduceMotion ? undefined : { scale: [1, 1.6, 1], opacity: [1, 0.2, 1] }}
                    transition={{ duration: 0.7, delay: dotDelay(i, points.length) + 0.35, ease: "easeInOut" }}
                  />
                )}
                <circle cx={p.x} cy={p.y} r={p.id === scanId ? 5 : 4} fill="currentColor" strokeWidth="1.5" className="stroke-surface" />
                {/* Bigger invisible circle, so the dot is easier to hover */}
                <circle cx={p.x} cy={p.y} r="12" fill="transparent" />
              </motion.g>
            ))}
          </svg>

          {/* Plain text on top of the chart, so it stays the same size on any screen */}
          {points.map((p, i) => (
            <motion.span
              key={p.id}
              aria-hidden="true"
              className={`absolute -translate-x-1/2 -translate-y-full pb-2.5 font-mono text-[11px] leading-none ${p.id === scanId ? "font-bold" : ""} ${dotTone(p.score)}`}
              style={{ left: leftOf(p.x), top: topOf(p.y) }}
              initial={from({ opacity: 0 })}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3, delay: dotDelay(i, points.length) }}
            >
              {p.score}
            </motion.span>
          ))}
          <span aria-hidden="true" className="absolute -translate-y-1/2 pl-1.5 font-mono text-[10px] leading-none text-muted" style={{ left: leftOf(WIDTH - PAD.right), top: topOf(yFor(50)) }}>
            50
          </span>

          {/* Sits over the dot's score. Hidden from screen readers, since the links below describe each scan */}
          {tip && (
            <motion.span
              key={tip.id}
              aria-hidden="true"
              className={`pointer-events-none absolute z-10 -mt-2.5 -translate-y-full rounded-md border border-line bg-surface-strong px-2 py-1 text-xs whitespace-nowrap text-ink shadow-lg ${tipAlign(tip.x)}`}
              style={{ left: leftOf(tip.x), top: topOf(tip.y) }}
              initial={from({ opacity: 0 })}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.15 }}
            >
              {scanDate(tip.created_at)} · {tip.grade ? `Grade ${tip.grade}` : "No grade"} · {tip.score}
            </motion.span>
          )}
        </div>
      </div>

      <ol className="relative m-0 mt-2 h-5 list-none p-0">
        {points.map((p, i) => (
          <li key={p.id} className="absolute top-0 -translate-x-1/2" style={{ left: leftOf(p.x) }}>
            <Link
              href={`/scan/${p.id}/report-card`}
              aria-label={`Scan ${offset + i + 1} of ${scans.length}, ${scanDate(p.created_at)}, score ${p.score}, grade ${p.grade ?? "no grade"}`}
              aria-current={p.id === scanId ? "page" : undefined}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              className={`font-mono text-[10px] no-underline hover:text-accent! ${p.id === scanId ? "font-semibold text-accent!" : "text-muted!"}`}
            >
              #{offset + i + 1}
            </Link>
          </li>
        ))}
      </ol>

      <p className="m-0 mt-1 text-[11px] text-muted">{scanDate(shown[0].created_at)} to {scanDate(last.created_at)}</p>
    </Panel>
  );
}
