"use client";

import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import NumberTicker from "./number-ticker";
import { useTheme } from "@/lib/theme-store";
import { useScan } from "../scan-context";
import styles from "@/styles/overview/scan-results.module.css";

const ExposureGlobe = dynamic(() => import("./exposure-globe"), {
  ssr: false,
  loading: () => <div className={styles.globeLoading}>Loading infrastructure map…</div>,
});

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
const SEVERITY_LABELS = { critical: "Critical", high: "High", medium: "Medium", low: "Low" };
const STATUS_LABELS = { healthy: "Healthy", attention: "Needs attention", critical: "Critical" };

const MAX_SHOWN_CVES = 10;

// Package vulnerabilities use OSV and GitHub IDs (GHSA-...), not only CVEs.
function vulnUrl(id) {
  if (id.startsWith("CVE-")) {
    return `https://nvd.nist.gov/vuln/detail/${id}`;
  }
  return `https://osv.dev/vulnerability/${id}`;
}

function VulnLink({ id }) {
  return (
    <a href={vulnUrl(id)} target="_blank" rel="noreferrer" className="font-mono text-accent underline">{id}</a>
  );
}

function hasDetails(details) {
  return Boolean(details) && Object.keys(details).length > 0;
}

// Technical data behind a finding, shaped by the finding type (see the data shapes table).
function FindingDetails({ details }) {
  return (
    <dl className="m-0 flex flex-col gap-2 text-xs text-muted">
      {details.cves && (
        <div className="flex flex-col gap-2">
          {details.cves.slice(0, MAX_SHOWN_CVES).map((cve) => (
            <div key={cve.id}>
              <VulnLink id={cve.id} />
              <span className="ml-2">
                CVSS {cve.cvss ?? "?"} · EPSS {cve.epss == null ? "?" : `${Math.round(cve.epss * 100)}%`}
                {cve.kev && <strong className="ml-2 text-critical">Actively exploited</strong>}
              </span>
              {cve.summary && <p className="mt-0.5 mb-0 line-clamp-2">{cve.summary}</p>}
              {cve.hosts?.length > 0 && <p className="mt-0.5 mb-0 font-mono break-all">{cve.hosts.join(", ")}</p>}
            </div>
          ))}
          {details.cves.length > MAX_SHOWN_CVES && (
            <p className="m-0">+{details.cves.length - MAX_SHOWN_CVES} more</p>
          )}
        </div>
      )}

      {details.port != null && (
        <div><dt className="inline font-semibold">Port</dt><dd className="ml-2 inline">{details.port} · {details.service}</dd></div>
      )}

      {details.domain !== undefined && (
        <>
          <div><dt className="inline font-semibold">Domain</dt><dd className="ml-2 inline font-mono">{details.domain || "Unknown"}</dd></div>
          <div><dt className="inline font-semibold">Record</dt><dd className="ml-2 inline font-mono break-all">{details.record || "None"}</dd></div>
        </>
      )}

      {details.files && (
        <div>
          <dt className="font-semibold">Files</dt>
          {details.files.map((file) => <dd key={file} className="ml-0 font-mono break-all">{file}</dd>)}
        </div>
      )}

      {details.package && (
        <>
          <div><dt className="inline font-semibold">Package</dt><dd className="ml-2 inline font-mono">{details.package} {details.version}</dd></div>
          <div>
            <dt className="font-semibold">Vulnerabilities</dt>
            <dd className="ml-0 flex flex-wrap gap-x-3 gap-y-1">
              {details.vulns.map((id) => <VulnLink key={id} id={id} />)}
            </dd>
          </div>
        </>
      )}
    </dl>
  );
}

// ip-api's org is the hosting company; older cached scans only have isp.
function hostingProvider(node) {
  return node.org || node.provider || "Unknown";
}

function scoreTone(value) {
  if (value >= 80) return "good";
  if (value >= 60) return "warn";
  return "bad";
}

function ScoreRing({ score, reduceMotion }) {
  return (
    <div className={styles.ring} data-tone={scoreTone(score)}>
      <svg viewBox="0 0 80 80" aria-hidden="true">
        <circle className={styles.ringTrack} cx="40" cy="40" r="33" />
        <motion.circle
          className={styles.ringValue}
          cx="40"
          cy="40"
          r="33"
          initial={reduceMotion ? false : { pathLength: 0 }}
          animate={{ pathLength: score / 100 }}
          transition={{ duration: 1.1, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
        />
      </svg>
      <div className={styles.ringNumber} aria-label={`${score} out of 100`}>
        <strong aria-hidden="true"><NumberTicker value={score} delay={0.25} /></strong>
        <span className={styles.ringScale} aria-hidden="true">/100</span>
      </div>
    </div>
  );
}

const DOT_COLORS = { healthy: "bg-accent", attention: "bg-warm", critical: "bg-critical" };

// Phone-sized replacement for the globe's server list: servers grouped by country.
function ServerGroups({ groups, selectedId, onSelect }) {
  return (
    <div className="flex flex-col gap-4 p-3.5" role="group" aria-label="Servers by country">
      {groups.map((group) => (
        <section key={group.country} aria-label={group.country}>
          <h3 className="mb-2 text-xs font-semibold text-muted">
            {group.country} · {group.nodes.length} {group.nodes.length === 1 ? "server" : "servers"}
          </h3>
          <ul className="flex flex-col gap-2">
            {group.nodes.map((node) => (
              <li key={node.id}>
                <button
                  type="button"
                  aria-pressed={node.id === selectedId}
                  onClick={() => onSelect(node.id)}
                  className={`flex w-full min-w-0 cursor-pointer items-start gap-2.5 rounded-md border bg-surface px-2.5 py-2 text-left text-ink ${node.id === selectedId ? "border-accent" : "border-line"}`}
                >
                  <i aria-hidden="true" className={`mt-1.5 size-2 flex-none rounded-full ${DOT_COLORS[node.status]}`} />
                  <span className="sr-only">{STATUS_LABELS[node.status]}:</span>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate font-mono text-xs font-semibold">{node.host}</strong>
                    <small className="block break-words text-xs text-muted">{hostingProvider(node)} · {node.service}</small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

// The scan layout only renders this tab once a finished scan exists.
export default function OverviewTab() {
  const { result, lines } = useScan();
  const [theme] = useTheme();
  const reduceMotion = Boolean(useReducedMotion());
  const findings = [...result.findings].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  const [selectedFindingId, setSelectedFindingId] = useState(findings[0]?.id);
  const [selectedNodeId, setSelectedNodeId] = useState(findings[0]?.nodeId || result.nodes[0]?.id);
  const [logOpen, setLogOpen] = useState(false);
  const [showAllServers, setShowAllServers] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [detailsOpenId, setDetailsOpenId] = useState(null);

  const countryGroups = [];
  for (const node of result.nodes) {
    let group = countryGroups.find((item) => item.country === node.country);
    if (!group) {
      group = { country: node.country, nodes: [] };
      countryGroups.push(group);
    }
    group.nodes.push(node);
  }

  let shownNodes = result.nodes;
  if (!showAllServers) {
    shownNodes = result.nodes.slice(0, 6);
  }

  const selectedNode = result.nodes.find((node) => node.id === selectedNodeId) || result.nodes[0];
  let selectedFinding = findings.find((finding) => finding.id === selectedFindingId);
  const statusCounts = result.nodes.reduce((counts, node) => ({ ...counts, [node.status]: (counts[node.status] || 0) + 1 }), {});

  let repoInfo = null;
  if (result.repo) {
    repoInfo = result.repo.records.repo;
  }

  let repoChecks = []
  if (result.repo && result.repo.records.basics) {
    const records = result.repo.records;
    repoChecks = [
      { label: "No secret files committed", passed: records.sensitiveFiles.length === 0 },
      { label: "No packages with known bugs", passed: records.dependencies.length === 0 },
      { label: "Has a security policy (SECURITY.md)", passed: records.basics.securityPolicy },
      { label: "Dependabot is set up", passed: records.basics.dependabot },
      { label: "Has a lockfile", passed: records.basics.lockfile },
    ];
  }

  function selectNode(nodeId) {
    setSelectedNodeId(nodeId);
    setSelectedFindingId(findings.find((finding) => finding.nodeId === nodeId)?.id);
  }

  function selectFinding(finding) {
    setSelectedFindingId(finding.id);
    setSelectedNodeId(finding.nodeId);
  }

  const reveal = (delay = 0) => (reduceMotion
    ? {}
    : { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] } });

  return (
    <>
      <motion.dl className={styles.stats} {...reveal(0.1)}>
        {result.stats.map((stat, index) => (
          <div key={stat.label}>
            <dt>{stat.label}</dt>
            <dd><NumberTicker value={stat.value} delay={0.15 + index * 0.08} />{stat.suffix}</dd>
          </div>
        ))}
      </motion.dl>

      <div className={styles.grid}>
        {result.nodes.length > 0 && (
        <motion.section className={styles.mapCard} aria-labelledby="map-title" {...reveal(0.15)}>
          <div className={styles.cardHead}>
            <h2 id="map-title">Where your servers are</h2>
            <div className={styles.legend} aria-label="Status legend">
              <span data-status="healthy"><i />Healthy {statusCounts.healthy || 0}</span>
              <span data-status="attention"><i />Attention {statusCounts.attention || 0}</span>
              <span data-status="critical"><i />Critical {statusCounts.critical || 0}</span>
            </div>
          </div>

          <div className="md:hidden">
            <ServerGroups groups={countryGroups} selectedId={selectedNode.id} onSelect={selectNode} />
            <div className="border-t border-line px-3.5 py-3">
              <button
                type="button"
                aria-expanded={mapOpen}
                aria-controls="map-stage"
                onClick={() => setMapOpen((open) => !open)}
                className="w-full cursor-pointer rounded-md border border-line bg-surface px-3 py-2 text-sm font-semibold text-accent"
              >
                {mapOpen ? "Hide map" : "Show map"}
              </button>
            </div>
          </div>

          <div id="map-stage" className={`${styles.globeStage} flex-none h-75 md:h-[clamp(300px,38vh,380px)] ${mapOpen ? "" : "max-md:hidden"}`}>
            <ExposureGlobe
              nodes={result.nodes}
              arcs={result.arcs}
              selectedId={selectedNode.id}
              onSelect={selectNode}
              theme={theme}
              reduceMotion={reduceMotion}
            />
            <p className={styles.globeHint}>Drag to spin · click a dot or a server below</p>
          </div>

          <div className={`${styles.nodeList} max-md:hidden!`} role="group" aria-label="Servers">
            {shownNodes.map((node) => (
              <button
                key={node.id}
                type="button"
                data-status={node.status}
                className={node.id === selectedNode.id ? styles.nodeActive : ""}
                aria-pressed={node.id === selectedNode.id}
                onClick={() => selectNode(node.id)}
              >
                <i aria-hidden="true" />
                <span><strong>{node.host}</strong><small>{node.city}, {node.country} · {node.service}</small></span>
              </button>
            ))}

            {result.nodes.length > 6 && (
              <button className="text-sm text-accent font-semibold mt-2 cursor-pointer" onClick={() => setShowAllServers(!showAllServers)}>
                {showAllServers ? "Show fewer servers" : `Show all ${result.nodes.length} servers`}
              </button>
            )}
          </div>

          <section className={styles.inspector} aria-labelledby="details-title" aria-live="polite">
            <div className={styles.inspectorHead}>
              <h2 id="details-title">Server details</h2>
              <span className={styles.statusBadge} data-status={selectedNode.status}>{STATUS_LABELS[selectedNode.status]}</span>
            </div>
            <div className={styles.inspectorBody}>
              <dl className={styles.kv}>
                <div><dt>Address</dt><dd>{selectedNode.host}</dd></div>
                <div><dt>IP</dt><dd>{selectedNode.ip}</dd></div>
                <div><dt>Location</dt><dd>{selectedNode.city}, {selectedNode.country}</dd></div>
                <div><dt>Hosting provider</dt><dd>{hostingProvider(selectedNode)}</dd></div>
                <div><dt>Network operator</dt><dd>{selectedNode.as || "Unknown"}</dd></div>
                <div><dt>Service</dt><dd>{selectedNode.service}</dd></div>
              </dl>
              <div className={styles.inspectorText}>
                <p className={styles.nodeSummary}>{selectedNode.summary}</p>
                {selectedFinding ? (
                  <div className={styles.fix}>
                    <h3>What to do</h3>
                    <p>{selectedFinding.fix}</p>
                  </div>
                ) : (
                  <p className={styles.noIssue}>No issues were listed for this server.</p>
                )}
              </div>
            </div>
          </section>

          <div className={styles.logDrawer}>
            <button type="button" className={styles.logBar} aria-expanded={logOpen} aria-controls="scan-log" onClick={() => setLogOpen((open) => !open)}>
              <span className={styles.logLabel}><i aria-hidden="true" /> Scan logs</span>
              <span className={styles.logLast}>{lines.at(-1)?.text}</span>
              <span className={styles.logChevron} aria-hidden="true">{logOpen ? "▲" : "▼"}</span>
            </button>
            {logOpen && (
              <ol id="scan-log" className={styles.logBody}>
                {lines.map((line) => (
                  <li key={line.id} data-kind={line.kind}><time>{line.time}</time><span>{line.text}</span></li>
                ))}
              </ol>
            )}
          </div>
        </motion.section>
        )}

        {result.nodes.length === 0 && repoInfo && (
          <motion.section className={`${styles.card} self-start`} aria-labelledby="repo-title" {...reveal(0.15)}>
            <div className={styles.cardHead}>
              <h2 id="repo-title">Repository</h2>
            </div>
            <dl className={styles.kv}>
              <div><dt>Name</dt><dd>{repoInfo.name}</dd></div>
              <div><dt>About</dt><dd>{repoInfo.description || "No description"}</dd></div>
              <div><dt>Branch</dt><dd>{repoInfo.defaultBranch}</dd></div>
              <div><dt>Last push</dt><dd>{new Date(repoInfo.pushedAt).toLocaleDateString()}</dd></div>
              <div><dt>Stars</dt><dd>{repoInfo.stars}</dd></div>
            </dl>

            <ul className="mt-4 mb-4 flex flex-col gap-2 text-sm">
              {repoChecks.map((check) => (
                <li key={check.label} className={check.passed ? "text-ink" : "text-critical"}>
                  {check.passed ? "✓" : "✕"} {check.label}
                </li>
              ))}
            </ul>

            <a href={repoInfo.url} target="_blank" rel="noreferrer" className="text-sm text-accent font-semibold mt-2">Open on GitHub</a>
          </motion.section>
        )}

        <div className={styles.sideColumn}>
          <motion.section className={`${styles.card} ${styles.scoreCard}`} aria-labelledby="score-title" {...reveal(0.2)}>
            <div className={styles.cardHead}>
              <h2 id="score-title">Exposure score</h2>
              <span className={styles.ratingBadge} data-tone={scoreTone(result.score)}>{result.rating}</span>
            </div>
            <div className={styles.scoreBody}>
              <ScoreRing score={result.score} reduceMotion={reduceMotion} />
            </div>
            <p className={styles.scoreSummary}>{result.summary} Higher is safer.</p>
          </motion.section>

          <motion.section className={`${styles.card} ${styles.findingsCard}`} aria-labelledby="findings-title" {...reveal(0.27)}>
            <div className={styles.cardHead}>
              <h2 id="findings-title">Findings · worst first</h2>
              <span className={styles.count}><NumberTicker value={findings.length} delay={0.3} /></span>
            </div>
            <ul className={styles.findings}>
              {findings.map((finding) => (
                <li key={finding.id}>
                  <button
                    type="button"
                    data-severity={finding.severity}
                    className={finding.id === selectedFinding?.id ? styles.findingActive : ""}
                    aria-pressed={finding.id === selectedFinding?.id}
                    onClick={() => selectFinding(finding)}
                  >
                    <span className={styles.severity}>{SEVERITY_LABELS[finding.severity]}</span>
                    <strong>{finding.title}</strong>
                    <small>{result.nodes.find((node) => node.id === finding.nodeId)?.host} · {finding.source}</small>
                    {finding.id === selectedFinding?.id && (
                      <span className={styles.findingWhy}>
                        {finding.why}
                        <br /><strong>What to do:</strong> {finding.fix}
                      </span>
                    )}
                  </button>

                  {finding.id === selectedFinding?.id && hasDetails(finding.details) && (
                    <div className="mt-1.5 px-3">
                      <button
                        type="button"
                        aria-expanded={detailsOpenId === finding.id}
                        aria-controls={`finding-details-${finding.id}`}
                        onClick={() => setDetailsOpenId(detailsOpenId === finding.id ? null : finding.id)}
                        className="w-auto! cursor-pointer border-0! bg-transparent! p-0! text-xs font-semibold text-accent"
                      >
                        Technical details {detailsOpenId === finding.id ? "▲" : "▼"}
                      </button>
                      {detailsOpenId === finding.id && (
                        <div id={`finding-details-${finding.id}`} className="mt-2 rounded-md border border-line bg-surface p-2.5">
                          <FindingDetails details={finding.details} />
                        </div>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </motion.section>
        </div>
      </div>
    </>
  );
}
