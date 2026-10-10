"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

import RippleButton from "@/components/ripple-button";
import { useScan } from "../scan-context";
import { useAuth } from "@/components/auth/auth-provider";
import api from "@/lib/api";
import styles from "@/styles/overview/scan-results.module.css";

const RESULT_TABS = [
  { href: "/scan/results", label: "Vulnerabilities", showsCount: true },
  { href: "/scan/results/repository", label: "Repository", requiresRepository: true },
  { href: "/scan/results/fix-guide", label: "Fix Guide" },
  { href: "/scan/results/checklist", label: "Checklist" },
  { href: "/scan/results/report-card", label: "Report Card" },
  { href: "/scan/results/compare", label: "Compare" },
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
  const { status, openAuth } = useAuth();
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  // The scan only lives in memory for now, so a refresh or direct link has nothing to show.
  useEffect(() => {
    if (!ready) router.replace("/scan");
  }, [ready, router]);

  if (!ready) return null;
  const { result } = scan;

  function newScan() {
    router.push("/scan");
    resetScan();
  }

  const saveToProject = async _ => {
    if (status !== "authenticated") return openAuth("login");
    setSaveError("");

    try {
      let data = {
        name: result.domain,
        domain: result.domain,
        githubRepo: result.linkedRepository?.replace("github.com/", "")
      }

      await api.post("/api/project", data);
      setSaved(true);
    } catch (e) {
      setSaveError(e.response?.data?.error ?? "Could not save to project.");
    }
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

          {saveError && <p role="alert" className="text-critical text-sm">{saveError}</p>}
        </div>

        <div className="flex items-center gap-2">
          {saved 
            ? <Link href="/project" className={styles.newScan}>Saved · View project</Link>
            : <button className={styles.newScan} onClick={saveToProject}>Save to project</button>}
          <RippleButton className={styles.newScan} type="button" onClick={newScan}>+ New scan</RippleButton>
        </div>
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
