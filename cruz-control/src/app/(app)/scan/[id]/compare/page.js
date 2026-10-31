"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import api from "@/lib/api";
import { useAuth } from "@/components/auth/auth-provider";
import LoadingOverlay from "@/components/loading-overlay";
import { motion, useReducedMotion } from "motion/react";
import ComparisonResults from "./comparison-results";
import ComparisonEmpty from "./comparison-empty";
import ScanCard from "./scan-card";
import { useScan } from "../../scan-context";
import { compareScans, newestFirst, sameTargets, targetKey } from "@/lib/scan-comparison";
import { scanNumbers } from "@/lib/scan-numbers";

const buttonClass = "min-h-11 cursor-pointer rounded-lg border border-line px-3 py-2 text-accent hover:bg-accent-soft";

function ProjectComparison({ id, projectId, role }) {
    const router = useRouter();
    const query = useSearchParams();
    const reduceMotion = useReducedMotion();
    const [history, setHistory] = useState(null);
    const [historyAttempt, setHistoryAttempt] = useState(0);
    const [pairAttempt, setPairAttempt] = useState(0);
    const [pair, setPair] = useState(null);
    // Results unmount while fetching another pair; only the first pair gets an
    // entrance. Card keys stay tied to A/B so their controls and focus survive.
    const entrancePending = useRef(true);
    // Legacy first/against query names now preserve the visual A/B positions.
    const first = query.get("first") || id;
    const anchor = history?.scans?.find(scan => scan.id === id);
    const options = anchor ? history.scans.filter(scan => sameTargets(anchor, scan)) : [];
    const second = query.get("against") ?? options.find(scan => scan.id !== first)?.id ?? "";
    const numbers = scanNumbers(history?.scans || []);
    const sourceId = query.get("fromHistory");
    const fromHistory = sourceId === first && options.some(scan => scan.id === sourceId);
    const aDate = Date.parse(options.find(scan => scan.id === first)?.created_at);
    const bDate = Date.parse(options.find(scan => scan.id === second)?.created_at);
    const sameSavedTime = first !== second && Number.isFinite(aDate) && aDate === bDate;
    const selectionError = first === second ? "Choose two different scans."
        : !options.some(scan => scan.id === first) || !options.some(scan => scan.id === second)
            ? "A selected scan is unavailable or has different targets. Choose two matching scans." : "";
    const requestKey = `${first}:${second}:${pairAttempt}`;

    useEffect(() => {
        let active = true;
        const load = async () => {
            try {
                const { data } = await api.get(`/api/project/${projectId}/scan`);
                if (active) setHistory({ attempt: historyAttempt, scans: newestFirst(data) });
            } catch (e) {
                if (active) setHistory({ attempt: historyAttempt, error: e.response?.data?.error || "Could not load scan history. Please try again." });
            }
        };
        load();
        return () => { active = false; };
    }, [projectId, historyAttempt]);

    useEffect(() => {
        if (!history?.scans || selectionError) return;
        let active = true;
        const load = async () => {
            try {
                const responses = await Promise.all([api.get(`/api/scan/${first}`), api.get(`/api/scan/${second}`)]);
                if (!active) return;
                const [a, b] = responses.map(response => response.data);
                // Recheck full results: URL choices and history metadata are not authorization.
                if (a.project_id !== projectId || b.project_id !== projectId || a.id !== first || b.id !== second) {
                    setPair({ key: requestKey, error: "These scans are no longer available in this project." });
                } else {
                    // The helper retains input order for ties. Supply consistent history
                    // order for equal timestamps without moving either visible card.
                    const tied = Date.parse(a.created_at) === Date.parse(b.created_at);
                    const bFirst = tied && history.scans.findIndex(scan => scan.id === b.id) < history.scans.findIndex(scan => scan.id === a.id);
                    setPair({ key: requestKey, animateEntrance: entrancePending.current, ...compareScans(bFirst ? b : a, bFirst ? a : b) });
                    entrancePending.current = false;
                }
            } catch (e) {
                if (active) setPair({ key: requestKey, error: e.response?.data?.error || "Could not load the selected scans. Please try again." });
            }
        };
        load();
        return () => { active = false; };
    }, [first, second, projectId, selectionError, requestKey, history]);

    const select = (name, value) => {
        const selected = options.find(scan => scan.id === value);
        const other = options.find(scan => scan.id === (name === "first" ? second : first));
        if (!selected || selected.id === other?.id) return;
        const params = new URLSearchParams({ first, against: second });
        params.set(name, value);
        if (name !== "first" && fromHistory) params.set("fromHistory", sourceId);
        router.replace(`/scan/${id}/compare?${params}`, { scroll: false });
    };
    if (!history || history.attempt !== historyAttempt) return <LoadingOverlay show />;
    if (history.error) return <div><p role="alert" className="text-critical">{history.error}</p><button className={buttonClass} onClick={() => setHistoryAttempt(n => n + 1)}>Try again</button></div>;
    if (!anchor) return <p role="alert">This scan is no longer in the project&apos;s history.</p>;
    if (options.length < 2) return <ComparisonEmpty projectId={projectId} role={role} total={history.scans.length} missingTargets={targetKey(anchor) === null} />;
    const currentPair = pair?.key === requestKey ? pair : null;
    return (
         <>
            <LoadingOverlay show={false} />
            <motion.div
                className="min-w-0 space-y-5 [overflow-wrap:anywhere]"
                initial={reduceMotion ? false : { opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
            >
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-muted">
                    <span className="break-all"><span className="font-semibold text-ink">Website</span> {anchor.domain ?? "Not included"}</span>
                    <span className="break-all"><span className="font-semibold text-ink">Repository</span> {anchor.github_repo ?? "Not included"}</span>
                    <Link href={`/project/${projectId}/history`} className="inline-flex min-h-11 max-w-full items-center rounded-lg px-2 py-2 sm:ml-auto text-accent underline underline-offset-4 hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-accent">View scan history</Link>
                </div>
                <p className="text-sm text-muted">Choose two different scans. Changes are calculated from earlier to later.</p>
                {fromHistory && <p className="rounded-lg bg-accent-soft px-4 py-3 text-sm text-ink">Scan #{numbers.get(first)} is selected as Scan A. Choose another scan to compare.</p>}
                {sameSavedTime && (
                    <p className="text-sm text-muted">These scans have the same saved time, so their chronological order cannot be established. Scan numbers do not show which ran first.</p>
                )}
                <div className="grid items-stretch gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,24rem),1fr))]">
                    {[["first", first, second, "Scan A"], ["against", second, first, "Scan B"]].map(([name, value, otherId, label]) => {
                        const selected = options.find(scan => scan.id === value);
                        const other = options.find(scan => scan.id === otherId);
                        const difference = selected && other ? Date.parse(selected.created_at) - Date.parse(other.created_at) : NaN;
                        const timing = !Number.isFinite(difference) ? null : difference === 0 ? "Same saved time" : difference < 0 ? "Earlier" : "Later";
                        const details = currentPair?.rows ? [currentPair.older, currentPair.newer].find(scan => scan.id === value) : null;
                        return <ScanCard key={name} label={label} value={value} scan={details || selected} choices={options} otherId={otherId} timing={timing} numbers={numbers} fromHistory={name === "first" && fromHistory} onChange={value => select(name, value)} />;
                    })}
                </div>
                {selectionError ? <p role="alert" className="text-critical">{selectionError}</p> : !currentPair ? <p role="status">Loading comparison...</p> : currentPair.error ? (
                    <div><p role="alert" className="text-critical">{currentPair.error}</p><button className={buttonClass} onClick={() => setPairAttempt(n => n + 1)}>Retry comparison</button></div>
                ) : <ComparisonResults comparison={currentPair} animateEntrance={currentPair.animateEntrance} />}
            </motion.div>
        </>
    );
}

function CompareTab() {
    const { id } = useParams();
    const { status, user } = useAuth();
    const { result, saveToProject, savedScanId, saving, saveError } = useScan();
    if (!result) return <p role="status">Loading scan...</p>;
    return (
        <div className="min-w-0 space-y-6 pb-20 [overflow-wrap:anywhere]">
            <header><h2 className="text-2xl font-semibold">Compare scans</h2><p className="mt-2 text-muted">Compare two scans to see what&apos;s changed.</p></header>
            {!result.projectId ? <div className="space-y-3">
                <p>This scan is not saved to a project. Save to project creates a new project so you can compare future scans.</p>
                <p className="text-sm text-muted">To scan an existing project again, open <Link href="/project" className="text-accent underline">Projects</Link> and choose Re-scan on its card.</p>
                {savedScanId === id ? <Link href="/project" className="text-accent">View it in Projects</Link> : <button className={buttonClass} disabled={saving} onClick={() => saveToProject(id)}>{saving ? "Saving..." : "Save to project"}</button>}
                {saveError && <p role="alert" className="text-critical">{saveError}</p>}
            </div> : status !== "authenticated" ? <p>Log in as a project member to compare these scans.</p> : <>
                <ProjectComparison key={`${id}:${result.projectId}:${user?.id}`} id={id} projectId={result.projectId} role={result.role} />
            </>}
        </div>
    );
}

export default function ComparePage() {
    return <Suspense fallback={<p role="status">Loading comparison...</p>}><CompareTab /></Suspense>;
}
