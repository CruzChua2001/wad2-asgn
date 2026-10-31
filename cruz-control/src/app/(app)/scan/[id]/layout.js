"use client";

import Link from "next/link";
import { usePathname, useRouter, useParams } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { useEffect } from "react";
import { LuBookmarkCheck, LuBookmarkPlus, LuPlus, LuRefreshCw } from "react-icons/lu";

import RippleButton from "@/components/ripple-button";
import { useAuth } from "@/components/auth/auth-provider";
import { useScan } from "../scan-context";
import LoadingOverlay from "@/components/loading-overlay";
import SaveProjectInfo from "./save-project-info";
import styles from "@/styles/overview/scan-results.module.css";

const RESULT_TABS = [
  { href: "", label: "Overview", showsCount: true },
  { href: "/fix-guide", label: "Fix Guide" },
  { href: "/checklist", label: "Checklist" },
  { href: "/report-card", label: "Report Card" },
  { href: "/compare", label: "Compare" },
];

// Header buttons: New scan is the main action, the rest are outlined
const ACTION = "inline-flex min-h-11 max-w-full cursor-pointer items-center justify-center gap-2 rounded-md border px-4 text-center text-xs! font-semibold! whitespace-normal no-underline transition max-md:flex-auto max-sm:px-3";
const PRIMARY = `${ACTION} border-accent bg-accent text-page! hover:-translate-y-px hover:bg-accent-bright [&_.ripple-content]:inline-flex [&_.ripple-content]:items-center [&_.ripple-content]:gap-2`;
const SECONDARY = `${ACTION} border-line bg-surface-strong text-ink! hover:border-accent hover:text-accent! disabled:cursor-default disabled:opacity-60`;

function ResultTabs({ hasRepository, findingsCount }) {
  const pathname = usePathname();
  const { id } = useParams();
  const reduceMotion = useReducedMotion();
  const tabs = RESULT_TABS.filter((tab) => !tab.requiresRepository || hasRepository);
  return (
    <nav className={styles.tabs} aria-label="Scan result sections">
      {tabs.map((tab) => {
        const href = `/scan/${id}${tab.href}`;
        const active = href === pathname;
        return (
          <Link key={href} href={href} className={`${active ? styles.tabActive : ""} focus-visible:-outline-offset-2!`} aria-current={active ? "page" : undefined}>
            {/* One pill that slides to the active tab */}
            {active && (
              <motion.span
                layoutId="result-tab-pill"
                className="absolute -inset-px rounded-md border border-accent/25 bg-surface-strong shadow-sm"
                transition={reduceMotion ? { duration: 0 } : { type: "spring", bounce: 0.2, duration: 0.45 }}
                aria-hidden="true"
              />
            )}
            <span className="relative">{tab.label}</span>
            {tab.showsCount && <span className={`${styles.tabCount} relative`}>{findingsCount}<span className="sr-only">{findingsCount === 1 ? " finding" : " findings"}</span></span>}
          </Link>
        )
      })}
    </nav>
  );
}

export default function ScanResultsLayout({ children }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const { id } = useParams();
  const { result, loadResult, resetScan, startScan, saveToProject, savedScanId, saving, saveError } = useScan();
  const { status } = useAuth();

  // Loads again after logging in or out, since project scans are only shown to members
  useEffect(() => {
    if (status !== "loading") loadResult(id);
  }, [id, status, loadResult]);

  if (!result) return (
    <LoadingOverlay show />
  );

  if (result.error) return <p role="alert" className="min-w-0 text-critical [overflow-wrap:anywhere]">{result.error}</p>;

  function newScan() {
    router.push("/scan");
    resetScan();
  }

  const rescan = _ => {
    startScan({ domain: result.domain, githubRepo: result.linkedRepository, projectId: result.projectId, force: true });
    router.push("/scan");
  }

  // Re-scan is hidden on a brand-new scan, unless a lookup failed and the page says to re-scan
  const canRetry = result.incomplete || result.breakdown?.some((item) => item.status === "unavailable");

  const reveal = (delay = 0) => (reduceMotion
    ? {}
    : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] } });

  return (
    <>
      <LoadingOverlay show={false} />
      <motion.div
        className={styles.results}
        initial={reduceMotion ? false : { opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.header className={styles.resultsHead} {...reveal(0)}>
          <div className="min-w-0 md:flex-1 md:basis-64 wrap-anywhere">
            <h1>{result.title}</h1>
            <p className={styles.meta}>
              Scanned {result.scannedAgo} · Public sources
              {result.domain && result.linkedRepository && <> · Linked to {result.linkedRepository}</>}
            </p>

            {saveError && <p role="alert" className="text-critical text-sm">{saveError}</p>}
          </div>

          <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
            {!result.projectId && (
              savedScanId === id
              ? <Link href="/project" className={SECONDARY}><LuBookmarkCheck aria-hidden="true" /> Saved · View project</Link>
              : <div className="inline-flex min-w-0 max-w-full flex-wrap items-center gap-1">
                <button type="button" className={SECONDARY} onClick={() => saveToProject(id)} disabled={saving}>
                  <LuBookmarkPlus aria-hidden="true" /> {saving ? "Saving..." : "Save to project"}
                </button>
                <SaveProjectInfo />
              </div>
            )}

            {(result.scannedAgo !== "just now" || canRetry) && (!result.projectId || result.role === "owner") && (
              <button type="button" className={SECONDARY} onClick={rescan}><LuRefreshCw aria-hidden="true" /> Re-scan</button>
            )}

            <RippleButton className={PRIMARY} type="button" onClick={newScan}><LuPlus aria-hidden="true" /> New scan</RippleButton>
          </div>
        </motion.header>

        <motion.div {...reveal(0.04)}>
          <ResultTabs hasRepository={Boolean(result.linkedRepository)} findingsCount={result.findings.length} />
        </motion.div>

        {children}
      </motion.div>
    </>
  );
}
