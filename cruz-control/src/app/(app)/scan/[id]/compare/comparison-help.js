"use client";

import { useId, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { LuChevronDown, LuCircleHelp } from "react-icons/lu";

export default function ComparisonHelp() {
    const [open, setOpen] = useState(false);
    const panelId = useId();
    const reducedMotion = useReducedMotion();
    return (
        <>
            <button type="button" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(value => !value)} className="inline-flex min-h-11 w-fit max-w-full cursor-pointer items-center gap-2 self-center justify-self-start rounded-lg px-2 py-2 text-left text-sm! font-medium! text-accent underline decoration-accent/40 underline-offset-4 hover:bg-accent-soft/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent md:justify-self-end">
                <LuCircleHelp aria-hidden="true" className="size-4 shrink-0" />How comparison works<LuChevronDown aria-hidden="true" className={`size-4 shrink-0 transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
            </button>
            <motion.div id={panelId} role="region" aria-label="How comparison works explanation" aria-hidden={!open} inert={!open} className="col-span-full min-w-0 overflow-hidden" initial={false} animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }} transition={{ duration: reducedMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}>
                <div className="pt-3">
                    <div className="max-w-3xl rounded-xl border border-line bg-page/60 p-4 md:ml-auto sm:p-5">
                        <p className="text-ink">Choose two saved scans of the same website and repository to see what changed.</p>
                        <ul className="mt-3 list-disc space-y-2 pl-5">
                            <li>Choose an older result for Before and a newer result for After. Changes are measured from Before to After.</li>
                            <li>A higher score means less detected exposure. Older scores are calculated using the current scoring rules.</li>
                            <li>Findings are grouped by what is newly detected, no longer detected, still present, or cannot be verified. Changes in severity, servers or technical details are highlighted.</li>
                            <li>We only confirm a finding appeared or disappeared when its check completed successfully in both scans. Otherwise, the change is marked &ldquo;Cannot verify change&rdquo;.</li>
                            <li>Saved scans may reuse cached results. Capture dates show when each source was checked. &ldquo;No longer detected&rdquo; does not prove a fix.</li>
                        </ul>
                    </div>
                </div>
            </motion.div>
        </>
    );
}
