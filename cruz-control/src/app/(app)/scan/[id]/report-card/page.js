"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { useScan } from "../../scan-context";
import { getRating } from "../../scan-result";
import FixText from "../fix-text";
import GradeBadge, { gradeFor } from "@/components/grade-badge";
import NumberTicker from "../number-ticker";
import ScoreTrend from "./score-trend";
import styles from "@/styles/overview/scan-results.module.css";

const REPO_CATEGORIES = ["secrets", "packages", "repo-basics", "ignore-rules", "readme", "workflows"];
const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
const RISK_LABELS = { critical: "Critical", high: "High", medium: "Medium", low: "Low" };
// Same colours as the Overview's findings
const RISK_TONES = { critical: "text-critical", high: "text-critical", medium: "text-warm", low: "text-accent" };
const TONE_TEXT = { good: "text-accent", warn: "text-warm", bad: "text-critical" };
const TONE_BAR = { good: "bg-accent", warn: "bg-warm", bad: "bg-critical" };

// Category, score, points lost and why side by side from md up; stacked on phones
const ROW_GRID = "grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 md:grid-cols-[15rem_7.5rem_6rem_minmax(0,1fr)]";

const SCORE_RULE = "Your score is out of 100, and higher is safer. Each check scores 0 to 10, and riskier checks count for more. A critical problem keeps your score at 50 or below until it's fixed.";

// The rows are written in one after another, and each grade pops in just after its row
const ROW_LIST = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const ROW_ITEM = {
  hidden: { opacity: 0, x: -8 },
  show: { opacity: 1, x: 0, transition: { duration: 0.3, ease: "easeOut", delayChildren: 0.08 } },
};
const GRADE_POP = {
  hidden: { opacity: 0, scale: 0.6 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.3, ease: "backOut" } },
};

function scoreTone(value) {
  if (value >= 80) return "good";
  if (value >= 60) return "warn";
  return "bad";
}

// Weighted average of the checks that ran, out of 10 (the same formula as the overall score)
function averageScore(checks) {
  const ran = checks.filter((check) => check.status === "ok");
  const weight = ran.reduce((sum, check) => sum + check.weight, 0);
  if (weight === 0) return null;
  return ran.reduce((sum, check) => sum + check.weight * check.score, 0) / weight;
}

// A website or repository score out of 100
function sideScore(checks) {
  const score = averageScore(checks);
  return score === null ? null : Math.round(10 * score);
}

// One row per category: its score out of 10, the points it lost, and the findings behind it
function categoryRows(breakdown, checks, findings) {
  const rows = breakdown.map((item) => {
    const score = averageScore(checks.filter((check) => check.category === item.category));
    const related = findings.filter((finding) => finding.checkId && finding.category === item.category);

    return { ...item, score: score === null ? null : Math.floor(score), related };
  });

  // Worst first, and categories that didn't run last
  return rows.sort((a, b) => (b.status === "ok" ? b.lost : -1) - (a.status === "ok" ? a.lost : -1));
}

function rowReason(row) {
  if (row.status === "unavailable") return "Couldn't check this time. A new scan can try again.";
  if (row.status === "not_checked") return "Doesn't apply here, or this scan is older than the check.";
  if (row.related.length === 0) return "No problems found";

  const titles = row.related.slice(0, 2).map((finding) => finding.title).join(" · ");
  return row.related.length > 2 ? `${titles} +${row.related.length - 2} more` : titles;
}

// A letter grade per category, or an empty box when it didn't run so the labels stay lined up
function RowGrade({ row }) {
  if (row.status !== "ok") {
    return <span className="size-7 flex-none rounded-md border border-dashed border-line" aria-hidden="true" />;
  }
  return (
    <motion.span className="flex flex-none" variants={GRADE_POP}>
      <GradeBadge grade={gradeFor(row.score * 10)} size="sm" />
    </motion.span>
  );
}

function RowScore({ row }) {
  if (row.status !== "ok") {
    return <span className="font-mono text-xs text-muted">{row.status === "unavailable" ? "Couldn't check" : "Not checked"}</span>;
  }

  const tone = scoreTone(row.score * 10);
  // A red track for 0/10, so it reads as failed instead of empty
  const track = row.score === 0 ? "bg-critical/20" : "bg-line";
  return (
    <span className="flex items-center gap-2">
      <span className={`h-1.5 w-12 overflow-hidden rounded-full ${track}`} aria-hidden="true">
        <span className={`block h-full rounded-full ${TONE_BAR[tone]}`} style={{ width: `${row.score * 10}%` }} />
      </span>
      <span className={`font-mono text-sm font-semibold ${TONE_TEXT[tone]}`}>{row.score}/10</span>
    </span>
  );
}

// Same wording as the Overview's breakdown, so the rows add up to 100 minus the score
function RowLost({ row, delay }) {
  // Keeps the grid cell, so the why text stays in its column
  if (row.status !== "ok") return <span />;

  if (row.lost > 0) {
    const tone = scoreTone(row.score * 10) === "bad" ? "text-critical" : "text-warm";
    return (
      <span className={`font-mono text-sm font-semibold ${tone}`}>
        <span aria-hidden="true">-<NumberTicker value={row.lost} delay={delay} /> pts</span>
        <span className="sr-only">{row.lost} points lost</span>
      </span>
    );
  }
  // Lost less than a point, which rounds to 0
  if (row.score < 10) return <span className="font-mono text-sm font-semibold text-warm">Minor</span>;
  return <span className="font-mono text-sm text-muted">0 pts</span>;
}

// Same rule as the Overview's "+N pts" chip
function showGain(finding, incomplete) {
  return !incomplete && Boolean(finding.checkId) && Boolean(finding.gain);
}

function gainLabel(finding) {
  return `Fixing this adds ${finding.sharedCheck ? "up to " : ""}${finding.gain} points to your score`;
}

// The scan layout only renders this tab once a finished scan exists.
export default function ReportCardTab() {
  const { id } = useParams();
  const { result } = useScan();
  const reduceMotion = useReducedMotion();

  const checks = result.checks ?? [];
  const rows = categoryRows(result.breakdown ?? [], checks, result.findings);
  const isRepo = (item) => REPO_CATEGORIES.includes(item.category);
  const sides = [
    { label: "Website", rows: rows.filter((row) => !isRepo(row)), score: sideScore(checks.filter((check) => !isRepo(check))) },
    { label: "Repository", rows: rows.filter(isRepo), score: sideScore(checks.filter(isRepo)) },
  ].filter((side) => side.rows.length > 0);

  // Only worth showing when the scan has both a website and a repository
  const showSideScores = sides.length > 1;

  const lostTotal = rows.reduce((sum, row) => sum + row.lost, 0);
  const anyRan = rows.some((row) => row.status === "ok");

  // Viewers of a project scan can't re-scan, so the notes tell them who can
  const canRescan = !result.projectId || result.role === "owner";

  let summary = result.incomplete ? (canRescan ? "Incomplete, re-scan" : "Incomplete") : getRating(result.score);
  if (showSideScores) {
    for (const side of sides) {
      if (side.score !== null) summary += ` · ${side.label} ${side.score}`;
    }
  }

  // Real issues before good-practice tips, worst first
  const bySeverity = (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
  const issues = result.findings.filter((finding) => finding.kind === "issue").sort(bySeverity);
  const recommendations = result.findings.filter((finding) => finding.kind !== "issue").sort(bySeverity);
  const topFixes = [...issues, ...recommendations].slice(0, 3);

  const reveal = (delay = 0) => (reduceMotion
    ? {}
    : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] } });

  // Starts when the list scrolls into view. Without it the rows just show as they are.
  const listMotion = reduceMotion
    ? {}
    : { variants: ROW_LIST, initial: "hidden", whileInView: "show", viewport: { once: true, amount: 0.2 } };

  return (
    <div className="flex flex-col gap-4">
      <motion.section className={styles.card} aria-labelledby="grade-title" {...reveal(0.08)}>
        <h2 id="grade-title" className="sr-only">Report card</h2>
        <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,34rem)]">
          <div>
            <div className="flex items-center gap-5">
              {/* Lands like a stamp once the card is in */}
              <motion.span
                className="flex flex-none"
                initial={reduceMotion ? false : { scale: 1.4, opacity: 0, rotate: -10 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                transition={{ duration: 0.45, delay: 0.3, ease: "backOut" }}
              >
                <GradeBadge grade={result.grade} size="lg" />
              </motion.span>
              <div>
                <p className="m-0 font-mono text-3xl font-semibold text-ink">
                  {result.score} <span className="text-base font-normal text-muted">/ 100</span>
                </p>
                <p className="m-0 mt-1 text-sm text-muted">{summary}</p>
              </div>
            </div>

            {result.cap?.applied && result.uncappedScore > result.score && (
              <p className="m-0 mt-4 text-xs text-critical">
                Capped at 50 until the critical {result.cap.checkIds.length > 1 ? "problems are" : "problem is"} fixed. Without the cap, you&apos;d score {result.uncappedScore}.
              </p>
            )}
            {result.incomplete && (
              <p className="m-0 mt-4 text-xs text-warm">
                A critical check couldn&apos;t run, so there&apos;s no grade yet. {canRescan ? "Re-scan to try again." : "A project owner can re-scan to try again."}
              </p>
            )}
          </div>

          <div className="w-full max-w-[34rem] lg:justify-self-end">
            <ScoreTrend projectId={result.projectId} scanId={id} />
          </div>
        </div>

        <div className={`${ROW_GRID} mt-8 border-b border-line pb-2 font-mono text-[10px] font-semibold tracking-wider text-muted uppercase max-md:hidden!`} aria-hidden="true">
          <span>Check</span>
          <span>Score</span>
          <span>Points lost</span>
          <span>Why</span>
        </div>

        {sides.map((side) => (
          <div key={side.label} className="mt-4">
            <h3 className="m-0 font-mono text-[10px] font-semibold tracking-wider text-muted uppercase">
              {side.label}
            </h3>
            <motion.ul className="m-0 list-none p-0" {...listMotion}>
              {side.rows.map((row, index) => (
                <motion.li key={row.category} variants={ROW_ITEM} className={`${ROW_GRID} items-center gap-y-1.5 border-b border-line py-3 last:border-b-0`}>
                  <span className="flex min-w-0 items-center gap-2.5">
                    <RowGrade row={row} />
                    <span className="text-sm font-medium text-ink">{row.label}</span>
                  </span>
                  <RowScore row={row} />
                  {/* On phones these line up under the label, not the grade */}
                  <span className="max-md:pl-9.5"><RowLost row={row} delay={0.15 + index * 0.06} /></span>
                  <span className="col-span-2 text-sm text-muted max-md:pl-9.5 md:col-span-1">{rowReason(row)}</span>
                </motion.li>
              ))}
            </motion.ul>
          </div>
        ))}

        {anyRan && (
          <p className="m-0 mt-1 border-t border-line pt-3 font-mono text-sm text-ink">
            100 - {lostTotal} points lost = {result.uncappedScore}
            {result.cap?.applied && result.uncappedScore > result.score && (
              <span className="text-critical">, capped at {result.score}</span>
            )}
          </p>
        )}

        <p className="m-0 mt-4 text-[11px] leading-relaxed text-muted">{SCORE_RULE}</p>
      </motion.section>

      <motion.section className={styles.card} aria-labelledby="fix-first-title" {...reveal(0.14)}>
        <div className={styles.cardHead}>
          <h2 id="fix-first-title">Fix these first</h2>
          <Link href={`/scan/${id}`} className="text-xs font-semibold text-accent!">See all findings</Link>
        </div>
        {topFixes.length === 0 ? (
          <p className="m-0 text-sm text-muted">Nothing to fix right now. Re-scan now and then to keep it that way.</p>
        ) : (
          <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
            {topFixes.map((finding, index) => (
              <li key={finding.id} className="flex gap-3 rounded-lg border border-line bg-surface p-3">
                <span className="font-mono text-sm font-semibold text-muted" aria-hidden="true">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="m-0 text-sm font-semibold text-ink">
                    <Link href={`/scan/${id}?finding=${encodeURIComponent(finding.id)}`} className="no-underline hover:text-accent! hover:underline">
                      {finding.title}
                    </Link>
                  </p>
                  <p className="m-0 mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] font-semibold tracking-wider uppercase">
                    <span className={RISK_TONES[finding.severity]}>{RISK_LABELS[finding.severity]}</span>
                    {showGain(finding, result.incomplete) && (
                      <span className="text-accent" title={gainLabel(finding)} aria-label={gainLabel(finding)}>
                        <span aria-hidden="true">↑ </span>
                        {finding.sharedCheck ? "up to " : ""}+{finding.gain} pts
                      </span>
                    )}
                  </p>
                  <div className="text-sm break-words text-muted">
                    <FixText text={finding.fix} />
                  </div>
                </div>
              </li>
            ))}
          </ol>
        )}
      </motion.section>
    </div>
  );
}
