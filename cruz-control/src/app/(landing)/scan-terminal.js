import { AnimatedSpan, Terminal, TypingAnimation } from "@/components/terminal";

export default function ScanTerminal({ theme }) {
  return (
    <Terminal className="scan-terminal" theme={theme}>
      <TypingAnimation className="terminal-command">$ cruz scan my-website.com</TypingAnimation>
      <AnimatedSpan className="terminal-mode">
        <span>SCANNING...</span>
      </AnimatedSpan>
      <AnimatedSpan className="terminal-result terminal-result-good">
        <span className="terminal-result-mark">✓</span><span>DNS · A, AAAA, MX, NS records mapped</span>
      </AnimatedSpan>
      <AnimatedSpan className="terminal-result terminal-result-good">
        <span className="terminal-result-mark">✓</span><span>Subdomains · 8 public hosts discovered</span>
      </AnimatedSpan>
      <AnimatedSpan className="terminal-result terminal-result-good">
        <span className="terminal-result-mark">✓</span><span>Network · 2 IPs · ports 80, 443, 22</span>
      </AnimatedSpan>
      <AnimatedSpan className="terminal-result terminal-result-good">
        <span className="terminal-result-mark">✓</span><span>IP locations · Singapore, Frankfurt</span>
      </AnimatedSpan>
      <AnimatedSpan className="terminal-result terminal-result-good">
        <span className="terminal-result-mark">✓</span><span>TLS · certificate active, TLS 1.3</span>
      </AnimatedSpan>
      <AnimatedSpan className="terminal-result terminal-result-note">
        <span className="terminal-result-mark">!</span><span>Headers · Content-Security-Policy missing</span>
      </AnimatedSpan>
      <AnimatedSpan className="terminal-result terminal-result-good">
        <span className="terminal-result-mark">✓</span><span>Network graph · 10 relationships mapped</span>
      </AnimatedSpan>
      <AnimatedSpan className="terminal-mode terminal-summary">
        <span>SUMMARY</span><span>1 item to review</span>
      </AnimatedSpan>
      <AnimatedSpan className="terminal-explanation">
        <span className="terminal-result-mark">→</span>
        <span>Add a Content-Security-Policy to control which sources can load on your site.</span>
      </AnimatedSpan>
    </Terminal>
  );
}
