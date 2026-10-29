import Link from "next/link";
import { LuArrowDownRight, LuArrowUpRight, LuMinus } from "react-icons/lu";

const STATUS_LABELS = {
    new: "Newly detected",
    gone: "No longer detected",
    changed: "Still present, evidence changed",
    present: "Still present",
    uncertain: "Cannot verify change",
};

function Evidence({ row }) {
    return (
        <details className="mt-2 text-sm">
            <summary className="cursor-pointer">Compare evidence</summary>
            <div className="grid gap-3 sm:grid-cols-2">
                {[["Older", row.oldFinding], ["Newer", row.newFinding]].map(([title, finding]) => (
                    <div key={title}>
                        <p className="font-semibold">{title}</p>
                        <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-all text-xs">
                            {JSON.stringify({ hosts: finding.hosts || [], details: finding.details ?? null }, null, 2)}
                        </pre>
                    </div>
                ))}
            </div>
        </details>
    );
}

function FindingGroups({ title, rows, olderId, newerId }) {
    return (
        <section className="space-y-3" aria-label={title}>
            <h3 className="flex items-center gap-3 text-lg font-semibold">{title} <span className="rounded-full bg-surface-strong px-2.5 py-0.5 text-sm tabular-nums text-muted">{rows.length}</span></h3>
            {rows.length === 0 && <p className="text-sm text-muted">No {title.toLowerCase()} in either scan.</p>}
            {Object.entries(STATUS_LABELS).map(([status, label]) => {
                const group = rows.filter(row => row.status === status);
                if (!group.length) return null;
                return (
                    <section key={status} className="rounded-xl border border-line bg-surface p-4">
                        <h4 className="flex items-center gap-2 text-sm font-semibold">{label} <span className="rounded-full bg-page px-2 py-0.5 tabular-nums text-muted">{group.length}</span></h4>
                        {status === "uncertain" && (
                            <p className="mt-1 text-sm text-muted">Newly assessed or cannot verify: the relevant check did not succeed in both scans, or this finding has no scored check.</p>
                        )}
                        <ul className="mt-3 divide-y divide-line">
                            {group.map(row => (
                                <li key={row.id} className="py-3 first:pt-0 last:pb-0">
                                    <Link className="font-medium text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" href={`/scan/${row.newFinding ? newerId : olderId}?finding=${encodeURIComponent(row.id)}`}>
                                        {row.finding.title}
                                    </Link>
                                    <p className="text-sm text-muted">
                                        <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold capitalize ${["critical", "high"].includes(row.finding.severity) ? "border-critical/30 bg-critical/10 text-critical" : "border-line bg-page text-ink"}`}>{row.finding.severity || "Tip"}</span>
                                        {row.status === "changed" && ` · Severity: ${row.oldFinding.severity || "Tip"} → ${row.newFinding.severity || "Tip"}. Hosts or technical details may also have changed.`}
                                    </p>
                                    {row.status === "changed" && <Evidence row={row} />}
                                </li>
                            ))}
                        </ul>
                    </section>
                );
            })}
        </section>
    );
}

export default function ComparisonResults({ comparison }) {
    const { older, newer, rows, delta, reusedSources } = comparison;
    const tone = delta === null || delta === 0 ? "border-line text-ink" : delta > 0 ? "border-accent/30 text-accent" : "border-critical/30 text-critical";
    const Icon = delta === null || delta === 0 ? LuMinus : delta > 0 ? LuArrowUpRight : LuArrowDownRight;
    const title = delta === null ? "Score change unavailable" : delta === 0 ? "Score unchanged" : delta > 0 ? "Score improved" : "Score decreased";
    return (
        <div className="space-y-6">
            <section aria-label="Comparison summary" className={`rounded-2xl border bg-surface p-5 ${tone}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="flex items-center gap-2 font-semibold"><Icon aria-hidden="true" className="size-5" />{title}</h3>
                    <p role="status" className="text-2xl font-semibold tabular-nums">{delta === null ? "Unavailable" : `${delta > 0 ? "+" : ""}${delta} points`}</p>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm text-ink sm:grid-cols-5">
                    {Object.entries(STATUS_LABELS).map(([status, label]) => <div key={status}><dt className="text-muted">{label}</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{rows.filter(row => row.status === status).length}</dd></div>)}
                </dl>
                <p className="mt-3 text-xs text-muted">Counts include issues and recommendations. An unchanged score can still have changed findings.</p>
            </section>
            <p className="text-sm text-muted">No longer detected does not prove a fix. Changes with missing check coverage remain unverified.</p>
            <details className="rounded-xl border border-line bg-surface px-4 py-3 text-sm">
                <summary className="cursor-pointer font-medium text-ink focus-visible:outline-2 focus-visible:outline-accent">How comparison works</summary>
                <p className="mt-3 text-muted">Choose two saved scans of the same website and repository to see what changed.</p>
                <ul className="mt-3 list-disc space-y-2 pl-5 text-muted">
                    <li>Pick either scan in either column. Changes are measured from the earlier scan to the later scan.</li>
                    <li>A higher score means less detected exposure. Older scores are calculated using the current scoring rules.</li>
                    <li>Findings are grouped by what is newly detected, no longer detected, still present, or cannot be verified. Changes in severity, servers or technical details are highlighted.</li>
                    <li>We only confirm a finding appeared or disappeared when its check completed successfully in both scans. Otherwise, the change is marked &ldquo;Cannot verify change&rdquo;.</li>
                    <li>Saved scans may reuse cached results. Capture dates show when each source was checked. &ldquo;No longer detected&rdquo; does not prove a fix.</li>
                </ul>
            </details>
            {(older.incomplete || newer.incomplete) && <p className="text-warm">One or both scans are incomplete. Compare the available evidence with care.</p>}
            {reusedSources.length > 0 && (
                <p className="text-warm">Shared capture dates for {reusedSources.map(s => s === "domain" ? "website" : "repository").join(" and ")}: these saved scans may reuse cached results. Run a fresh scan to check fixes.</p>
            )}
            {rows.length === 0 && <p>No findings in either scan. Missing checks still do not count as passes.</p>}
            <FindingGroups title="Issues" rows={rows.filter(row => (row.finding.kind || "issue") === "issue")} olderId={older.id} newerId={newer.id} />
            <FindingGroups title="Good-practice recommendations" rows={rows.filter(row => row.finding.kind === "recommendation")} olderId={older.id} newerId={newer.id} />
        </div>
    );
}
