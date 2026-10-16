"use client";

import dynamic from "next/dynamic";
import { motion, useReducedMotion } from "motion/react";
import { useState } from "react";
import NumberTicker from "./number-ticker";
import { Term, withTerms } from "./glossary";
import { useTheme } from "@/lib/theme-store";
import { useScan } from "../scan-context";
import styles from "@/styles/overview/scan-results.module.css";

const ExposureGlobe = dynamic(() => import("./exposure-globe"), {
  ssr: false,
  loading: () => <div className={styles.globeLoading}>Loading infrastructure map…</div>,
});

const ServerMap = dynamic(() => import("./server-map"), {
  ssr: false,
  loading: () => <div className={styles.globeLoading}>Loading map…</div>,
});

const MAP_VIEWS = { globe: "Globe", map: "Map" };

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
const SEVERITY_LABELS = { critical: "Critical", high: "High", medium: "Medium", low: "Low" };
const STATUS_LABELS = { healthy: "Healthy", attention: "Needs attention", critical: "Critical" };

const MAX_SHOWN_CVES = 10;

const SCORE_RULE = "Your score is out of 100, and higher is safer. Each check scores 0 to 10, and riskier checks count for more. A critical problem keeps your score at 50 or below until it's fixed.";

const REPO_CATEGORIES = ["secrets", "packages", "repo-basics", "ignore-rules", "readme", "workflows"];

// One scored check in the Repository card: its score out of 10, or why it didn't run
function checkValue(check) {
  if (check.status === "unavailable") return "Couldn't check";
  if (check.status === "not_checked") return "Not checked";
  return `${check.score}/10`;
}

function checkMark(check) {
  if (check.status !== "ok") return "-";
  return check.score === 10 ? "✓" : "✕";
}

function checkTone(check) {
  if (check.status !== "ok") return "text-muted";
  if (check.score === 10) return "text-ink";
  return check.score === 0 ? "text-critical" : "text-warm";
}

// T18: what fixing this finding would win back. The API works out gain, we only read it.
function showGain(finding, incomplete) {
  return !incomplete && Boolean(finding.checkId) && Boolean(finding.gain);
}

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
          {details.cves.slice(0, MAX_SHOWN_CVES).map((cve, index) => (
            <div key={cve.id}>
              <VulnLink id={cve.id} />
              <span className="ml-2">
                {index === 0 ? <Term term="CVSS" /> : "CVSS"} {cve.cvss ?? "?"} ·{" "}
                {index === 0 ? <Term term="EPSS" /> : "EPSS"} {cve.epss == null ? "?" : `${Math.round(cve.epss * 100)}%`}
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
        <div><dt className="inline font-semibold">{withTerms("Port")}</dt><dd className="ml-2 inline">{details.port} · {details.service}</dd></div>
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

      {details.issuer && (
        <>
          <div><dt className="inline font-semibold">Issuer</dt><dd className="ml-2 inline">{details.issuer}</dd></div>
          <div><dt className="inline font-semibold">Expires</dt><dd className="ml-2 inline">{new Date(details.validTo).toLocaleDateString()} ({details.daysLeft < 0 ? "expired" : `${details.daysLeft} days`})</dd></div>
          <div><dt className="inline font-semibold">Key</dt><dd className="ml-2 inline font-mono">{details.keyBits ? `${details.keyBits}-bit · ` : ""}{details.tlsVersion}</dd></div>
        </>
      )}

      {details.header && (
        <>
          <div><dt className="inline font-semibold">Page</dt><dd className="ml-2 inline font-mono break-all">{details.url}</dd></div>
          <div><dt className="inline font-semibold">{withTerms(details.header)}</dt><dd className="ml-2 inline font-mono break-all">{details.value || "Not set"}</dd></div>
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

function trackStyle(missing, passed) {
  if (missing) return "border border-dashed border-line";
  return passed ? "bg-accent-soft" : "bg-line";
}

// Points each category lost, worst first. The bar shows how much of that category's points are gone.
function ScoreBreakdown({ breakdown, checks, reduceMotion }) {
  const ran = checks.filter((check) => check.status === "ok");
  const totalWeight = ran.reduce((sum, check) => sum + check.weight, 0);

  return (
    <div className="w-full">
      <p className="m-0 mb-2 font-mono text-[10px] tracking-[.08em] text-muted uppercase">Points lost by category</p>
      <ul className="m-0 flex w-full list-none flex-col gap-2.5 p-0" aria-label="Score breakdown">
        {breakdown.map((item) => {
          const weight = ran.filter((check) => check.category === item.category).reduce((sum, check) => sum + check.weight, 0);
          const most = totalWeight > 0 ? (100 * weight) / totalWeight : 0;
          const share = most > 0 ? Math.min(100, (100 * item.lost) / most) : 0;
          const barColor = share >= 50 ? "bg-critical" : "bg-warm";
          const imperfect = ran.some((check) => check.category === item.category && check.score < 10);
          // A category that didn't run has no points to show, so it gets an empty dashed track
          const missing = item.status === "unavailable" || item.status === "not_checked";
          // Nothing lost and every check perfect, so the empty track can read as good
          const passed = item.status === "ok" && item.lost === 0 && !imperfect;

          let value = <><span aria-hidden="true">✓</span> No issues</>;
          let tone = "text-accent";
          if (item.status === "unavailable") {
            value = "Couldn't check";
            tone = "text-muted";
          } else if (item.status === "not_checked") {
            value = "Not checked";
            tone = "text-muted";
          } else if (item.lost > 0) {
            value = <>-{item.lost}<span className="sr-only"> points</span></>;
            tone = share >= 50 ? "text-critical" : "text-warm";
          } else if (imperfect) {
            // Lost less than a point, which rounds to 0
            value = "Minor";
            tone = "text-warm";
          }

          return (
            <li key={item.category}>
              <div className="mb-1 flex justify-between gap-2.5 font-mono text-[10px] text-muted">
                <span>{item.label}</span>
                <span className={`flex-none font-semibold ${tone}`}>{value}</span>
              </div>
              <div
                className={`h-1.5 overflow-hidden rounded-full ${trackStyle(missing, passed)}`}
                aria-hidden="true"
              >
                {!missing && (
                  <motion.span
                    className={`block h-full rounded-full ${barColor}`}
                    initial={reduceMotion ? false : { width: 0 }}
                    animate={{ width: `${share}%` }}
                    transition={{ duration: 0.8, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  />
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const DOT_COLORS = { healthy: "bg-accent", attention: "bg-warm", critical: "bg-critical" };

// Servers whose location lookup failed stay in the lists, without a place
function locationLabel(node) {
  if (!node.located) {
    return "Location unknown";
  }
  return `${node.city}, ${node.country}`;
}

function CdnBadge() {
  return (
    <span className="ml-1.5 rounded-sm border border-line px-1 text-[9px] font-medium text-muted align-middle">CDN</span>
  );
}

// Phone-sized replacement for the globe's server list: servers grouped by country.
function ServerGroups({ groups, selectedId, highlightIds, onSelect }) {
  return (
    <div className="flex flex-col gap-4 p-3.5" role="group" aria-label="Servers by country">
      {groups.map((group) => (
        <section key={group.label} aria-label={group.label}>
          <h3 className="mb-2 text-xs font-semibold text-muted">
            {group.label} · {group.nodes.length} {group.nodes.length === 1 ? "server" : "servers"}
          </h3>
          <ul className="flex flex-col gap-2">
            {group.nodes.map((node) => (
              <li key={node.id}>
                <button
                  type="button"
                  aria-pressed={node.id === selectedId}
                  onClick={() => onSelect(node.id)}
                  className={`flex w-full min-w-0 cursor-pointer items-start gap-2.5 rounded-md border bg-surface px-2.5 py-2 text-left text-ink ${node.id === selectedId ? "border-accent" : "border-line"} ${highlightIds.includes(node.id) ? "ring-1 ring-accent" : ""}`}
                >
                  <i aria-hidden="true" className={`mt-1.5 size-2 flex-none rounded-full ${DOT_COLORS[node.status]}`} />
                  <span className="sr-only">{STATUS_LABELS[node.status]}:</span>
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate font-mono text-xs font-semibold">
                      {node.host}{node.isCdn && <CdnBadge />}
                    </strong>
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
  const [mapView, setMapView] = useState("globe");
  const [openFindingIds, setOpenFindingIds] = useState(() => new Set(findings[0] ? [findings[0].id] : []));
  const [detailsOpenIds, setDetailsOpenIds] = useState(() => new Set());
  const [filterNodeId, setFilterNodeId] = useState(null);

  const countryGroups = [];
  for (const node of result.nodes) {
    const label = locationLabel(node);
    let group = countryGroups.find((item) => item.label === label);
    if (!group) {
      group = { label, nodes: [] };
      countryGroups.push(group);
    }
    group.nodes.push(node);
  }

  const locatedNodes = result.nodes.filter((node) => node.located);

  const selectedNode = result.nodes.find((node) => node.id === selectedNodeId) || result.nodes[0];
  let selectedFinding = findings.find((finding) => finding.id === selectedFindingId);
  // Light up every server the selected finding affects. DNS and repo findings have no hosts
  const highlightIds = selectedFinding?.hosts ?? [];

  // The short list still shows every server the selected finding affects
  let shownNodes = result.nodes;
  if (!showAllServers) {
    shownNodes = result.nodes.filter((node, index) => index < 6 || highlightIds.includes(node.id));
  }

  const affectsNode = (finding, nodeId) => Boolean(finding.hosts?.includes(nodeId));
  const nodeFindingCount = selectedNode ? findings.filter((finding) => affectsNode(finding, selectedNode.id)).length : 0;
  const filterNode = result.nodes.find((node) => node.id === filterNodeId);
  const shownFindings = filterNode ? findings.filter((finding) => affectsNode(finding, filterNode.id)) : findings;
  const allFindingsOpen = shownFindings.length > 0 && shownFindings.every((finding) => openFindingIds.has(finding.id));

  const statusCounts = result.nodes.reduce((counts, node) => ({ ...counts, [node.status]: (counts[node.status] || 0) + 1 }), {});

  let repoInfo = null;
  if (result.repo) {
    repoInfo = result.repo.records.repo;
  }

  // The repo's scored checks, so the card always matches the score
  const repoChecks = (result.checks ?? []).filter((check) => REPO_CATEGORIES.includes(check.category));

  // How much of the scan the score is really based on (T20)
  const ranChecks = (result.checks ?? []).filter((check) => check.status === "ok").length;
  const missedChecks = (result.checks ?? []).filter((check) => check.status === "unavailable").length;

  function openFinding(id) {
    setOpenFindingIds((open) => new Set(open).add(id));
  }

  function selectNode(nodeId) {
    const finding = findings.find((item) => affectsNode(item, nodeId));
    setSelectedNodeId(nodeId);
    setSelectedFindingId(finding?.id ?? null);

    if (finding) {
      openFinding(finding.id);
    }
  }

  // On phones the findings card is further down, so bring it into view
  function showNodeFindings(nodeId) {
    const finding = findings.find((item) => affectsNode(item, nodeId));
    setFilterNodeId(nodeId);

    if (finding) {
      setSelectedFindingId(finding.id);
      openFinding(finding.id);
    }

    document.getElementById("findings-title")?.closest("section").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "nearest" });
  }

  // Findings open and close on their own, and the last one opened drives the map highlight
  function toggleFinding(finding) {
    const open = new Set(openFindingIds);

    if (open.has(finding.id)) {
      open.delete(finding.id);
      if (finding.id === selectedFindingId) {
        setSelectedFindingId(null);
      }
    } else {
      open.add(finding.id);
      setSelectedFindingId(finding.id);
      setSelectedNodeId(finding.nodeId);
    }

    setOpenFindingIds(open);
  }

  function toggleDetails(id) {
    const open = new Set(detailsOpenIds);

    if (open.has(id)) {
      open.delete(id);
    } else {
      open.add(id);
    }

    setDetailsOpenIds(open);
  }

  function toggleAllFindings() {
    if (allFindingsOpen) {
      setOpenFindingIds(new Set());
      setDetailsOpenIds(new Set());
      setSelectedFindingId(null);
      return;
    }

    setOpenFindingIds(new Set(shownFindings.map((finding) => finding.id)));
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
        {result.domain && (
        <motion.section className={`${styles.mapCard} self-start`} aria-labelledby="map-title" {...reveal(0.15)}>
          <div className={styles.cardHead}>
            <h2 id="map-title">Where your servers are</h2>
            <div className={styles.legend} aria-label="Status legend">
              <span data-status="healthy"><i />Healthy {statusCounts.healthy || 0}</span>
              <span data-status="attention"><i />Attention {statusCounts.attention || 0}</span>
              <span data-status="critical"><i />Critical {statusCounts.critical || 0}</span>
            </div>
          </div>

          {result.nodes.length > 0 && (
            <div className="md:hidden">
              <ServerGroups groups={countryGroups} selectedId={selectedNode.id} highlightIds={highlightIds} onSelect={selectNode} />
              {locatedNodes.length > 0 && (
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
              )}
            </div>
          )}

          {locatedNodes.length > 0 ? (
            <div id="map-stage" className={`${styles.globeStage} flex-none h-75 md:h-[clamp(300px,38vh,380px)] ${mapOpen ? "" : "max-md:hidden"}`}>
              <div role="group" aria-label="Map view" className="absolute top-3 left-3 z-[2] flex overflow-hidden rounded-md border border-line bg-surface-strong text-xs font-semibold">
                {Object.entries(MAP_VIEWS).map(([view, label]) => (
                  <button
                    key={view}
                    type="button"
                    aria-pressed={mapView === view}
                    onClick={() => setMapView(view)}
                    className={`cursor-pointer px-3 py-1.5 ${mapView === view ? "bg-accent-soft text-ink" : "text-muted"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {mapView === "globe" ? (
                <ExposureGlobe
                  nodes={result.nodes}
                  arcs={result.arcs}
                  selectedId={selectedNode.id}
                  highlightIds={highlightIds}
                  onSelect={selectNode}
                  theme={theme}
                  reduceMotion={reduceMotion}
                />
              ) : (
                <ServerMap
                  nodes={result.nodes}
                  arcs={result.arcs}
                  selectedId={selectedNode.id}
                  highlightIds={highlightIds}
                  onSelect={selectNode}
                  reduceMotion={reduceMotion}
                />
              )}
              <p className={styles.globeHint}>
                {mapView === "globe" ? "Drag to spin · click a dot or a server below" : "Scroll to zoom, drag to move · click a dot or a server below"}
              </p>
            </div>
          ) : (
            <p className="m-0 border-b border-line px-4 py-8 text-center text-sm text-muted">
              {result.geoStatus === "unavailable"
                ? "We couldn't look up where these servers are right now. Try re-scanning later."
                : "We couldn't place these servers on a map."}
            </p>
          )}

          {result.arcs.length > 0 && (
            <p className={`m-0 px-4 py-2 text-center text-xs text-muted ${mapOpen ? "" : "max-md:hidden"}`}>
              Lines connect your main site to your other servers. They don&apos;t show real traffic.
            </p>
          )}

          {result.nodes.length > 0 && (
          <div className={`${styles.nodeList} max-md:hidden!`} role="group" aria-label="Servers">
            {shownNodes.map((node) => (
              <button
                key={node.id}
                type="button"
                data-status={node.status}
                className={`${node.id === selectedNode.id ? styles.nodeActive : ""} ${highlightIds.includes(node.id) ? "ring-1 ring-accent" : ""}`}
                aria-pressed={node.id === selectedNode.id}
                onClick={() => selectNode(node.id)}
              >
                <i aria-hidden="true" />
                <span>
                  <strong>{node.host}{node.isCdn && <CdnBadge />}</strong>
                  <small>{locationLabel(node)} · {node.service}</small>
                </span>
              </button>
            ))}

            {result.nodes.length > 6 && (
              <button type="button" className="col-span-full justify-self-start border-0! bg-transparent! p-0! text-sm! text-accent! font-semibold mt-1 cursor-pointer" onClick={() => setShowAllServers(!showAllServers)}>
                {showAllServers ? "Show fewer servers" : `Show all ${result.nodes.length} servers`}
              </button>
            )}
          </div>
          )}

          {selectedNode && (
          <section className={styles.inspector} aria-labelledby="details-title" aria-live="polite">
            <div className={styles.inspectorHead}>
              <h2 id="details-title">Server details</h2>
              <span className={styles.statusBadge} data-status={selectedNode.status}>{STATUS_LABELS[selectedNode.status]}</span>
            </div>
            <div className={styles.inspectorBody}>
              <dl className={styles.kv}>
                <div><dt>Address</dt><dd>{selectedNode.host}</dd></div>
                <div><dt>IP</dt><dd>{selectedNode.ip}</dd></div>
                <div><dt>Location</dt><dd>{locationLabel(selectedNode)}</dd></div>
                <div><dt>Hosting provider</dt><dd>{hostingProvider(selectedNode)}</dd></div>
                <div><dt>Network operator</dt><dd>{selectedNode.as || "Unknown"}</dd></div>
                <div><dt>Service</dt><dd>{selectedNode.service}</dd></div>
              </dl>
              <div className={styles.inspectorText}>
                <p className={styles.nodeSummary}>{selectedNode.summary}</p>
                {nodeFindingCount > 0 && (
                  <p className="m-0 flex flex-wrap gap-x-2 text-xs text-muted">
                    {nodeFindingCount} {nodeFindingCount === 1 ? "finding" : "findings"} on this server
                    {filterNodeId !== selectedNode.id && (
                      <button type="button" onClick={() => showNodeFindings(selectedNode.id)} className="cursor-pointer font-semibold text-accent">
                        Show only these
                      </button>
                    )}
                  </p>
                )}
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
          )}

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
                <li key={check.id} className={`flex justify-between gap-3 ${checkTone(check)}`}>
                  <span><span aria-hidden="true">{checkMark(check)}</span> {check.label}</span>
                  <span className="flex-none font-mono text-xs">{checkValue(check)}</span>
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
              <span className={styles.ratingBadge} data-tone={result.incomplete ? "warn" : scoreTone(result.score)}>
                {result.incomplete ? "Incomplete, re-scan" : result.rating}
              </span>
            </div>
            <div className={styles.scoreBody}>
              <ScoreRing score={result.score} reduceMotion={reduceMotion} />
              {result.checks?.length > 0 && (
                <ScoreBreakdown breakdown={result.breakdown} checks={result.checks} reduceMotion={reduceMotion} />
              )}
            </div>
            {result.checks?.length > 0 && (
              <p className="m-0 mt-3 text-xs text-muted">
                Based on {ranChecks} checks.
                {missedChecks > 0 && ` ${missedChecks} couldn't run and ${missedChecks === 1 ? "isn't" : "aren't"} counted.`}
              </p>
            )}
            {result.cap?.applied && result.uncappedScore > result.score && (
              <p className="m-0 mt-3 text-xs text-critical">
                Capped at 50 until the critical problem is fixed. Without it, you&apos;d score {result.uncappedScore}.
              </p>
            )}
            {result.incomplete && (
              <p className="m-0 mt-3 text-xs text-warm">
                A critical check couldn&apos;t run, so there&apos;s no grade yet. Re-scan to try again.
              </p>
            )}
            {result.breakdown?.some((item) => item.status === "unavailable") && (
              <p className="m-0 mt-3 text-xs text-muted">
                &quot;Couldn&apos;t check&quot; means a free lookup service didn&apos;t answer. It isn&apos;t counted in your score. Re-scan to try again.
              </p>
            )}
            {result.breakdown?.some((item) => item.status === "not_checked") && (
              <p className="m-0 mt-3 text-xs text-muted">
                &quot;Not checked&quot; means the check doesn&apos;t apply here, or this scan is older than the check. Re-scan to run every check.
              </p>
            )}
            <p className={styles.scoreSummary}>{result.summary}</p>
            <p className="m-0 mt-2 text-xs leading-relaxed text-muted">{SCORE_RULE}</p>
          </motion.section>

          <motion.section className={`${styles.card} ${styles.findingsCard}`} aria-labelledby="findings-title" {...reveal(0.27)}>
            <div className={styles.cardHead}>
              <h2 id="findings-title">Findings · worst first</h2>
              <span className="flex items-center gap-3">
                {shownFindings.length > 0 && (
                  <button type="button" onClick={toggleAllFindings} className="cursor-pointer text-xs! font-semibold text-accent">
                    {allFindingsOpen ? "Collapse all" : "Expand all"}
                  </button>
                )}
                <span className={styles.count}><NumberTicker value={shownFindings.length} delay={0.3} /></span>
              </span>
            </div>
            {filterNode && (
              <p className="m-0 mb-3 text-xs text-muted">
                Showing findings for <span className="font-mono text-ink">{filterNode.host}</span> ·{" "}
                <button type="button" onClick={() => setFilterNodeId(null)} className="cursor-pointer font-semibold text-accent">
                  Show all
                </button>
              </p>
            )}
            <ul className={styles.findings}>
              {shownFindings.map((finding) => (
                <li key={finding.id}>
                  <button
                    type="button"
                    data-severity={finding.severity}
                    className={finding.id === selectedFinding?.id ? styles.findingActive : ""}
                    aria-pressed={finding.id === selectedFinding?.id}
                    aria-expanded={openFindingIds.has(finding.id)}
                    onClick={() => toggleFinding(finding)}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className={styles.severity}>{SEVERITY_LABELS[finding.severity]}</span>
                      {showGain(finding, result.incomplete) && (
                        <span
                          className={`${styles.severity} text-accent!`}
                          title={`Fixing this adds ${finding.sharedCheck ? "up to " : ""}${finding.gain} points to your score`}
                          aria-label={`Fixing this adds ${finding.sharedCheck ? "up to " : ""}${finding.gain} points to your score`}
                        >
                          <span aria-hidden="true">↑ </span>
                          {finding.sharedCheck ? "up to " : ""}+{finding.gain} pts
                        </span>
                      )}
                    </span>
                    <strong>{finding.title}</strong>
                    <small>{result.nodes.find((node) => node.id === finding.nodeId)?.host} · {finding.source}</small>
                  </button>

                  {openFindingIds.has(finding.id) && (
                    <div className={`${styles.findingWhy} px-3`}>
                      <span className="block">{withTerms(finding.why)}</span>
                      {showGain(finding, result.incomplete) && (
                        <span className="mt-1.5 block text-xs text-ink">
                          {finding.sharedCheck ? (
                            <>Fixing this and the related findings raises your score by up to <span className="font-semibold">{finding.gain}</span> points.</>
                          ) : (
                            <>Fixing this raises your score from <span className="font-semibold">{result.score}</span> to <span className="font-semibold">{result.score + finding.gain}</span>.</>
                          )}
                        </span>
                      )}
                      <span className="mt-1.5 block"><strong>What to do:</strong> {withTerms(finding.fix)}</span>
                    </div>
                  )}

                  {openFindingIds.has(finding.id) && finding.hosts?.length > 1 && (
                    <p className="m-0 mt-1.5 px-3 text-xs font-semibold text-accent">
                      Affects {finding.hosts.length} of your {result.nodes.length} servers
                    </p>
                  )}

                  {openFindingIds.has(finding.id) && hasDetails(finding.details) && (
                    <div className="mt-1.5 px-3">
                      <button
                        type="button"
                        aria-expanded={detailsOpenIds.has(finding.id)}
                        aria-controls={`finding-details-${finding.id}`}
                        onClick={() => toggleDetails(finding.id)}
                        className="w-auto! cursor-pointer border-0! bg-transparent! p-0! text-xs! font-semibold text-accent"
                      >
                        Technical details {detailsOpenIds.has(finding.id) ? "▲" : "▼"}
                      </button>
                      {detailsOpenIds.has(finding.id) && (
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
