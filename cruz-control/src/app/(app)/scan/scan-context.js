"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useState, useRef } from "react";
import { DOMAIN_STEPS } from "./scan-steps";
import api from "@/lib/api";
import { buildPlaceholderResult } from "@/lib/placeholder-scan";

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

  const startScan = useCallback(async (domain, { linkedRepository }) => {
    const addLine = (kind, text) => {
      setLines((current) => [...current, { id:current.length, kind, text, time: formatLogTime(new Date()) }]);
    }

    // Resets the terminal
    // Switch page to the terminal view
    setLines([]);
    setProgress(0);
    setScan({ domain, linkedRepository });
    setPhase("scanning");
    addLine("command", `$ cruz scan ${domain}`);

    // Fake progress
    // Every 2 seconds, prints the hardcoded line
    let step = 0;

    timerRef.current = setInterval(() => {
      if (step < DOMAIN_STEPS.length) {
        addLine("info", DOMAIN_STEPS[step]);
        step++;
      }
      setProgress((current) => Math.min(current+8, 90));
    }, 2000);

    // Cancel switch for the request
    abortRef.current = new AbortController();

    try {
      const { data } = await api.post("/api/scan", { domain }, { signal: abortRef.current.signal });
      clearInterval(timerRef.current);
      addLine("summary", "Done. Opening your results now...");
      setProgress(100);
      setScan({ domain, linkedRepository, id: data.id });
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

      setResult(buildPlaceholderResult(data.domain_scans.domain));
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
