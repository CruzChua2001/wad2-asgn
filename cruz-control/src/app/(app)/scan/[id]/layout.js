"use client";

import Link from "next/link";
import { usePathname, useRouter, useParams } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

import RippleButton from "@/components/ripple-button";
import { useScan } from "../scan-context";
import { useAuth } from "@/components/auth/auth-provider";
import api from "@/lib/api";
import styles from "@/styles/overview/scan-results.module.css";

const RESULT_TABS = [
  { href: "", label: "Overview", showsCount: true },
  { href: "/repository", label: "Repository", requiresRepository: true },
  { href: "/fix-guide", label: "Fix Guide" },
  { href: "/checklist", label: "Checklist" },
  { href: "/report-card", label: "Report Card" },
  { href: "/compare", label: "Compare" },
];

function ResultTabs({ hasRepository, findingsCount }) {
  const pathname = usePathname();
  const { id } = useParams();
  const tabs = RESULT_TABS.filter((tab) => !tab.requiresRepository || hasRepository);
  return (
    <nav className={styles.tabs} aria-label="Scan result sections">
      {tabs.map((tab) => {
        const href = `/scan/${id}${tab.href}`;
        return (
          <Link key={href} href={href} className={href === pathname ? styles.tabActive : ""} aria-current={href === pathname ? "page" : undefined}>
            {tab.label}
            {tab.showsCount && <span className={styles.tabCount}>{findingsCount}</span>}
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
  const { result, loadResult, resetScan } = useScan();
  const { status, openAuth } = useAuth();
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    loadResult(id);
  }, [id, loadResult]);

  if (!result) return <p className="text-muted">Loading scan...</p>;

  if (result.error) return <p role="alert" className="text-critical">{result.error}</p>;

  function newScan() {
    router.push("/scan");
    resetScan();
  }

  const saveToProject = async _ => {
    if (status !== "authenticated") return openAuth("login");
    setSaveError("");

    try {
      let data = {
        name: result.title,
        domain: result.domain,
        githubRepo: result.linkedRepository
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
          <h1>{result.title}</h1>
          <p className={styles.meta}>
            Scanned just now · Public sources
            {result.domain && result.linkedRepository && <> · Linked to {result.linkedRepository}</>}
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

      {children}
    </div>
  );
}
