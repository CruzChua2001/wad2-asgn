"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { LuPartyPopper } from "react-icons/lu";
import { useScan } from "../../scan-context";
import FixItem from "./fix-item";

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

const rankFor = severity => SEVERITY_ORDER[severity] ?? 4;

const bySeverity = (a, b) => rankFor(a.severity) - rankFor(b.severity);

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

export default function FixGuidePage() {
    const { result } = useScan();
    const { id: scanId } = useParams(); // the [id] in /scan/[id]/fix-guide
    const [doneIds, setDoneIds] = useState({}); // PLACEHOLDER: ticks live on the page only, they reset on refresh.
    const [openIds, setOpenIds] = useState({});

    if (!result) return <p className="text-muted">Loading...</p>;

    const findings = result.findings || [];
    const issues = findings.filter(f => f.kind === "issue").sort(bySeverity);
    const recommendations = findings.filter(f => f.kind === "recommendation").sort(bySeverity);
    const doneCount = issues.filter(f => doneIds[f.id]).length;
    const allDone = issues.length > 0 && doneCount === issues.length;

    const toggle = (setter, id) => setter(prev => ({ ...prev, [id]: !prev[id] }));

    const selectAll = () => setDoneIds(prev => ({ ...prev, ...Object.fromEntries(issues.map(f => [f.id, true])) }));
    const deselectAll = () => setDoneIds(prev => ({ ...prev, ...Object.fromEntries(issues.map(f => [f.id, false])) }));
    const openCount = Object.values(openIds).filter(Boolean).length;
    const collapseAll = () => setOpenIds({});

    const renderList = list => (
        <ul className="space-y-3">
            {list.map(f => (
                <FixItem
                    key={f.id}
                    scanId={scanId}
                    finding={f}
                    done={!!doneIds[f.id]}
                    open={!!openIds[f.id]}
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
                <p className="mt-1 text-muted">Every problem we found, starting with the most serious.</p>
            </header>

            <section className="flex items-center gap-5 rounded-2xl border border-line/60 bg-surface p-5 shadow-sm">
                <ProgressRing done={doneCount} total={issues.length} />
                <div>
                    <p className="text-lg font-semibold text-ink">
                        {doneCount} of {issues.length} fixed
                    </p>
                    <p className="mt-1 text-sm text-muted">Tick each one off as you go, then run a new scan to check your fixes.</p>
                    {issues.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2 text-sm">
                            <button
                                type="button"
                                onClick={selectAll}
                                disabled={allDone}
                                className="rounded-full border border-line px-3 py-1 font-medium text-accent transition-colors hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                Fixed all
                            </button>
                            <button
                                type="button"
                                onClick={deselectAll}
                                disabled={doneCount === 0}
                                className="rounded-full border border-line px-3 py-1 font-medium text-muted transition-colors hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                Deselect all
                            </button>
                        </div>
                    )}
                </div>
            </section>

            {issues.length === 0 ? (
                <div className="flex items-center gap-3 rounded-xl border border-line bg-surface p-5 text-ink">
                    <LuPartyPopper className="h-5 w-5 text-accent" aria-hidden="true" />
                    <p>No problems to fix. Nice work!</p>
                </div>
            ) : (
                <section aria-labelledby="fix-issues">
                    <div className="mb-3 flex items-center justify-between">
                        <h3 id="fix-issues" className="text-xs font-semibold uppercase tracking-wide text-muted">
                            Problems to fix
                        </h3>
                        {/* Only renders the button when openCount is greater than 0 */}
                        {openCount > 0 && (
                            <button
                                type="button"
                                onClick={collapseAll}
                                className="text-xs font-medium text-accent hover:underline"
                            >
                                Collapse all
                            </button>
                        )}
                    </div>
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