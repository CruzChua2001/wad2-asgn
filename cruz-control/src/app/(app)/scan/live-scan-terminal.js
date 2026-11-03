"use client";

import { useEffect, useRef } from "react";
import { AnimatedSpan, Terminal } from "@/components/terminal";

const MARKS = { command: "", info: "›", ok: "✓", warn: "!", bad: "✕", summary: "■" };
const ROW_LAYOUT = "text-sm! leading-relaxed! grid-cols-[1rem_minmax(0,1fr)]! sm:grid-cols-[6.5rem_1rem_minmax(0,1fr)]!";

// The streamed log is also retained while showing a failed or completed scan.
export default function LiveScanTerminal({ lines, theme, domain, status = "RUNNING" }) {
  const bodyRef = useRef(null);

  // Keep the newest line in view as output streams in.
  useEffect(() => {
    const body = bodyRef.current;
    if (body) body.scrollTop = body.scrollHeight;
  }, [lines.length]);

  return (
    <Terminal
      className="live-scan-terminal min-w-0 max-w-full [&_.terminal-titlebar]:flex-wrap [&_.terminal-titlebar]:py-3!"
      theme={theme}
      sequence={false}
      startOnView={false}
      title="CRUZ CONTROL"
      status={status}
      label={`Scan output for ${domain}`}
      live
      bodyRef={bodyRef}
      bodyClassName="live-terminal-body h-[clamp(12rem,42dvh,24rem)]! px-3! text-sm! font-[family-name:var(--font-geist-sans)]! leading-relaxed! sm:px-5!"
    >
      {lines.map((line) => (
        <AnimatedSpan key={line.id} className={`live-line live-line-${line.kind} ${ROW_LAYOUT}`}>
          <span className="live-time font-[family-name:var(--font-geist-mono)] text-xs!">{line.time}</span>
          <span className="live-mark" aria-hidden="true">{MARKS[line.kind]}</span>
          <span className={`live-text min-w-0 ${line.kind === "command" ? "font-[family-name:var(--font-geist-mono)]" : ""}`}>{line.text}</span>
        </AnimatedSpan>
      ))}
      <AnimatedSpan className={`live-line live-line-cursor ${ROW_LAYOUT}`}>
        <span className="live-time" aria-hidden="true" />
        <span className="live-mark" aria-hidden="true" />
        <span className="live-cursor" aria-hidden="true" />
      </AnimatedSpan>
    </Terminal>
  );
}
