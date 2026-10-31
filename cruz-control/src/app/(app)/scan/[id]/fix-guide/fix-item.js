"use client";

import { useState } from "react";
import { LuChevronDown, LuCheck, LuExternalLink, LuSparkles } from "react-icons/lu";
import api from "@/lib/api";
import { useAuth } from "@/components/auth/auth-provider";
import SmallLoader from "@/components/small-loader";

const SEVERITY_STYLE = {
    critical: { label: "Critical", chip: "bg-red-500/10 text-red-600 dark:text-red-400", bar: "bg-red-500" },
    high: { label: "High", chip: "bg-orange-500/10 text-orange-600 dark:text-orange-400", bar: "bg-orange-500" },
    medium: { label: "Medium", chip: "bg-amber-500/10 text-amber-600 dark:text-amber-400", bar: "bg-amber-500" },
    low: { label: "Low", chip: "bg-sky-500/10 text-sky-600 dark:text-sky-400", bar: "bg-sky-500" },
};
const FALLBACK_STYLE = { label: "Tip", chip: "bg-accent-soft text-accent", bar: "bg-accent" };

const styleFor = severity => SEVERITY_STYLE[severity] || FALLBACK_STYLE;

export default function FixItem({ scanId, finding, done, open, onToggleDone, onToggleOpen }) {
    const { status, openAuth } = useAuth();
    const [guide, setGuide] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const style = styleFor(finding.severity);
    const href = typeof finding.learnMore === "string" ? finding.learnMore : finding.learnMore?.url;
    const panelId = `fix-panel-${finding.id}`;

    const askAi = async () => {
        if (status !== "authenticated") {
            openAuth("login");
            return;
        }
        setLoading(true);
        setError("");
        try {
            const res = await api.post(`/api/scan/${scanId}/finding/${finding.id}/guide`);
            setGuide(res.data.guide);
        } catch (e) {
            setError(e.response?.data?.error || "Couldn't create the guide. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <li className={`relative overflow-hidden rounded-xl border border-line bg-surface transition-opacity ${done ? "opacity-60" : ""}`}>
            <span className={`absolute inset-y-0 left-0 w-1 ${style.bar}`} aria-hidden="true" />
            <div className="flex items-center gap-3 py-3 pl-5 pr-3">
                <button
                    type="button"
                    role="checkbox"
                    aria-checked={done}
                    aria-label={`Mark "${finding.title}" as fixed`}
                    onClick={onToggleDone}
                    className={`flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 transition-colors ${
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
                    className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
                >
                    <span className="min-w-0 flex-1 text-sm font-semibold text-ink sm:text-base">
                        <span className={done ? "line-through" : ""}>{finding.title}</span>
                    </span>
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

                    {/* AI step-by-step guide */}
                    <div>
                        {!guide && (
                            <button
                                type="button"
                                onClick={askAi}
                                disabled={loading}
                                className="inline-flex items-center cursor-pointer gap-2 rounded-full border border-line px-3 py-1.5 font-medium text-accent transition-colors hover:bg-accent-soft disabled:cursor-wait disabled:opacity-60"
                            >
                                {loading
                                    ? <SmallLoader text="Writing your guide..." size={16} />
                                    : <><LuSparkles className="h-4 w-4" aria-hidden="true" /> Get step-by-step guide</>}
                            </button>
                        )}
                        {error && (
                            <p role="alert" className="mt-2 text-critical">
                                {error}
                            </p>
                        )}
                        {guide && (
                            <div>
                                <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Step-by-step guide</h4>
                                <p className="whitespace-pre-line rounded-lg border border-line p-3 text-ink">{guide}</p>
                                <p className="mt-1 text-xs text-muted">AI-generated. Double-check before running any commands.</p>
                            </div>
                        )}
                    </div>

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
}