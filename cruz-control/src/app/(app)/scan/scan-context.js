"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useState, useRef } from "react";
import api from "@/lib/api";
import { createClient } from "@/lib/client";
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
  const abortRef = useRef(null);

  const startScan = useCallback(async ({domain, githubRepo, projectId, force}) => {
    const addLine = (kind, text) => {
      setLines((current) => [...current, { id:current.length, kind, text, time: formatLogTime(new Date()) }]);
    }

    // Resets the terminal and switch page to the terminal view
    setLines([]);
    setProgress(0);
    setScan({ domain, githubRepo });
    setPhase("scanning");
    addLine("command", `$ cruz scan ${[domain, githubRepo].filter(Boolean).join(" ")}`);

    const expected = (domain ? 5 : 0) + (githubRepo ? 3 : 0); // domain modules + repo modules
    let completed = 0;

    // Cancel switch for the request
    abortRef.current = new AbortController();

    try {
      const supabase = createClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/scan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ domain, githubRepo, projectId, force }),
        signal: abortRef.current.signal,
      });

      // Check for pre-stream failures (bad input, auth, permissions)
      if (!response.ok) {
        let message = "Scan failed. Please try again.";
        try {
          const body = await response.json();
          message = body.error ?? message;
        } catch (_) { /* non-JSON body */ }
        addLine("bad", message);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const handleEvent = (event) => {
        if (event.type === "event") {
          addLine(event.kind, event.text);
          if (event.kind === "ok" || event.kind === "warn") {
            completed += 1;
            setProgress(expected > 0 ? Math.min(90, Math.round((completed / expected) * 100)) : 90);
          }
        } else if (event.type === "done") {
          addLine("summary", "Done. Opening your results now...");
          setProgress(100);
          setScan({ domain, githubRepo, id: event.id });
          setPhase("results");
          router.push(`/scan/${event.id}`);
        } else if (event.type === "error") {
          addLine("bad", event.message ?? "Scan failed. Please try again.");
        }
      };

      // Read NDJSON per line
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n");
        buffer = parts.pop();

        for (const line of parts) {
          if (!line.trim()) continue;
          try {
            handleEvent(JSON.parse(line));
          } catch (error) {

          }
        }
      }

      // Flush any trailing complete line left in the buffer
      if (buffer.trim()) {
        try {
          handleEvent(JSON.parse(buffer));
        }        
        catch (error) {
          
        }
      }
    } catch (error) {
      if (e.name === "AbortError") return; // user cancelled, terminal was reset
      addLine("bad", "Scan failed. Please try again.");
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