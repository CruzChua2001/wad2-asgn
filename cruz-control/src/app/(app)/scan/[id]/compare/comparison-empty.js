"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { useScan } from "../../scan-context";

export default function ComparisonEmpty({ projectId, role, total, missingTargets }) {
    const { startScan } = useScan();
    const router = useRouter();
    const startingRef = useRef(false);
    const [starting, setStarting] = useState(false);
    const [error, setError] = useState("");
    const owner = role === "owner";
    const single = total === 1;
    const title = missingTargets ? "We need more scan information" : single ? (owner ? "Ready for your next scan?" : "One scan so far") : "No matching scan yet";
    let message;
    if (missingTargets) {
        message = "This scan is missing website or repository information, so we can't safely match it to another scan.";
    } else if (single) {
        message = owner ? "You have one scan for this project. Re-scan it to see what's changed."
            : "You have one scan for this project. Ask a project owner to run another scan so you can compare the results.";
    } else {
        message = `This project has ${total} saved scans, but none of the others can be compared with this one.`;
    }

    const rescan = async () => {
        if (!owner || startingRef.current) return;
        startingRef.current = true;
        setStarting(true);
        setError("");
        try {
            // Use current project settings, just like Re-scan on its project card.
            // An older scan may have different targets after a project was edited.
            const { data } = await api.get("/api/project");
            const project = data.find(item => item.id === projectId);
            if (!project || project.role !== "owner") {
                setError("Only a current project owner can re-scan this project.");
                return;
            }
            const scanning = startScan({ domain: project.domain, githubRepo: project.github_repo, projectId: project.id, force: true });
            router.push("/scan");
            await scanning;
        } catch (e) {
            setError(e.response?.data?.error || "Could not start the project scan. Please try again.");
        } finally {
            startingRef.current = false;
            setStarting(false);
        }
    };

    return (
        <section className="min-w-0 space-y-4 rounded-2xl border border-line bg-surface p-5" aria-labelledby="compare-empty-title">
            <h3 id="compare-empty-title" className="text-xl font-semibold text-ink">{title}</h3>
            <p className="text-ink">{message}</p>
            {(!single || missingTargets) && <p className="text-sm text-muted">Comparisons need the same website and repository. New scans use the project&apos;s current settings; choose matching scans from its history.{!owner && " Ask a project owner if another scan is needed."}</p>}
            <div className="flex flex-wrap items-center gap-3 text-sm font-semibold">
                {owner && <button type="button" onClick={rescan} disabled={starting} className="min-h-11 max-w-full cursor-pointer rounded-lg border border-accent bg-accent px-4 text-page hover:bg-accent-bright focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default disabled:opacity-60">{starting ? "Starting scan..." : "Re-scan project"}</button>}
                <Link href={`/project/${projectId}/history`} className="inline-flex min-h-11 max-w-full items-center rounded-lg px-2 py-2 text-accent underline hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">View history</Link>
                <Link href="/project" className="inline-flex min-h-11 max-w-full items-center rounded-lg px-2 py-2 text-accent underline hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">Back to projects</Link>
            </div>
            {error && <p role="alert" className="text-critical">{error}</p>}
        </section>
    );
}
