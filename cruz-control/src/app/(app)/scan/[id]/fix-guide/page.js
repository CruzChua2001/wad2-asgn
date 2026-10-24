"use client";

import { useState } from "react";
import { LuChevronDown, LuCheck, LuExternalLink, LuPartyPopper } from "react-icons/lu";
import { useScan } from "../../scan-context";

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

const SEVERITY_STYLE = {
    critical: { label: "Critical", chip: "bg-red-500/10 text-red-600 dark:text-red-400", bar: "bg-red-500" },
    high: { label: "High", chip: "bg-orange-500/10 text-orange-600 dark:text-orange-400", bar: "bg-orange-500" },
    medium: { label: "Medium", chip: "bg-amber-500/10 text-amber-600 dark:text-amber-400", bar: "bg-amber-500" },
    low: { label: "Low", chip: "bg-sky-500/10 text-sky-600 dark:text-sky-400", bar: "bg-sky-500" },
};
const FALLBACK_STYLE = { label: "Tip", chip: "bg-accent-soft text-accent", bar: "bg-accent" };

const styleFor = severity => SEVERITY_STYLE[severity] || FALLBACK_STYLE;
const rankFor = severity => SEVERITY_ORDER[severity] ?? 4;

const byPriority = (a, b) => (b.gain || 0) - (a.gain || 0) || rankFor(a.severity) - rankFor(b.severity);

const ProgressRing = ({ done, total }) => {
    const percent = total === 0 ? 100 : Math.round((done / total) * 100);
    const radius = 40;
    const circumference = 2 * Math.PI * radius;
    return (
        <div className="relative h-24 w-24 shrink-0">
            <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
                <circle cx="50" cy="50" r={radius} fill="none" strokeWidth="9" className="stroke-line" />
                <circle
                    cx="50"
                    cy="50"
                    r={radius}
                    fill="none"
                    strokeWidth="9"
                    strokeLinecap="round"
                    className="stroke-accent transition-all duration-500 motion-reduce:transition-none"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference * (1 - percent / 100)}
                />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-ink">{percent}</span>
                <span className="text-[10px] text-muted">%</span>
            </div>
        </div>
    );
};

const FixItem = ({ finding, done, open, onToggleDone, onToggleOpen, showGain }) => {
    const style = styleFor(finding.severity);
    const href = typeof finding.learnMore === "string" ? finding.learnMore : finding.learnMore?.url;
    const panelId = `fix-panel-${finding.id}`;

    return (
          <li className={`relative overflow-hidden rounded-xl border border-line bg-white/60 transition-opacity ${done ? "opacity-60" : ""}`}>
            <span className={`absolute inset-y-0 left-0 w-1 ${style.bar}`} aria-hidden="true" />
            <div className="flex items-center gap-3 py-3 pl-5 pr-3">
                <button
                    type="button"
                    role="checkbox"
                    aria-checked={done}
                    aria-label={`Mark "${finding.title}" as fixed`}
                    onClick={onToggleDone}
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                        done ? "border-accent bg-accent text-white" : "border-line text-transparent hover:border-accent"
                    }`}
                >
                    <LuCheck className="h-3.5 w-3.5" aria-hidden="true" />
                </button>

                <button
                    type="button"
                    aria-expanded={open}
                    aria-controls={panelId}
                    onClick={onToggleOpen}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                    <span className="min-w-0 flex-1 text-sm font-semibold text-ink sm:text-base">
                        <span className={done ? "line-through" : ""}>{finding.title}</span>
                    </span>
                    {showGain && finding.gain > 0 && (
                        <span className="hidden shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent sm:inline">
                            +{finding.gain} pts
                        </span>
                    )}
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${style.chip}`}>{style.label}</span>
                    <LuChevronDown
                        className={`h-4 w-4 shrink-0 text-muted transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
                        aria-hidden="true"
                    />
                </button>
            </div>

            {open && (
                <div id={panelId} className="space-y-4 border-t border-line px-5 py-4 text-sm">
                    {finding.why && (
                        <div>
                            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Why it matters</h4>
                            <p className="text-ink">{finding.why}</p>
                        </div>
                    )}
                    {finding.fix && (
                        <div>
                            <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">How to fix it</h4>
                            <p className="whitespace-pre-line rounded-lg bg-accent-soft p-3 text-ink">{finding.fix}</p>
                        </div>
                    )}
                    {href && (
                        <a
                            href={href}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-accent hover:underline"
                        >
                            Learn more <LuExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                        </a>
                    )}
                </div>
            )}
        </li>
    );
};

export default function FixGuidePage() {
    const { result } = useScan();
    const [doneIds, setDoneIds] = useState({}); // PLACEHOLDER: ticks live on the page only, they reset on refresh.
    const [openIds, setOpenIds] = useState({});

    if (!result) return <p className="text-muted">Loading...</p>;

    const findings = result.findings || [];
    const issues = findings.filter(f => f.kind === "issue").sort(byPriority);
    const recommendations = findings.filter(f => f.kind === "recommendation").sort(byPriority);
    const doneCount = issues.filter(f => doneIds[f.id]).length;

    const toggle = (setter, id) => setter(prev => ({ ...prev, [id]: !prev[id] }));

    const renderList = list => (
        <ul className="space-y-3">
            {list.map(f => (
                <FixItem
                    key={f.id}
                    finding={f}
                    done={!!doneIds[f.id]}
                    open={!!openIds[f.id]}
                    showGain={!result.incomplete}
                    onToggleDone={() => toggle(setDoneIds, f.id)}
                    onToggleOpen={() => toggle(setOpenIds, f.id)}
                />
            ))}
        </ul>
    );

    return (
        <div className="space-y-8">
            <header>
                <h2 className="text-2xl font-bold text-ink">Fix guide</h2>
                <p className="mt-1 text-muted">Every problem we found, in the order worth fixing. Start at the top.</p>
            </header>

            <section className="flex items-center gap-5 rounded-2xl border border-line/60 bg-white/60 p-5 shadow-sm">
                <ProgressRing done={doneCount} total={issues.length} />
                <div>
                    <p className="text-lg font-semibold text-ink">
                        {doneCount} of {issues.length} fixed
                    </p>
                    <p className="mt-1 text-sm text-muted">
                        Tick each one off as you go. Your score only updates after a re-scan, so run one when you&apos;re done.
                    </p>
                </div>
            </section>

            {issues.length === 0 ? (
                <div className="flex items-center gap-3 rounded-xl border border-line bg-surface p-5 text-ink">
                    <LuPartyPopper className="h-5 w-5 text-accent" aria-hidden="true" />
                    <p>No problems to fix. Nice work!</p>
                </div>
            ) : (
                <section aria-labelledby="fix-issues">
                    <h3 id="fix-issues" className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
                        Problems to fix
                    </h3>
                    {renderList(issues)}
                </section>
            )}

            {recommendations.length > 0 && (
                <section aria-labelledby="fix-tips">
                    <h3 id="fix-tips" className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">
                        Good practice (optional)
                    </h3>
                    <p className="mb-3 text-sm text-muted">Not security holes, but worth doing when you have time.</p>
                    {renderList(recommendations)}
                </section>
            )}
        </div>
    );
}