"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { buildPlaceholderResult, buildPlaceholderScript } from "@/lib/placeholder-scan";

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

  // Stream the PLACEHOLDER scan script into the terminal, then open the results tabs.
  useEffect(() => {
    if (phase !== "scanning" || !scan) return undefined;
    const timers = [];
    let elapsed = 0;
    scan.script.forEach((step, index) => {
      elapsed += scan.fast ? 70 : step.delay;
      timers.push(setTimeout(() => {
        setLines((current) => [...current, { ...step, id: index, time: formatLogTime(new Date()) }]);
      }, elapsed));
    });
    timers.push(setTimeout(() => {
      setPhase("results");
      router.push("/scan/results");
    }, elapsed + (scan.fast ? 350 : 1200)));
    return () => timers.forEach(clearTimeout);
  }, [phase, scan, router]);

  const startScan = useCallback((domain, { linkedRepository, fast }) => {
    setLines([]);
    setScan({
      domain,
      fast,
      script: buildPlaceholderScript(domain, { linkedRepository }),
      result: buildPlaceholderResult(domain, { linkedRepository }),
    });
    setPhase("scanning");
  }, []);

  // Used by "Cancel scan" and "+ New scan": back to the empty pre-scan form.
  const resetScan = useCallback(() => {
    setPhase("idle");
    setLines([]);
    setScan(null);
  }, []);

  const value = useMemo(
    () => ({ phase, scan, lines, startScan, resetScan }),
    [phase, scan, lines, startScan, resetScan],
  );

  return <ScanContext value={value}>{children}</ScanContext>;
}

export function useScan() {
  const context = useContext(ScanContext);
  if (!context) throw new Error("useScan must be used inside the /scan layout.");
  return context;
}
