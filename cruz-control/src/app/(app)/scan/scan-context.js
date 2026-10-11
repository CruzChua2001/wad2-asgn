"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useState, useRef } from "react";
import { DOMAIN_STEPS, REPO_STEPS } from "./scan-steps";
import api from "@/lib/api";
import { toResult } from "./scan-result";

const ScanContext = createContext(null);

function formatLogTime(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `[${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}]`;
}

export function ScanProvider({ children }) {
  const router = useRouter();
  const [phase, setPhase] = useState("idle");
  const [scan, setScan] = useState(null);
  const [lines, setLines] = useState([]);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const timerRef = useRef(null);
  const abortRef = useRef(null);

  const startScan = useCallback(async ({domain, githubRepo, projectId}) => {
    const addLine = (kind, text) => {
      setLines((current) => [...current, { id:current.length, kind, text, time: formatLogTime(new Date()) }]);
    }

    // Resets the terminal
    // Switch page to the terminal view
    setLines([]);
    setProgress(0);
    setScan({ domain, githubRepo });
    setPhase("scanning");
    addLine("command", `$ cruz scan ${[domain, githubRepo].filter(Boolean).join(" ")}`);

    // Fake progress
    // Every 2 seconds, prints the hardcoded line
    const steps = [...(domain ? DOMAIN_STEPS : []), ...(githubRepo ? REPO_STEPS : [])];
    let step = 0;

    timerRef.current = setInterval(() => {
      if (step < steps.length) {
        addLine("info", steps[step]);
        step++;
      }

      setProgress((current) => Math.min(current+8, 90));
    }, 2000);

    // Cancel switch for the request
    abortRef.current = new AbortController();

    try {
      const { data } = await api.post("/api/scan", { domain, githubRepo, projectId }, { signal: abortRef.current.signal });
      clearInterval(timerRef.current);
      addLine("summary", "Done. Opening your results now...");
      setProgress(100);
      setScan({ domain, githubRepo, id: data.id });
      setPhase("results");

      router.push(`/scan/${data.id}`);
    } catch (e) {
      clearInterval(timerRef.current);
      if (e.code === "ERR_CANCELED") return;
      addLine("bad", e.response?.data?.error ?? "Scan failed. Please try again.");
    }
  }, [router])

  const loadResult = useCallback(async (id) => {
    setResult(null);

    try {
      const { data } = await api.get(`/api/scan/${id}`);

      setResult(toResult(data));
    } catch (e) {
      setResult({ error: e.response?.data?.error ?? "Could not load this scan." });
    }
  }, []);

  // Used by "Cancel scan" and "+ New scan": back to the empty pre-scan form.
  const resetScan = useCallback(() => {
    setPhase("idle");
    setLines([]);
    setScan(null);
    clearInterval(timerRef.current);
    abortRef.current?.abort();
  }, []);

  const value = useMemo(
    () => ({ phase, scan, lines, progress, startScan, resetScan, result, loadResult }),
    [phase, scan, lines, progress, startScan, resetScan, result, loadResult],
  );

  return <ScanContext value={value}>{children}</ScanContext>;
}

export function useScan() {
  const context = useContext(ScanContext);
  if (!context) throw new Error("useScan must be used inside the /scan layout.");
  return context;
}
