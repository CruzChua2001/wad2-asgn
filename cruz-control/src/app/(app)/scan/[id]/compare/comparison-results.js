import { LuArrowDownRight, LuArrowUpRight, LuChevronDown, LuClock3, LuCodeXml, LuLightbulb, LuMinus, LuTriangleAlert, LuWrench } from "react-icons/lu";
import ScanEntrance from "@/components/scan-entrance";
import FixText from "../fix-text";
import FindingDetails from "../finding-details";
import { withTerms } from "../glossary";
import { scanDate } from "@/lib/scan-comparison";
import ComparisonHelp from "./comparison-help";

const STATUS_LABELS = {
    new: "Newly detected",
    gone: "No longer detected",
    changed: "Still present, evidence changed",
    present: "Still present",
    uncertain: "Cannot verify change",
};

function Evidence({ row }) {
    return (
        <details className="rounded-xl border border-line bg-page/60 px-4 text-sm">
            <summary className="min-h-11 cursor-pointer py-3 font-medium text-ink focus-visible:outline-2 focus-visible:outline-accent">Compare evidence</summary>
            <div className="grid min-w-0 gap-3 pb-4 grid-cols-[repeat(auto-fit,minmax(min(100%,20rem),1fr))]">
                {[["Before", row.oldFinding], ["After", row.newFinding]].map(([title, finding]) => (
                    <div key={title} className="min-w-0 rounded-lg border border-line bg-surface p-3">
                        <p className="mb-2 font-semibold text-ink">{title}</p>
                        <pre className="max-h-64 max-w-full overflow-auto whitespace-pre-wrap break-all text-xs text-muted">
                            {JSON.stringify({ hosts: finding.hosts || [], details: finding.details ?? null }, null, 2)}
                        </pre>
                    </div>
                ))}
            </div>
        </details>
    );
}

function FindingRow({ row, older, newer }) {
    const finding = row.finding;
    const hasTechnicalDetails = finding.details && Object.keys(finding.details).length > 0;
    const hasSideDetails = hasTechnicalDetails || finding.hosts?.length > 0 || row.status === "changed";
    return (
        <li className="min-w-0 wrap-anywhere">
            <details className="group/finding min-w-0 rounded-xl border border-line bg-surface open:border-accent/50">
                <summary className="flex min-h-16 cursor-pointer list-none flex-wrap items-center justify-between gap-x-4 gap-y-3 rounded-xl px-4 py-4 transition-colors hover:bg-accent-soft/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:transition-none group-open/finding:rounded-b-none group-open/finding:bg-accent-soft/30 sm:px-5 [&::-webkit-details-marker]:hidden">
                    <span className="flex min-w-0 flex-1 basis-56 flex-wrap items-center gap-2">
                        <span className="min-w-0 font-medium text-ink wrap-anywhere">{finding.title}</span>
                        <span className={`inline-flex shrink-0 rounded-md border px-2 py-0.5 text-xs font-semibold capitalize ${["critical", "high"].includes(finding.severity) ? "border-critical/30 bg-critical/10 text-critical" : "border-line bg-page text-ink"}`}>{finding.severity || "Tip"}</span>
                    </span>
                    <span className="ml-auto inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-accent/30 bg-accent-soft px-3 py-2 text-sm font-semibold text-accent">
                        <span className="group-open/finding:hidden">View details</span>
                        <span className="hidden group-open/finding:inline">Hide details</span>
                        <LuChevronDown aria-hidden="true" className="size-4 group-open/finding:rotate-180" />
                    </span>
                </summary>
                <div className="min-w-0 space-y-4 border-t border-line p-4 text-sm leading-relaxed text-muted sm:p-5" role="region" aria-label={`${finding.title} details`}>
                    <p className="flex flex-wrap items-center gap-2 text-sm text-muted"><LuClock3 aria-hidden="true" className="size-4 shrink-0" />Saved {scanDate((row.newFinding ? newer : older).created_at)}</p>
                    <div className={`grid min-w-0 items-start gap-5 ${hasSideDetails ? "grid-cols-[repeat(auto-fit,minmax(min(100%,22rem),1fr))]" : "grid-cols-1"}`}>
                        <div className="min-w-0 space-y-4">
                            {row.status === "gone" && <p className="rounded-xl border border-accent/20 bg-accent-soft/30 px-4 py-3 text-ink">These details are from Before. This finding was not detected in After; this does not prove a fix.</p>}
                            <section className="space-y-2">
                                <h5 className="flex items-center gap-2 font-semibold text-ink"><LuLightbulb aria-hidden="true" className="size-4 shrink-0 text-accent" />Why it matters</h5>
                                <p className="max-w-prose">{withTerms(finding.explain || "No explanation was saved for this finding.")}</p>
                            </section>
                            {finding.fix && <section className="rounded-xl border border-accent/20 bg-accent-soft/40 p-4">
                                <h5 className="flex items-center gap-2 font-semibold text-ink"><LuWrench aria-hidden="true" className="size-4 shrink-0 text-accent" />{row.status === "gone" ? "Previous guidance" : "What to do"}</h5>
                                <div className="mt-2 max-w-prose"><FixText text={finding.fix} label={null} /></div>
                            </section>}
                            {finding.learnMore?.url?.startsWith("https://") && (
                                <a href={finding.learnMore.url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center text-accent underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-accent">{finding.learnMore.label || "Learn more"}</a>
                            )}
                        </div>
                        {hasSideDetails && <div className="min-w-0 space-y-3">
                            {finding.hosts?.length > 0 && <section className="rounded-xl border border-line bg-page/60 p-4">
                                <h5 className="mb-2 font-semibold text-ink">Affected servers</h5>
                                <ul className="flex flex-wrap gap-2">{finding.hosts.map(host => <li key={host} className="min-w-0 rounded-md border border-line bg-surface px-2 py-1 font-mono wrap-anywhere">{host}</li>)}</ul>
                            </section>}
                            {hasTechnicalDetails && <details className="group/technical rounded-xl border border-line bg-page/60">
                                <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-xl p-4 font-medium text-ink hover:bg-accent-soft/30 focus-visible:outline-2 focus-visible:outline-accent [&::-webkit-details-marker]:hidden">
                                    <span className="flex items-center gap-2"><LuCodeXml aria-hidden="true" className="size-4 shrink-0 text-accent" />Technical details</span>
                                    <LuChevronDown aria-hidden="true" className="size-4 shrink-0 text-muted group-open/technical:rotate-180" />
                                </summary>
                                <div className="min-w-0 border-t border-line p-4 wrap-anywhere"><FindingDetails details={finding.details} /></div>
                            </details>}
                            {row.status === "changed" && <>
                                <p>Severity: {row.oldFinding.severity || "Tip"} → {row.newFinding.severity || "Tip"}. Hosts or technical details may also have changed.</p>
                                <Evidence row={row} />
                            </>}
                        </div>}
                    </div>
                </div>
            </details>
        </li>
    );
}

function FindingGroups({ title, rows, older, newer, animateEntrance, delay }) {
    return (
        <ScanEntrance as="section" enabled={animateEntrance} delay={delay} className="min-w-0 space-y-3" aria-label={title}>
            <h3 className="flex flex-wrap items-center gap-3 text-lg font-semibold">{title} <span className="rounded-full bg-surface-strong px-2.5 py-0.5 text-sm tabular-nums text-muted">{rows.length}</span></h3>
            {rows.length === 0 && <p className="text-sm text-muted">No {title.toLowerCase()} in either scan.</p>}
            {Object.entries(STATUS_LABELS).map(([status, label]) => {
                const group = rows.filter(row => row.status === status);
                if (!group.length) return null;
                return (
                    <section key={status} className="min-w-0 rounded-xl border border-line bg-surface-soft/40 p-4 sm:p-5">
                        <h4 className="flex flex-wrap items-center gap-2 text-sm font-semibold">{label} <span className="rounded-full bg-page px-2 py-0.5 tabular-nums text-muted">{group.length}</span></h4>
                        {status === "uncertain" && (
                            <p className="mt-1 text-sm text-muted">Newly assessed or cannot verify: the relevant check did not succeed in both scans, or this finding has no scored check.</p>
                        )}
                        <ul className="mt-4 space-y-3">{group.map(row => <FindingRow key={row.id} row={row} older={older} newer={newer} />)}</ul>
                    </section>
                );
            })}
        </ScanEntrance>
    );
}

export default function ComparisonResults({ comparison, animateEntrance = true }) {
    const { older, newer, rows, delta, reusedSources } = comparison;
    const sameSavedTime = Date.parse(older.created_at) === Date.parse(newer.created_at);
    const neutral = delta === null || delta === 0 || sameSavedTime;
    const tone = neutral ? "border-line text-ink" : delta > 0 ? "border-accent/30 text-accent" : "border-critical/30 text-critical";
    const Icon = neutral ? LuMinus : delta > 0 ? LuArrowUpRight : LuArrowDownRight;
    const title = delta === null ? "Score change unavailable" : delta === 0 ? "Score unchanged" : sameSavedTime ? "Score difference" : delta > 0 ? "Score improved" : "Score decreased";
    return (
        <div className="min-w-0 space-y-6">
            <ScanEntrance as="section" enabled={animateEntrance} delay={0.12} aria-label="Comparison summary" className={`rounded-2xl border bg-surface p-5 ${tone}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="flex items-center gap-2 font-semibold"><Icon aria-hidden="true" className="size-5" />{title}</h3>
                    <p role="status" className="text-2xl font-semibold tabular-nums">{delta === null ? "Unavailable" : `${delta > 0 ? "+" : ""}${delta} points`}</p>
                </div>
                <dl className="mt-4 grid gap-3 border-t border-line pt-4 text-sm text-ink grid-cols-[repeat(auto-fit,minmax(min(100%,8rem),1fr))]">
                    {Object.entries(STATUS_LABELS).map(([status, label]) => <div key={status} className="min-w-0"><dt className="text-muted">{label}</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{rows.filter(row => row.status === status).length}</dd></div>)}
                </dl>
                <div className="mt-4 space-y-3 border-t border-line pt-4 text-sm leading-relaxed text-muted">
                    <div className="grid min-w-0 grid-cols-1 gap-x-3 md:grid-cols-[minmax(0,1fr)_auto]">
                        <div className="max-w-prose space-y-1">
                            <p>Counts include issues and recommendations. An unchanged score can still have changed findings.</p>
                            <p>No longer detected does not prove a fix. Changes with missing check coverage remain unverified.</p>
                        </div>
                        <ComparisonHelp />
                    </div>
                    {(older.incomplete || newer.incomplete || reusedSources.length > 0) && (
                        <div className="flex items-start gap-2 rounded-lg border border-warm/30 bg-warm/10 px-3 py-3 text-ink">
                            <LuTriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warm" />
                            <div className="min-w-0 space-y-1">
                                {(older.incomplete || newer.incomplete) && <p>One or both scans are incomplete. Compare the available evidence with care.</p>}
                                {reusedSources.length > 0 && <p>Shared capture dates for {reusedSources.map(s => s === "domain" ? "website" : "repository").join(" and ")}: these saved scans may reuse cached results. Run a fresh scan to check fixes.</p>}
                            </div>
                        </div>
                    )}
                    {rows.length === 0 && <p>No findings in either scan. Missing checks still do not count as passes.</p>}
                </div>
            </ScanEntrance>
            <FindingGroups title="Issues" rows={rows.filter(row => (row.finding.kind || "issue") === "issue")} older={older} newer={newer} animateEntrance={animateEntrance} delay={0.18} />
            <FindingGroups title="Good-practice recommendations" rows={rows.filter(row => row.finding.kind === "recommendation")} older={older} newer={newer} animateEntrance={animateEntrance} delay={0.24} />
        </div>
    );
}
