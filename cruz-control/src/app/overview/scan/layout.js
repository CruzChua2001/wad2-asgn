"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { useEffect } from "react";
import RippleButton from "@/components/ripple-button";
import { useScan } from "../scan-context";
import styles from "@/styles/overview/scan-results.module.css";

// Secondary navbar for completed scan. Each tab is its own page under /overview/scan.
const RESULT_TABS = [
  { href: "/overview/scan", label: "Vulnerabilities", showsCount: true },
  { href: "/overview/scan/repository", label: "Repository", requiresRepository: true },
  { href: "/overview/scan/fix-guide", label: "Fix Guide" },
  { href: "/overview/scan/checklist", label: "Checklist" },
  { href: "/overview/scan/report-card", label: "Report Card" },
  { href: "/overview/scan/compare", label: "Compare" },
];

function ResultTabs({ hasRepository, findingsCount }) {
  const pathname = usePathname();
  const tabs = RESULT_TABS.filter((tab) => !tab.requiresRepository || hasRepository);
  return (
    <nav className={styles.tabs} aria-label="Scan result sections">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={tab.href === pathname ? styles.tabActive : ""}
          aria-current={tab.href === pathname ? "page" : undefined}
        >
          {tab.label}
          {tab.showsCount && <span className={styles.tabCount}>{findingsCount}</span>}
        </Link>
      ))}
    </nav>
  );
}

export default function ScanResultsLayout({ children }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const { phase, scan, resetScan } = useScan();
  const ready = phase === "results" && scan;

  // The scan only lives in memory for now, so a refresh or direct link has nothing to show.
  useEffect(() => {
    if (!ready) router.replace("/overview");
  }, [ready, router]);

  if (!ready) return null;
  const { result } = scan;

  function newScan() {
    router.push("/overview");
    resetScan();
  }

  const reveal = (delay = 0) => (reduceMotion
    ? {}
    : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] } });

  return (
    <div className={styles.results}>
      <motion.header className={styles.resultsHead} {...reveal(0)}>
        <div>
          <h1>{result.domain}</h1>
          <p className={styles.meta}>
            Scanned just now · {result.sample ? "Sample data" : "Public sources"}
            {result.linkedRepository && <> · Linked to {result.linkedRepository.replace("github.com/", "")}</>}
          </p>
        </div>
        <RippleButton className={styles.newScan} type="button" onClick={newScan}>+ New scan</RippleButton>
      </motion.header>

      <motion.div {...reveal(0.04)}>
        <ResultTabs hasRepository={Boolean(result.linkedRepository)} findingsCount={result.findings.length} />
      </motion.div>

      {result.sample && (
        <motion.p className={styles.sampleNotice} role="note" {...reveal(0.07)}>
          <strong>Placeholder results</strong>
          <span>The scanning backend isn&apos;t connected yet. Every value on this page is sample data for layout review, not real findings about {result.domain}.</span>
        </motion.p>
      )}

      {children}
    </div>
  );
}
