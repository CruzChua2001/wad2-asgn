import Link from "next/link";
import { LuArrowUpRight, LuClock3 } from "react-icons/lu";
import GradeBadge from "@/components/grade-badge";
import ScanCaptureDates from "@/components/scan-capture-dates";
import { captureDates, scanDate } from "@/lib/scan-comparison";

export default function ScanCard({ label, value, scan, choices, numbers, otherId, timing, fromHistory, onChange }) {
    const dates = scan ? captureDates(scan) : {};
    const optionText = item => {
        const display = scan?.id === item.id ? scan : item;
        return `Scan #${numbers.get(item.id)} · ${scanDate(display.created_at)} · ${display.score ?? "Unknown"}/100`;
    };
    const full = scan && "domain_scans" in scan;
    return (
        <section aria-label={label} className="flex min-w-0 flex-col gap-5 rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-ink">{label}</h3>
                <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">{timing || "Date unknown"}</span>
            </div>
            <label className="grid gap-2 text-xs font-semibold text-muted">Select {label === "Scan A" ? "scan A" : "scan B"}
                <select aria-label={`Select ${label === "Scan A" ? "scan A" : "scan B"}`} value={value} onChange={event => onChange(event.target.value)} className="w-full min-w-0 rounded-xl border border-line bg-page px-3 py-3 text-sm font-normal text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                    {!choices.some(item => item.id === value) && <option value={value}>{scan ? optionText(scan) : "Unavailable selection"}</option>}
                    {choices.map(item => <option key={item.id} value={item.id} disabled={item.id === otherId}>{optionText(item)}</option>)}
                </select>
            </label>
            {scan ? <>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                    <p className="font-semibold text-ink">Scan #{numbers.get(scan.id)}</p>
                    {fromHistory && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">Selected from history</span>}
                </div>
                <div className="flex items-center justify-between gap-4">
                    <p className="text-muted"><span className="text-5xl font-semibold tracking-tight tabular-nums text-ink">{scan.score ?? "—"}</span><span className="ml-1.5 text-sm">/100</span></p>
                    <GradeBadge grade={scan.grade} size="md" />
                </div>
                {!scan.grade && <p className="-mt-3 text-sm text-warm">Incomplete · No grade</p>}
                <div className="space-y-3 border-t border-line pt-4">
                    <p className="flex items-center gap-2 text-sm text-ink"><LuClock3 aria-hidden="true" className="shrink-0 text-muted" />Saved {scanDate(scan.created_at)}</p>
                    <ScanCaptureDates domain={full ? (scan.domain_scans === null ? null : scan.domain_scans?.domain) : scan.domain} githubRepo={full ? (scan.repo_scans === null ? null : scan.repo_scans?.github_repo) : scan.github_repo} domainCapturedAt={dates.domain} repoCapturedAt={dates.repo} />
                </div>
                <Link href={`/scan/${scan.id}`} aria-label={`View ${label.toLowerCase()}`} className="mt-auto inline-flex min-h-10 w-fit items-center gap-2 rounded-lg border border-line px-3 text-sm font-semibold text-accent hover:border-accent hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">View scan <LuArrowUpRight aria-hidden="true" /></Link>
            </> : <p className="text-sm text-muted">Choose an available scan.</p>}
        </section>
    );
}
