"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { LuCheck, LuX } from "react-icons/lu";
import { useScan } from "../../scan-context";
import { CHECKLIST_SECTIONS } from "./checklist-items";

const evaluate = (item, result) => {
    if (!item.categories) return { status: "manual", findings: [] };

    const findings = (result.findings || []).filter(f => {
        if (!item.categories.includes(f.category)) return false;
        if (f.kind !== "issue" && !item.includeTips) return false;
        if (!item.match) return true;
        const haystack = `${f.id} ${f.title}`.toLowerCase();
        const byId = item.match.ids?.some(prefix => f.id.startsWith(prefix));
        const byText = item.match.text?.some(word => haystack.includes(word.toLowerCase()));
        return !!(byId || byText);
    });
    if (findings.length > 0) return { status: "fail", findings };

    const checks = (result.checks || []).filter(c => item.categories.includes(c.category));
    const ran = checks.some(c => c.status !== "unavailable" && c.status !== "not_checked");
    return { status: ran ? "pass" : "unknown", findings: [] };
};

const ProgressRing = ({ done, total }) => {
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);
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

const ChecklistRow = ({ item, status, findings, ticked, onToggle, fixGuideHref }) => {
    const isAuto = !!item.categories;
    const done = status === "pass" || (status !== "fail" && ticked);

    return (
        <li
            className={`rounded-xl border bg-surface p-4 transition-colors ${
                status === "fail" ? "border-red-500/40" : "border-line"
            } ${done ? "opacity-70" : ""}`}
        >
            <div className="flex items-start gap-3">
                {status === "pass" ? (
                    <span
                        role="img"
                        aria-label="Passed"
                        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-accent bg-accent text-white"
                    >
                        <LuCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                ) : status === "fail" ? (
                    <span
                        role="img"
                        aria-label="Not passing"
                        className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-red-500 text-red-500"
                    >
                        <LuX className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                ) : (
                    <button
                        type="button"
                        role="checkbox"
                        aria-checked={ticked}
                        aria-label={`Mark "${item.title}" as done`}
                        onClick={onToggle}
                        className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${
                            ticked ? "border-accent bg-accent text-white" : "border-line text-transparent hover:border-accent"
                        }`}
                    >
                        <LuCheck className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                )}

                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className={`font-semibold text-ink ${done ? "line-through" : ""}`}>{item.title}</span>
                        {isAuto && (status === "pass" || status === "fail") && (
                            <span className="rounded border border-line px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-accent">
                                AUTO
                            </span>
                        )}
                        {status === "unknown" && (
                            <span className="rounded border border-line px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-muted">
                                NOT SCANNED
                            </span>
                        )}
                    </div>
                    <p className="mt-1 text-sm text-muted">{item.hint}</p>

                    {status === "fail" && (
                        <div className="mt-2 text-sm">
                            <p className="text-critical">
                                Not passing yet: {findings[0].title}
                                {findings.length > 1 ? ` (and ${findings.length - 1} more)` : ""}
                            </p>
                            <Link href={fixGuideHref} className="text-accent hover:underline">
                                See how to fix it in the Fix guide
                            </Link>
                        </div>
                    )}
                    {status === "unknown" && (
                        <p className="mt-2 text-sm text-muted">
                            This scan didn&apos;t check it (for example, you scanned a website but not a repository). Tick it yourself when you&apos;ve checked.
                        </p>
                    )}
                </div>
            </div>
        </li>
    );
};

export default function ChecklistPage() {
    const { result } = useScan();
    const { id: scanId } = useParams();
    const [tickedIds, setTickedIds] = useState({});

    if (!result) return <p className="text-muted">Loading...</p>;

    const sections = CHECKLIST_SECTIONS.map(section => ({
        ...section,
        rows: section.items.map(item => ({ item, ...evaluate(item, result) })),
    }));

    const allRows = sections.flatMap(s => s.rows);
    const doneCount = allRows.filter(r => r.status === "pass" || (r.status !== "fail" && tickedIds[r.item.id])).length;
    const failCount = allRows.filter(r => r.status === "fail").length;
    const fixGuideHref = `/scan/${scanId}/fix-guide`;

    const tickableRows = allRows.filter(r => r.status === "manual" || r.status === "unknown");
    const tickedCount = tickableRows.filter(r => tickedIds[r.item.id]).length;
    const selectAll = () => setTickedIds(prev => ({ ...prev, ...Object.fromEntries(tickableRows.map(r => [r.item.id, true])) }));
    const deselectAll = () => setTickedIds(prev => ({ ...prev, ...Object.fromEntries(tickableRows.map(r => [r.item.id, false])) }));

    return (
        <div className="space-y-8">
            <header>
                <h2 className="text-2xl font-bold text-ink">Pre-deploy checklist</h2>
                <p className="mt-1 text-muted">
                    Worth checking before a site goes live. Items marked AUTO are ticked for you from your scan. The rest are up to you.
                </p>
            </header>

            <section className="flex items-center gap-5 rounded-2xl border border-line/60 bg-surface p-5 shadow-sm">
                <ProgressRing done={doneCount} total={allRows.length} />
                <div>
                    <p className="text-lg font-semibold text-ink">
                        {doneCount} of {allRows.length} done
                    </p>
                    <p className="mt-1 text-sm text-muted">
                        {failCount > 0
                            ? `${failCount} ${failCount === 1 ? "item needs" : "items need"} fixing. Work down the list, then run a new scan.`
                            : "Work down the list. Nothing here takes more than a few minutes."}
                    </p>
                    {tickableRows.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2 text-sm">
                            <button
                                type="button"
                                onClick={selectAll}
                                disabled={tickedCount === tickableRows.length}
                                className="rounded-full border border-line px-3 py-1 font-medium text-accent transition-colors hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                Select all
                            </button>
                            <button
                                type="button"
                                onClick={deselectAll}
                                disabled={tickedCount === 0}
                                className="rounded-full border border-line px-3 py-1 font-medium text-muted transition-colors hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                Deselect all
                            </button>
                        </div>
                    )}
                </div>
            </section>

            {sections.map((section, index) => (
                <section key={section.title} aria-labelledby={`checklist-section-${index}`}>
                    <h3
                        id={`checklist-section-${index}`}
                        className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted"
                    >
                        {section.title}
                    </h3>
                    <ul className="space-y-3">
                        {section.rows.map(row => (
                            <ChecklistRow
                                key={row.item.id}
                                item={row.item}
                                status={row.status}
                                findings={row.findings}
                                ticked={!!tickedIds[row.item.id]}
                                onToggle={() => setTickedIds(prev => ({ ...prev, [row.item.id]: !prev[row.item.id] }))}
                                fixGuideHref={fixGuideHref}
                            />
                        ))}
                    </ul>
                </section>
            ))}
        </div>
    );
}