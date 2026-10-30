"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { useAuth } from "@/components/auth/auth-provider";
import LoginRequired from "@/components/auth/login-required";
import GradeBadge from "@/components/grade-badge";
import ScanCaptureDates from "@/components/scan-capture-dates";
import ScanEntrance from "@/components/scan-entrance";
import { newestFirst, sameTargets, scanDate } from "@/lib/scan-comparison";
import { scanNumbers } from "@/lib/scan-numbers";

export default function HistoryPage() {
    const { projectId: id } = useParams();
    const { status, user } = useAuth();
    const [attempt, setAttempt] = useState(0);
    const [state, setState] = useState(null);
    const key = `${id}:${user?.id}:${attempt}`;

    useEffect(() => {
        if (status !== "authenticated") return;
        let active = true;
        const load = async () => {
            try {
                const { data } = await api.get(`/api/project/${id}/scan`);
                if (active) setState({ key, scans: newestFirst(data) });
            } catch (e) {
                if (active) setState({ key, error: e.response?.data?.error || "Could not load scan history. Please try again." });
            }
        };
        load();
        return () => { active = false; };
    }, [id, key, status]);

    if (status === "guest") return <LoginRequired title="History needs an account" message="Log in to view your project's scans." />;
    const current = status === "authenticated" && state?.key === key ? state : null;
    const numbers = scanNumbers(current?.scans || []);
    return (
        <div className="min-w-0 space-y-6 pb-20 [overflow-wrap:anywhere]">
            <Link href="/project" className="text-accent hover:underline">Back to projects</Link>
            <header>
                <h1 className="text-3xl font-semibold text-ink">Project scan history</h1>
                <p className="mt-2 text-muted">Newest scans first. Scores use today&apos;s scoring rules, including for older scans.</p>
                <p className="mt-1 text-sm text-muted">A saved scan can reuse earlier results. Capture dates below show when each source was checked.</p>
            </header>
            {!current ? <p role="status">Loading scan history...</p> : current.error ? (
                <div><p role="alert" className="text-critical">{current.error}</p><button type="button" onClick={() => setAttempt(n => n + 1)} className="mt-2 min-h-11 cursor-pointer text-accent underline">Try again</button></div>
            ) : current.scans.length === 0 ? <p>No scans yet. Project owners can run the first scan from Projects.</p> : (
                <ul className="space-y-4">
                    {current.scans.map((scan, index, scans) => {
                        const second = scans.find(other => other.id !== scan.id && sameTargets(scan, other));
                        const label = `Scan #${numbers.get(scan.id)}`;
                        const comparisonQuery = new URLSearchParams({ first: scan.id, fromHistory: scan.id });
                        if (second) comparisonQuery.set("against", second.id);
                        return (
                            <ScanEntrance as="li" key={scan.id} delay={index * 0.06} className="min-w-0 space-y-3 rounded-2xl border border-line bg-surface p-5">
                                <div className="flex items-center gap-3">
                                    <GradeBadge grade={scan.grade} size="sm" />
                                    <div><h2 className="font-semibold">{label}</h2><p className="text-sm text-muted">Saved: {scanDate(scan.created_at)}</p><p>{scan.score ?? "Unknown"}/100 · {scan.grade ? `Grade ${scan.grade}` : "Incomplete"}</p></div>
                                </div>
                                <p className="break-all text-sm text-muted">Website: {scan.domain ?? "None"} · Repository: {scan.github_repo ?? "None"}</p>
                                <ScanCaptureDates domain={scan.domain} githubRepo={scan.github_repo} domainCapturedAt={scan.domain_captured_at} repoCapturedAt={scan.repo_captured_at} />
                                <div className="flex flex-wrap gap-4 text-sm font-semibold text-accent">
                                    <Link href={`/scan/${scan.id}`} aria-label={`View ${label}`} className="inline-flex min-h-11 max-w-full items-center rounded-md hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">View scan</Link>
                                    <Link href={`/scan/${scan.id}/compare?${comparisonQuery}`} aria-label={`Compare scans for ${label}`} className="inline-flex min-h-11 max-w-full items-center rounded-md hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">Compare scans</Link>
                                </div>
                            </ScanEntrance>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}
