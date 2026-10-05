"use client";

import { useEffect, useRef } from "react";
import { AnimatedSpan, Terminal } from "./terminal";

const MARKS = { command: "", info: "›", ok: "✓", warn: "!", bad: "✕", summary: "■" };

// Only rendered while a scan is in progress; the results view replays the log separately.
export default function LiveScanTerminal({ lines, theme, domain, sample = true }) {
  const bodyRef = useRef(null);

  // Keep the newest line in view as output streams in.
  useEffect(() => {
    const body = bodyRef.current;
    if (body) body.scrollTop = body.scrollHeight;
  }, [lines.length]);

  return (
    <Terminal
      className="live-scan-terminal"
      theme={theme}
      sequence={false}
      startOnView={false}
      title="CRUZ CONTROL"
      status="RUNNING"
      label={`Scan output for ${domain}${sample ? " (sample data)" : ""}`}
      live
      bodyRef={bodyRef}
      bodyClassName="live-terminal-body"
    >
      {lines.map((line) => (
        <AnimatedSpan key={line.id} className={`live-line live-line-${line.kind}`}>
          <span className="live-time">{line.time}</span>
          <span className="live-mark" aria-hidden="true">{MARKS[line.kind]}</span>
          <span className="live-text">{line.text}</span>
        </AnimatedSpan>
      ))}
      <AnimatedSpan className="live-line live-line-cursor">
        <span className="live-time" aria-hidden="true" />
        <span className="live-mark" aria-hidden="true" />
        <span className="live-cursor" aria-hidden="true" />
      </AnimatedSpan>
    </Terminal>
  );
}
