"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import api from "@/lib/api";

const MAX_SCANS = 10;
const WIDTH = 520;
const HEIGHT = 104;
// Room above the dots for their scores, and on the right for the "50" label
const PAD = { left: 16, right: 36, top: 30, bottom: 2 };

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
  const [scans, setScans] = useState(null);
  const [error, setError] = useState("");

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

  if (!projectId) {
    return <Panel title="Score history"><p className="m-0 text-sm text-muted">Save to a project to track your score over time.</p></Panel>;
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

  return (
    <Panel title={`Score over last ${shown.length} scans`} change={scoreChange(scans, scanId)}>
      <div className="pt-3">
        <div className="relative">
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="block h-auto w-full overflow-visible" role="img" aria-label={summary}>
            <polygon points={`${points[0].x},${yFor(0)} ${line} ${last.x},${yFor(0)}`} fill="currentColor" opacity="0.1" className={dotTone(last.score)} />
            <line x1={PAD.left} x2={WIDTH - PAD.right} y1={yFor(50)} y2={yFor(50)} stroke="currentColor" strokeDasharray="4 4" opacity="0.5" className="text-muted" />
            <polyline points={line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" className={dotTone(last.score)} />

            {points.map((p) => (
              <g key={p.id} className={dotTone(p.score)}>
                {p.id === scanId && <circle cx={p.x} cy={p.y} r="8" fill="none" stroke="currentColor" strokeWidth="2" />}
                <circle cx={p.x} cy={p.y} r={p.id === scanId ? 4.5 : 3.5} fill="currentColor" />
              </g>
            ))}
          </svg>

          {/* Plain text on top of the chart, so it stays the same size on any screen */}
          {points.map((p) => (
            <span
              key={p.id}
              aria-hidden="true"
              className={`absolute -translate-x-1/2 -translate-y-full pb-2.5 font-mono text-[11px] leading-none ${p.id === scanId ? "font-bold" : ""} ${dotTone(p.score)}`}
              style={{ left: leftOf(p.x), top: topOf(p.y) }}
            >
              {p.score}
            </span>
          ))}
          <span aria-hidden="true" className="absolute -translate-y-1/2 pl-1.5 font-mono text-[10px] leading-none text-muted" style={{ left: leftOf(WIDTH - PAD.right), top: topOf(yFor(50)) }}>
            50
          </span>
        </div>
      </div>

      <ol className="relative m-0 mt-2 h-5 list-none p-0">
        {points.map((p, i) => (
          <li key={p.id} className="absolute top-0 -translate-x-1/2" style={{ left: leftOf(p.x) }}>
            <Link
              href={`/scan/${p.id}/report-card`}
              aria-label={`Scan ${offset + i + 1} of ${scans.length}, ${scanDate(p.created_at)}, score ${p.score}, grade ${p.grade ?? "no grade"}`}
              aria-current={p.id === scanId ? "page" : undefined}
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
