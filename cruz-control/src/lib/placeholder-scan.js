// PLACEHOLDER DATA, TBD: REPLACE WITH APIS WITH ACTUAL RESULTS
export const PLACEHOLDER_NOTICE =
  "THIS IS SAMPLE. No backend logic/API connected yet.";

export function buildPlaceholderScript(domain, { linkedRepository } = {}) {
  const script = [
    { kind: "command", text: `$ cruz scan ${domain}`, delay: 0 },
    { kind: "info", text: "Sample mode · backend not connected · showing placeholder output", delay: 450 },
    { kind: "info", text: "Resolving DNS records…", delay: 650 },
    { kind: "ok", text: "DNS · 3 A records, MX and NS records found", delay: 900 },
    { kind: "info", text: "Searching public certificate logs…", delay: 600 },
    { kind: "ok", text: "Certificates · 3 public hostnames discovered", delay: 1100 },
    { kind: "info", text: "Checking indexed services and known bugs…", delay: 600 },
    { kind: "bad", text: `Services · legacy.${domain} exposes port 21 (FTP)`, delay: 1000 },
    { kind: "info", text: "Locating servers…", delay: 550 },
    { kind: "ok", text: "Locations · Singapore, San Francisco, Frankfurt", delay: 800 },
    { kind: "info", text: "Reviewing security headers…", delay: 550 },
    { kind: "warn", text: "Headers · Content-Security-Policy missing", delay: 850 },
    { kind: "info", text: "Checking email protection…", delay: 500 },
    { kind: "warn", text: "Email · no DMARC record found", delay: 700 },
  ];

  if (linkedRepository) {
    script.splice(2, 0, {
      kind: "info",
      text: `Linked repository ${linkedRepository} noted · repository checks are not part of this preview`,
      delay: 500,
    });
  }

  script.push({ kind: "summary", text: "Done · 4 findings · exposure score 68 / 100 (sample)", delay: 700 });
  return script;
}

export function buildPlaceholderResult(domain, { linkedRepository = null } = {}) {
  const nodes = [
    {
      id: "edge",
      host: domain,
      ip: "203.0.113.10",
      city: "Singapore",
      country: "SG",
      lat: 1.3521,
      lng: 103.8198,
      provider: "Sample CDN edge",
      service: "443 · HTTPS",
      status: "healthy",
      summary: "The main website is served over HTTPS from a content delivery network edge. No exposed services beyond the web server were listed.",
    },
    {
      id: "staging",
      host: `staging.${domain}`,
      ip: "198.51.100.24",
      city: "San Francisco",
      country: "US",
      lat: 37.7749,
      lng: -122.4194,
      provider: "Sample cloud host",
      service: "8080 · HTTP",
      status: "attention",
      summary: "A staging server appears in public certificate logs. Test environments often have weaker settings than the live site.",
    },
    {
      id: "legacy",
      host: `legacy.${domain}`,
      ip: "192.0.2.45",
      city: "Frankfurt",
      country: "DE",
      lat: 50.1109,
      lng: 8.6821,
      provider: "Sample VPS provider",
      service: "21 · FTP",
      status: "critical",
      summary: "An old file-transfer (FTP) service accepts connections from anyone on the internet. FTP sends passwords without encryption.",
    },
  ];

  const findings = [
    {
      id: "ftp",
      severity: "critical",
      title: "Old file-transfer service is public",
      nodeId: "legacy",
      source: "Indexed services",
      why: "Anyone can try to log in, and FTP sends usernames and passwords in plain text.",
      fix: "Turn off the FTP service and use SFTP (file transfer over SSH) instead. Then close port 21 in your firewall.",
    },
    {
      id: "staging",
      severity: "medium",
      title: "Staging server is publicly listed",
      nodeId: "staging",
      source: "Certificate logs",
      why: "Test servers are easy to forget and often run with debug settings or weak passwords.",
      fix: "Put the staging site behind a login or VPN, or shut it down if it is no longer needed.",
    },
    {
      id: "csp",
      severity: "medium",
      title: "Content-Security-Policy is missing",
      nodeId: "edge",
      source: "Security headers",
      why: "Without this header, the browser can't block injected scripts from running on your pages.",
      fix: "Add a Content-Security-Policy header that only allows scripts from sources you trust.",
    },
    {
      id: "dmarc",
      severity: "low",
      title: "Email spoofing isn't blocked (no DMARC)",
      nodeId: "edge",
      source: "DNS records",
      why: "Scammers can send email that appears to come from your domain.",
      fix: "Publish a DMARC record, starting with p=none to monitor, then tighten it to p=quarantine.",
    },
  ];

  return {
    domain,
    linkedRepository,
    sample: true,
    score: 68,
    rating: "Moderate",
    summary: "One serious problem is holding the score down. Fixing the public FTP service would make the biggest difference.",
    breakdown: [
      { label: "Encryption & certificates", value: 90 },
      { label: "Exposed services", value: 45 },
      { label: "Security headers", value: 62 },
      { label: "Email & DNS", value: 74 },
    ],
    stats: [
      { label: "Hosts found", value: 3 },
      { label: "Open services", value: 4 },
      { label: "Findings", value: 4 },
      { label: "Checks completed", value: 5, suffix: " / 5" },
    ],
    nodes,
    arcs: nodes
      .filter((node) => node.id !== "edge")
      .map((node) => ({ id: `edge-${node.id}`, from: nodes[0], to: node, status: node.status })),
    findings,
  };
}
