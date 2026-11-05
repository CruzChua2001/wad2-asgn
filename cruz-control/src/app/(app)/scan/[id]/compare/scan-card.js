import Link from "next/link";
import { LuArrowUpRight, LuClock3 } from "react-icons/lu";
import GradeBadge from "@/components/grade-badge";
import ScanCaptureDates from "@/components/scan-capture-dates";
import ScanEntrance from "@/components/scan-entrance";
import { captureDates, scanDate } from "@/lib/scan-comparison";

export default function ScanCard({ label, value, scan, choices, numbers, disabledIds, fromHistory, onChange }) {
    const dates = scan ? captureDates(scan) : {};
    const optionText = item => {
        const display = scan?.id === item.id ? scan : item;
        return `Scan #${numbers.get(item.id)} · ${scanDate(display.created_at)} · ${display.score ?? "Unknown"}/100`;
    };
    const full = scan && "domain_scans" in scan;
    const surface = label === "Before"
        ? "border-accent/40 bg-linear-to-br from-accent-soft/60 via-surface to-surface"
        : "border-line bg-linear-to-br from-surface-soft via-surface to-surface";
    return (
        <ScanEntrance as="section" delay={label === "After" ? 0.06 : 0} aria-label={label} className={`flex min-w-0 flex-col gap-5 rounded-2xl border p-5 shadow-sm sm:p-6 ${surface}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold text-ink">{label}</h3>
                    {fromHistory && <span className="rounded-full border border-accent/20 bg-surface/80 px-2 py-0.5 text-xs text-accent">Selected from history</span>}
                </div>
            </div>
            <label className="grid min-w-0 gap-2 text-sm font-medium text-muted">Saved result
                <select aria-label={`Saved result for ${label}`} value={value} onChange={event => onChange(event.target.value)} className="w-full min-w-0 rounded-xl border border-line bg-surface px-3 py-3 text-base font-normal text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                    {!choices.some(item => item.id === value) && <option value={value}>{scan ? optionText(scan) : "Unavailable selection"}</option>}
                    {choices.map(item => <option key={item.id} value={item.id} disabled={disabledIds.includes(item.id)}>{optionText(item)}</option>)}
                </select>
            </label>
            {scan ? <>
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <p className="mb-1 text-sm text-muted">Exposure score</p>
                        <p className="text-muted"><span className="text-5xl font-semibold tracking-tight tabular-nums text-ink">{scan.score ?? "—"}</span><span className="ml-1.5 text-sm">/100</span></p>
                    </div>
                    <GradeBadge grade={scan.grade} size="md" />
                </div>
                {!scan.grade && <p className="-mt-3 text-sm text-warm">Incomplete · No grade</p>}
                <div className="space-y-3 border-t border-line pt-4">
                    <p className="flex items-start gap-2 text-sm text-ink"><LuClock3 aria-hidden="true" className="shrink-0 text-muted" />Saved {scanDate(scan.created_at)}</p>
                    <ScanCaptureDates domain={full ? (scan.domain_scans === null ? null : scan.domain_scans?.domain) : scan.domain} githubRepo={full ? (scan.repo_scans === null ? null : scan.repo_scans?.github_repo) : scan.github_repo} domainCapturedAt={dates.domain} repoCapturedAt={dates.repo} />
                </div>
                <Link href={`/scan/${scan.id}`} aria-label={`View results for ${label.toLowerCase()}`} className="mt-auto inline-flex min-h-11 max-w-full w-fit items-center gap-2 rounded-lg border border-line bg-surface/80 px-3 text-sm font-semibold text-accent hover:border-accent hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">View results <LuArrowUpRight aria-hidden="true" /></Link>
            </> : <p className="text-sm text-muted">Choose an available scan.</p>}
        </ScanEntrance>
    );
}
