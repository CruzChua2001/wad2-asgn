"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";
import { LuChevronDown, LuChevronRight, LuCircleCheck, LuFolderGit2, LuGalleryHorizontal, LuGauge, LuGlobe, LuLayoutGrid, LuListChecks, LuMapPin, LuTriangleAlert } from "react-icons/lu";
import NumberTicker from "./number-ticker";
import OverviewCarousel from "./overview-carousel";
import ServerTour from "./server-tour";
import { Term, withTerms } from "./glossary";
import FixText from "./fix-text";
import { projectScore } from "./what-if";
import { useTheme } from "@/lib/theme-store";
import GradeBadge from "@/components/grade-badge";
import { useScan } from "../scan-context";
import { getRating } from "../scan-result";
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

// The Overview cards show as a carousel or the old grid, and we remember the choice
const LAYOUT_KEY = "cruz-control-overview-view-v1";
const LAYOUTS = [
  { id: "carousel", label: "Carousel", Icon: LuGalleryHorizontal },
  { id: "grid", label: "Grid", Icon: LuLayoutGrid },
];

function readLayout() {
  try {
    return localStorage.getItem(LAYOUT_KEY) === "grid" ? "grid" : "carousel";
  } catch {
    return "carousel";
  }
}

function saveLayout(layout) {
  try {
    localStorage.setItem(LAYOUT_KEY, layout);
  } catch {
    // Private windows can block storage, the toggle still works for this visit
  }
}

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
const SEVERITY_LABELS = { critical: "Critical", high: "High", medium: "Medium", low: "Low" };
const STATUS_LABELS = { healthy: "Healthy", attention: "Needs attention", critical: "Critical" };
const LEGEND = [
  { status: "healthy", label: "Healthy" },
  { status: "attention", label: "Attention" },
  { status: "critical", label: "Critical" },
];
const SEVERITY_TONES = { critical: "text-critical", high: "text-warm", medium: "text-muted", low: "text-muted" };

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

// Only link out to https pages, so a bad url can't turn into something else
function safeLearnMore(learnMore) {
  return learnMore?.url?.startsWith("https://") ? learnMore : null;
}

// Findings with no server name what was scanned, so the line never starts with a stray dot
function findingWhere(finding, result) {
  const host = result.nodes.find((node) => node.id === finding.nodeId)?.host;
  // source is already the label from SOURCE_LABELS
  const target = finding.source === "Repository" ? result.linkedRepository : result.domain;

  return host ?? target ?? null;
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

      {details.lines && (
        <div>
          <dt className="font-semibold">Lines</dt>
          {details.lines.map((item, index) => (
            <dd key={index} className="ml-0 font-mono break-all">{item.file}:{item.line} {item.text}</dd>
          ))}
        </div>
      )}

      {details.actions && (
        <div>
          <dt className="font-semibold">Actions</dt>
          {details.actions.map((item, index) => <dd key={index} className="ml-0 font-mono break-all">{item.file}: {item.uses}</dd>)}
        </div>
      )}

      {details.missing && (
        <div><dt className="inline font-semibold">Missing</dt><dd className="ml-2 inline">{details.missing.join(", ")}</dd></div>
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

// Shown in the map card when no server can be placed on the map
function noMapMessage(result) {
  if (result.nodes.length === 0) return "We didn't find any servers for this website.";
  if (result.geoStatus === "unavailable") return "We couldn't look up where these servers are right now. Try re-scanning later.";
  return "We couldn't place these servers on a map.";
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

// projected is the "What if I fix this?" estimate, or null when nothing is planned
function ScoreRing({ score, projected, reduceMotion }) {
  const planning = projected != null;
  const shown = planning ? projected : score;
  const label = planning ? `Estimate: ${projected} out of 100, now ${score}` : `${score} out of 100`;

  return (
    <div className={styles.ring} data-tone={scoreTone(shown)}>
      <svg viewBox="0 0 80 80" aria-hidden="true">
        <circle className={styles.ringTrack} cx="40" cy="40" r="33" />
        {/* The points a plan would win back, in a lighter shade past the real score */}
        {planning && (
          <motion.circle
            className={`${styles.ringValue} opacity-35`}
            cx="40"
            cy="40"
            r="33"
            initial={reduceMotion ? false : { pathLength: score / 100 }}
            animate={{ pathLength: projected / 100 }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          />
        )}
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
      <div className={styles.ringNumber} role="img" aria-label={label}>
        <strong aria-hidden="true"><NumberTicker value={shown} delay={planning ? 0 : 0.25} /></strong>
        <span className={styles.ringScale} aria-hidden="true">/100</span>
        {planning && (
          <span className="mt-[4cqi] rounded-full bg-accent/15 px-[5cqi] py-[1cqi] text-[10cqi] leading-none font-semibold text-accent" aria-hidden="true">
            +{projected - score}
          </span>
        )}
      </div>
    </div>
  );
}

function trackStyle(missing, passed) {
  if (missing) return "border border-dashed border-line";
  return passed ? "bg-accent-soft" : "bg-line";
}

// Points each category lost, worst first. The bar shows how much of that category's points are gone.
// Categories with no issues fold into one line, since the Report Card lists every category.
// A category with findings is a button that shows only those findings.
function ScoreBreakdown({ breakdown, checks, reduceMotion, findingCounts, activeCategory, onSelectCategory }) {
  const [showPassed, setShowPassed] = useState(false);
  const ran = checks.filter((check) => check.status === "ok");
  const totalWeight = ran.reduce((sum, check) => sum + check.weight, 0);

  // Nothing lost and every check perfect, so the empty track can read as good
  const passedItems = breakdown.filter((item) => item.status === "ok" && item.lost === 0
    && !ran.some((check) => check.category === item.category && check.score < 10));
  const shown = showPassed ? breakdown : breakdown.filter((item) => !passedItems.includes(item));

  return (
    <div className="w-full">
      <p className="m-0 mb-1 px-1.5 font-mono text-[10px] tracking-[.08em] text-muted uppercase">Points lost by category</p>
      <ul className="m-0 flex w-full list-none flex-col gap-0.5 p-0" aria-label="Score breakdown">
        {shown.map((item, index) => {
          // Bars fill one after another, worst first
          const delay = 0.35 + index * 0.12;
          const weight = ran.filter((check) => check.category === item.category).reduce((sum, check) => sum + check.weight, 0);
          const most = totalWeight > 0 ? (100 * weight) / totalWeight : 0;
          const share = most > 0 ? Math.min(100, (100 * item.lost) / most) : 0;
          const barColor = share >= 50 ? "bg-critical" : "bg-warm";
          const imperfect = ran.some((check) => check.category === item.category && check.score < 10);
          // A category that didn't run has no points to show, so it gets an empty dashed track
          const missing = item.status === "unavailable" || item.status === "not_checked";
          const passed = passedItems.includes(item);

          let value = <><span aria-hidden="true">✓</span> No issues</>;
          let tone = "text-accent";
          if (item.status === "unavailable") {
            value = "Couldn't check";
            tone = "text-muted";
          } else if (item.status === "not_checked") {
            value = "Not checked";
            tone = "text-muted";
          } else if (item.lost > 0) {
            value = <>-<NumberTicker value={item.lost} delay={delay} /><span className="sr-only"> points</span></>;
            tone = share >= 50 ? "text-critical" : "text-warm";
          } else if (imperfect) {
            // Lost less than a point, which rounds to 0
            value = "Minor";
            tone = "text-warm";
          }

          const count = findingCounts[item.category] ?? 0;
          const active = item.category === activeCategory;

          // Spans, not divs, since this can sit inside a button
          const row = (
            <>
              <span className="mb-1 flex justify-between gap-2.5 font-mono text-[10px] text-muted">
                <span className={active ? "text-ink" : ""}>
                  {item.label}
                  {count > 0 && <span aria-hidden="true"> · {count} {count === 1 ? "finding" : "findings"}</span>}
                </span>
                <span className="flex flex-none items-center gap-1">
                  <span id={`breakdown-value-${item.category}`} className={`font-semibold ${tone}`}>{value}</span>
                  {count > 0 && (
                    <LuChevronRight aria-hidden="true" className="text-muted transition-transform motion-safe:group-hover:translate-x-0.5" />
                  )}
                </span>
              </span>
              <span
                className={`block h-1.5 overflow-hidden rounded-full ${trackStyle(missing, passed)}`}
                aria-hidden="true"
              >
                {!missing && (
                  <motion.span
                    className={`block h-full rounded-full ${barColor} group-hover:brightness-125 group-focus-visible:brightness-125`}
                    initial={reduceMotion ? false : { width: 0 }}
                    animate={{ width: `${share}%` }}
                    transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
                  />
                )}
              </span>
            </>
          );

          return (
            <li key={item.category}>
              {count > 0 ? (
                <button
                  type="button"
                  aria-pressed={active}
                  aria-label={`Show the ${count} ${count === 1 ? "finding" : "findings"} in ${item.label}`}
                  aria-describedby={`breakdown-value-${item.category}`}
                  onClick={() => onSelectCategory(item.category)}
                  className={`group block w-full cursor-pointer rounded-md px-1.5 py-1 text-left transition-colors hover:bg-accent-soft/30 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent ${active ? "bg-accent-soft/50" : ""}`}
                >
                  {row}
                </button>
              ) : (
                <div className="px-1.5 py-1">{row}</div>
              )}
            </li>
          );
        })}
      </ul>
      {passedItems.length > 0 && (
        <p className="m-0 mt-1.5 flex gap-2.5 px-1.5 font-mono text-[10px] font-semibold">
          {!showPassed && (
            <span className="text-accent">
              <span aria-hidden="true">✓</span>{" "}
              {shown.length === 0 ? `All ${passedItems.length} categories have no issues` : `${passedItems.length} more with no issues`}
            </span>
          )}
          <button type="button" className="ml-auto cursor-pointer text-accent hover:underline" aria-expanded={showPassed} onClick={() => setShowPassed(!showPassed)}>
            {showPassed ? "Show fewer" : "Show all"}
          </button>
        </p>
      )}
    </div>
  );
}

// Servers whose location lookup failed stay in the lists, without a place
function locationLabel(node) {
  if (!node.located) {
    return "Location unknown";
  }
  return `${node.city}, ${node.country}`;
}

function countOf(count, word) {
  return `${count} ${count === 1 ? word : `${word}s`}`;
}

// The second part of a carousel tab summary. Phones only keep the first part
function TabNote({ tone, children }) {
  return <span className={`truncate text-xs font-semibold max-md:hidden ${tone}`}>{children}</span>;
}

function CdnBadge() {
  return (
    <span className="ml-1.5 rounded-sm border border-line px-1 text-[9px] font-medium text-muted align-middle">CDN</span>
  );
}

// The scan layout only renders this tab once a finished scan exists.
export default function OverviewTab() {
  const { result, lines } = useScan();
  const [theme] = useTheme();
  const reduceMotion = Boolean(useReducedMotion());
  const findings = [...result.findings].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  // The Report Card links to /scan/<id>?finding=<finding id>, so that finding opens first
  const searchParams = useSearchParams();
  const [linkedId] = useState(() => findings.find((finding) => finding.id === searchParams.get("finding"))?.id ?? null);
  const firstFinding = findings.find((finding) => finding.id === linkedId) ?? findings[0];
  const [selectedFindingId, setSelectedFindingId] = useState(firstFinding?.id);
  const [selectedNodeId, setSelectedNodeId] = useState(firstFinding?.nodeId || result.nodes[0]?.id);
  const [logOpen, setLogOpen] = useState(false);
  const [showAllServers, setShowAllServers] = useState(false);
  const [mapView, setMapView] = useState("globe");
  const [openFindingIds, setOpenFindingIds] = useState(() => new Set(firstFinding ? [firstFinding.id] : []));
  const [detailsOpenIds, setDetailsOpenIds] = useState(() => new Set());
  const [filterNodeId, setFilterNodeId] = useState(null);
  // Picked from the score breakdown. Only one filter is on at a time
  const [filterCategory, setFilterCategory] = useState(null);
  const [ruleOpen, setRuleOpen] = useState(false);
  const [layout, setLayout] = useState(readLayout);
  // The card in front of the carousel. A Report Card link starts on the findings
  const [activeCard, setActiveCard] = useState(linkedId ? "findings" : null);
  // "What if I fix this?": findings the user plans to fix. Only kept for this visit
  const [plannedIds, setPlannedIds] = useState(() => new Set());
  // "Tour my servers" on the globe: "off", "playing" or "paused"
  const [tour, setTour] = useState("off");
  // Picked from the map legend: "healthy", "attention", "critical" or null for every server
  const [statusFilter, setStatusFilter] = useState(null);
  const carousel = layout === "carousel";

  // Other code (like the product tour) can bring a card to the front with this event
  useEffect(() => {
    function handleCard(event) {
      setActiveCard(event.detail);
      if (event.detail !== "map") setTour("off");
    }

    window.addEventListener("cruz:overview-card", handleCard);
    return () => window.removeEventListener("cruz:overview-card", handleCard);
  }, []);

  useEffect(() => {
    if (linkedId) {
      document.getElementById(`finding-${linkedId}`)?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
    }
  }, [linkedId, reduceMotion]);

  const locatedNodes = result.nodes.filter((node) => node.located);

  const selectedNode = result.nodes.find((node) => node.id === selectedNodeId) || result.nodes[0];
  let selectedFinding = findings.find((finding) => finding.id === selectedFindingId);
  // Light up every server the selected finding affects. DNS and repo findings have no hosts
  const highlightIds = selectedFinding?.hosts ?? [];

  // The status filter keeps only those servers in the list, and fades the rest on the globe and map
  const statusNodes = statusFilter ? result.nodes.filter((node) => node.status === statusFilter) : result.nodes;
  const dimIds = statusFilter ? result.nodes.filter((node) => node.status !== statusFilter).map((node) => node.id) : [];

  // The short list still shows every server the selected finding affects.
  // Bigger screens show the first 6, and phones hide all but the first 3 in the list below
  let shownNodes = statusNodes;
  if (!showAllServers) {
    shownNodes = statusNodes.filter((node, index) => index < 6 || highlightIds.includes(node.id));
  }

  const affectsNode = (finding, nodeId) => Boolean(finding.hosts?.includes(nodeId));
  // Server details only shows the fix for a finding on that server
  const nodeFinding = selectedNode && selectedFinding && affectsNode(selectedFinding, selectedNode.id)
    ? selectedFinding
    : findings.find((finding) => selectedNode && affectsNode(finding, selectedNode.id));
  const nodeFindingCount = selectedNode ? findings.filter((finding) => affectsNode(finding, selectedNode.id)).length : 0;
  const filterNode = result.nodes.find((node) => node.id === filterNodeId);
  const categoryCounts = findings.reduce((counts, finding) => ({ ...counts, [finding.category]: (counts[finding.category] || 0) + 1 }), {});
  const filterLabel = result.breakdown?.find((item) => item.category === filterCategory)?.label ?? filterCategory;

  let shownFindings = findings;
  if (filterNode) {
    shownFindings = findings.filter((finding) => affectsNode(finding, filterNode.id));
  } else if (filterCategory) {
    shownFindings = findings.filter((finding) => finding.category === filterCategory);
  }
  const allFindingsOpen = shownFindings.length > 0 && shownFindings.every((finding) => openFindingIds.has(finding.id));

  const statusCounts = result.nodes.reduce((counts, node) => ({ ...counts, [node.status]: (counts[node.status] || 0) + 1 }), {});

  let repoInfo = null;
  if (result.repo) {
    repoInfo = result.repo.records.repo;
  }

  // The repo's scored checks, so the card always matches the score
  const repoChecks = (result.checks ?? []).filter((check) => REPO_CATEGORIES.includes(check.category));

  const seriousFindings = findings.filter((finding) => finding.severity === "critical" || finding.severity === "high");

  // How much of the scan the score is really based on (T20)
  const ranChecks = (result.checks ?? []).filter((check) => check.status === "ok").length;
  const missedChecks = (result.checks ?? []).filter((check) => check.status === "unavailable").length;

  // Viewers of a project scan can't re-scan, so the notes tell them who can
  const canRescan = !result.projectId || result.role === "owner";
  const retryText = canRescan ? "Re-scan to try again." : "A project owner can re-scan to try again.";

  // A finding can be planned when fixing it could raise the score. Old scans have no checks,
  // and incomplete scans have no grade, so neither gets the plan
  const canPlan = !result.incomplete && (result.checks ?? []).length > 0;
  function isPlannable(finding) {
    const check = canPlan && finding.checkId ? result.checks.find((item) => item.id === finding.checkId) : null;
    return Boolean(check) && check.status === "ok" && check.score < 10;
  }
  const plannableCount = findings.filter(isPlannable).length;
  const plannedCount = findings.filter((finding) => plannedIds.has(finding.id) && isPlannable(finding)).length;
  const projection = plannedCount > 0 ? projectScore(result.checks, result.findings, plannedIds) : null;
  const planText = plannedCount === 1 ? "1 planned finding" : `${plannedCount} planned findings`;

  let planCapNote = null;
  if (projection && result.cap?.applied) {
    planCapNote = projection.capped
      ? "Still capped at 50 until every critical problem is fixed."
      : "No longer capped at 50.";
  }

  function openFinding(id) {
    setOpenFindingIds((open) => new Set(open).add(id));
  }

  // The tour uses this on its own, so it moves Server details along without opening findings
  function showNode(nodeId) {
    const finding = findings.find((item) => affectsNode(item, nodeId));
    setSelectedNodeId(nodeId);
    setSelectedFindingId(finding?.id ?? null);
    return finding;
  }

  function selectNode(nodeId) {
    const finding = showNode(nodeId);

    if (finding) {
      openFinding(finding.id);
    }
  }

  // A server the status filter hides brings every server back, so it shows in the list
  function unhideNode(nodeId) {
    const node = result.nodes.find((item) => item.id === nodeId);
    if (statusFilter && node && node.status !== statusFilter) setStatusFilter(null);
  }

  // Picking a server by hand stops the tour
  function pickNode(nodeId) {
    setTour("off");
    unhideNode(nodeId);
    selectNode(nodeId);
  }

  // Clicking the active status again shows every server. The tour stops either way
  function changeStatusFilter(status) {
    const next = status === statusFilter ? null : status;
    setStatusFilter(next);
    setTour("off");

    const match = result.nodes.find((node) => node.status === next);
    if (match && selectedNode?.status !== next) {
      selectNode(match.id);
    }
  }

  function changeMapView(view) {
    setMapView(view);
    if (view !== "globe") setTour("off");
  }

  // The grid still shows the map, but the carousel might be on another card
  function changeLayout(next) {
    setLayout(next);
    saveLayout(next);
    if (next === "carousel" && activeCard !== "map") setTour("off");
  }

  function changeCard(key) {
    setActiveCard(key);
    if (key !== "map") setTour("off");
  }

  function handleMapKey(event) {
    if (event.key === "Escape" && tour !== "off") setTour("off");
  }

  // Dragging the globe pauses the tour. Clicks on the buttons over it don't
  function handleStagePointer(event) {
    if (tour === "playing" && event.target.tagName === "CANVAS") setTour("paused");
  }

  // Brings a card into view: in the carousel it turns to the front and the page scrolls up to the tabs,
  // in the grid the page scrolls down to it
  function goToCard(key, titleId) {
    const behavior = reduceMotion ? "auto" : "smooth";
    setTour("off");

    if (!carousel) {
      document.getElementById(titleId)?.closest("section")?.scrollIntoView({ behavior, block: "start" });
      return;
    }

    setActiveCard(key);
    document.getElementById("overview-carousel")?.scrollIntoView({ behavior, block: "start" });
  }

  // On phones the findings card is further down, so bring it into view
  function showNodeFindings(nodeId) {
    const finding = findings.find((item) => affectsNode(item, nodeId));
    setFilterNodeId(nodeId);
    setFilterCategory(null);

    if (finding) {
      setSelectedFindingId(finding.id);
      openFinding(finding.id);
    }

    goToCard("findings", "findings-title");
  }

  // A category in the score breakdown shows only its findings and opens the first one.
  // Clicking the same category again clears it
  function showCategory(category) {
    if (category === filterCategory) {
      setFilterCategory(null);
      return;
    }

    const finding = findings.find((item) => item.category === category);
    setFilterCategory(category);
    setFilterNodeId(null);

    if (finding) {
      setSelectedFindingId(finding.id);
      if (finding.nodeId) setSelectedNodeId(finding.nodeId);
      openFinding(finding.id);
    }

    goToCard("findings", "findings-title");
  }

  // "See on map" in a finding picks its server and turns to the map, where the globe flies to it
  function seeOnMap(finding) {
    setSelectedFindingId(finding.id);
    setSelectedNodeId(finding.nodeId);
    unhideNode(finding.nodeId);
    goToCard("map", "map-title");
  }

  // Findings open and close on their own, and the last one opened drives the map highlight
  function toggleFinding(finding) {
    const open = new Set(openFindingIds);
    setTour("off");

    if (open.has(finding.id)) {
      open.delete(finding.id);
      if (finding.id === selectedFindingId) {
        setSelectedFindingId(null);
      }
    } else {
      open.add(finding.id);
      setSelectedFindingId(finding.id);
      // DNS and repo findings have no server, so keep the one already selected
      if (finding.nodeId) setSelectedNodeId(finding.nodeId);
    }

    setOpenFindingIds(open);
  }

  // "Show them" in the score card opens the serious findings and scrolls to them
  function showSerious() {
    setFilterNodeId(null);
    setFilterCategory(null);
    setOpenFindingIds(new Set(seriousFindings.map((finding) => finding.id)));
    setSelectedFindingId(seriousFindings[0].id);
    if (seriousFindings[0].nodeId) setSelectedNodeId(seriousFindings[0].nodeId);
    goToCard("findings", "findings-title");
  }

  function togglePlan(id) {
    const next = new Set(plannedIds);

    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }

    setPlannedIds(next);
  }

  function clearPlan() {
    setPlannedIds(new Set());
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

  const mapCard = result.domain && (
    <motion.section className={`${styles.mapCard} self-start`} aria-labelledby="map-title" onKeyDown={handleMapKey} {...reveal(0.15)}>
      <div className={styles.cardHead}>
        <h2 id="map-title">Where your servers are</h2>
        {/* Each status is a toggle that shows only those servers */}
        <div className={`${styles.legend} items-center gap-1!`} role="group" aria-label="Filter servers by status">
          {LEGEND.map(({ status, label }) => (
            <button
              key={status}
              type="button"
              data-status={status}
              aria-pressed={statusFilter === status}
              disabled={!statusCounts[status]}
              onClick={() => changeStatusFilter(status)}
              className="inline-flex min-h-6 cursor-pointer items-center gap-1.5 rounded-full border border-transparent px-2 py-0.5 transition-colors hover:bg-accent-soft/30 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent aria-pressed:border-line aria-pressed:bg-accent-soft/50 aria-pressed:text-ink disabled:cursor-default disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-muted"
            >
              <i aria-hidden="true" />{label} {statusCounts[status] || 0}
            </button>
          ))}
          {statusFilter && (
            <button type="button" onClick={() => changeStatusFilter(null)} className="ml-1 min-h-6 cursor-pointer font-semibold! text-accent hover:underline">
              Show all
            </button>
          )}
        </div>
      </div>

      {/* Phones get the same map and server list as bigger screens, just smaller */}
      {locatedNodes.length > 0 ? (
        <div id="map-stage" className={`${styles.globeStage} flex-none h-75 md:h-[clamp(340px,50vh,480px)]`} onPointerDown={handleStagePointer}>
          <div role="group" aria-label="Map view" className="absolute top-3 left-3 z-[2] flex overflow-hidden rounded-md border border-line bg-surface-strong text-xs font-semibold">
            {Object.entries(MAP_VIEWS).map(([view, label]) => (
              <button
                key={view}
                type="button"
                aria-pressed={mapView === view}
                onClick={() => changeMapView(view)}
                className={`cursor-pointer px-3 py-1.5 focus-visible:-outline-offset-2! ${mapView === view ? "bg-accent-soft text-ink" : "text-muted"}`}
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
              dimIds={dimIds}
              onSelect={pickNode}
              theme={theme}
              grade={result.grade}
              reduceMotion={reduceMotion}
            />
          ) : (
            <ServerMap
              nodes={result.nodes}
              arcs={result.arcs}
              selectedId={selectedNode.id}
              highlightIds={highlightIds}
              dimIds={dimIds}
              onSelect={pickNode}
              reduceMotion={reduceMotion}
            />
          )}
          {/* With a status filter on, the tour only visits those servers */}
          {mapView === "globe" && (
            <ServerTour
              nodes={statusNodes}
              findings={findings}
              mainHost={result.domain}
              onSelect={showNode}
              reduceMotion={reduceMotion}
              tour={tour}
              onTourChange={setTour}
            />
          )}
          {/* The tour caption sits where the hint goes */}
          {tour === "off" && (
            <p className={styles.globeHint}>
              {mapView === "globe" ? "Drag to spin · click a dot or a server below" : "Ctrl + scroll or pinch to zoom, drag to move · click a dot or a server below"}
            </p>
          )}
        </div>
      ) : (
        <p className="m-0 border-b border-line px-4 py-8 text-center text-sm text-muted">
          {noMapMessage(result)}
        </p>
      )}

      {result.arcs.length > 0 && (
        <p className="m-0 px-4 py-2 text-center text-xs text-muted">
          Lines connect your main site to your other servers. They don&apos;t show real traffic.
        </p>
      )}

      {result.nodes.length > 0 && (
      <div className={styles.nodeList} role="group" aria-label="Servers">
        {shownNodes.map((node, index) => (
          <button
            key={node.id}
            type="button"
            data-status={node.status}
            className={`${node.id === selectedNode.id ? styles.nodeActive : ""} ${highlightIds.includes(node.id) ? "ring-1 ring-accent" : ""} ${!showAllServers && index >= 3 && !highlightIds.includes(node.id) ? "max-md:hidden!" : ""}`}
            aria-pressed={node.id === selectedNode.id}
            onClick={() => pickNode(node.id)}
          >
            <i aria-hidden="true" />
            <span>
              <strong>{node.host}{node.isCdn && <CdnBadge />}</strong>
              <small>{locationLabel(node)} · {node.service}</small>
            </span>
          </button>
        ))}

        {statusNodes.length > 3 && (
          <button type="button" className={`col-span-full justify-self-start border-0! bg-transparent! p-0! text-sm! text-accent! font-semibold! mt-1 cursor-pointer ${statusNodes.length > 6 ? "" : "md:hidden!"}`} onClick={() => setShowAllServers(!showAllServers)}>
            {showAllServers ? "Show fewer servers" : `Show all ${statusNodes.length} servers`}
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
                {filterNodeId === selectedNode.id ? (
                  <span>
                    Showing only these ·{" "}
                    <button type="button" onClick={() => setFilterNodeId(null)} className="cursor-pointer font-semibold! text-accent">
                      Show all
                    </button>
                  </span>
                ) : (
                  <button type="button" onClick={() => showNodeFindings(selectedNode.id)} className="cursor-pointer font-semibold! text-accent">
                    Show only these
                  </button>
                )}
              </p>
            )}
            {nodeFinding ? (
              <div className={styles.fix}>
                <h3>What to do</h3>
                {/* A one-line fix is a span, which .fix p doesn't style, so size it here */}
                <div className="text-[12px] leading-relaxed text-muted">
                  <FixText text={nodeFinding.fix} label={null} />
                </div>
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
          <span className={styles.logLast}>{lines.length > 0 ? lines.at(-1).text : "No logs for this scan"}</span>
          <span className={styles.logChevron} aria-hidden="true">{logOpen ? "▲" : "▼"}</span>
        </button>
        {/* Logs live in the scan context, so a reload or a scan opened later has none */}
        {logOpen && lines.length === 0 && (
          <p id="scan-log" className={`${styles.logBody} text-[#6f8279]`}>
            Logs are only kept while a scan runs in this tab. Re-scan to see them.
          </p>
        )}
        {logOpen && lines.length > 0 && (
          <ol id="scan-log" className={styles.logBody}>
            {lines.map((line) => (
              <li key={line.id} data-kind={line.kind}><time>{line.time}</time><span>{line.text}</span></li>
            ))}
          </ol>
        )}
      </div>
    </motion.section>
  );

  const repoCard = result.nodes.length === 0 && repoInfo && (
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
  );

  const scoreCard = (
    <motion.section className={`${styles.card} ${styles.scoreCard} ${carousel ? styles.scoreWide : ""}`} aria-labelledby="score-title" {...reveal(0.2)}>
      <div className={styles.cardHead}>
        <h2 id="score-title">Exposure score</h2>
        {projection ? (
          <span className={styles.ratingBadge} data-tone={scoreTone(projection.score)}>Estimate</span>
        ) : (
          <span className={styles.ratingBadge} data-tone={result.incomplete ? "warn" : scoreTone(result.score)}>
            {result.incomplete ? (canRescan ? "Incomplete, re-scan" : "Incomplete") : getRating(result.score)}
          </span>
        )}
      </div>
      <div className={styles.scoreBody}>
        <div className="flex flex-col items-center gap-2.5">
          {/* The grade sits on the ring like a stamp */}
          <div className="relative">
            <ScoreRing score={result.score} projected={projection?.score ?? null} reduceMotion={reduceMotion} />
            <motion.span
              className="absolute -right-2 -bottom-1 rotate-[-8deg] rounded-xl bg-surface-strong shadow-md"
              initial={reduceMotion ? false : { scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.35, delay: 1.1, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* A new grade lands like a fresh stamp */}
              <motion.span
                key={projection?.grade ?? result.grade}
                className="block"
                initial={reduceMotion || !projection ? false : { scale: 1.6, opacity: 0, rotate: 14 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              >
                <GradeBadge grade={projection?.grade ?? result.grade} size="md" />
              </motion.span>
            </motion.span>
          </div>
          {projection && (
            <p className="m-0 font-mono text-[11px] text-muted">
              Grade {result.grade} <span aria-hidden="true">→</span><span className="sr-only">to</span>{" "}
              <span className="font-semibold text-ink">{projection.grade}</span>
            </p>
          )}
        </div>
        {result.checks?.length > 0 && (
          <ScoreBreakdown
            breakdown={result.breakdown}
            checks={result.checks}
            reduceMotion={reduceMotion}
            findingCounts={categoryCounts}
            activeCategory={filterCategory}
            onSelectCategory={showCategory}
          />
        )}
      </div>

      {projection && (
        <div className="mt-4 rounded-lg border border-dashed border-accent/50 bg-accent/5 p-3 text-xs text-muted">
          <div className="flex items-center justify-between gap-3">
            <p className="m-0 text-sm font-semibold text-ink">Estimate if you fix {planText}</p>
            <button type="button" onClick={clearPlan} className="flex-none cursor-pointer font-semibold! text-accent hover:underline">
              Reset
            </button>
          </div>
          <p className="m-0 mt-1">
            Your real score is still {result.score}. Fixing {plannedCount === 1 ? "it" : "them"} would take it to{" "}
            <span className="font-semibold text-ink">{projection.score}</span>, grade{" "}
            <span className="font-semibold text-ink">{projection.grade}</span>. Re-scan after fixing to see it for real.
          </p>
          {planCapNote && (
            <p className={`m-0 mt-1 ${projection.capped ? "text-critical" : "text-accent"}`}>{planCapNote}</p>
          )}
        </div>
      )}
      {!projection && plannableCount > 0 && (
        <p className="m-0 mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
          Want to see your score go up? Tick &quot;Plan to fix&quot; on findings.
          <button type="button" onClick={() => goToCard("findings", "findings-title")} className="cursor-pointer font-semibold! text-accent hover:underline">
            Go to findings
          </button>
        </p>
      )}

      {seriousFindings.length > 0 ? (
        <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-critical/30 bg-critical/8 p-3 text-sm text-ink">
          <LuTriangleAlert aria-hidden="true" className="mt-0.5 flex-none text-critical" />
          <p className="m-0 flex-1">{result.summary}</p>
          <button type="button" onClick={showSerious} className="flex-none cursor-pointer text-xs! font-semibold! text-critical hover:underline">
            Show {seriousFindings.length === 1 ? "it" : "them"}
          </button>
        </div>
      ) : !result.incomplete && result.score >= 80 ? (
        <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-accent/30 bg-accent/8 p-3 text-sm text-ink">
          <LuCircleCheck aria-hidden="true" className="mt-0.5 flex-none text-accent" />
          <p className="m-0">{result.summary}</p>
        </div>
      ) : (
        // No serious problems, but the score is still low or not every check ran
        <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-warm/30 bg-warm/8 p-3 text-sm text-ink">
          <LuTriangleAlert aria-hidden="true" className="mt-0.5 flex-none text-warm" />
          <p className="m-0">
            {result.incomplete
              ? "No serious problems in the checks that ran."
              : "No serious problems, but the smaller ones add up. Start with the ones worth the most points."}
          </p>
        </div>
      )}
      {result.cap?.applied && result.uncappedScore > result.score && (
        <p className="m-0 mt-3 text-xs text-critical">
          Capped at 50 until the critical {result.cap.checkIds.length > 1 ? "problems are" : "problem is"} fixed. Without the cap, you&apos;d score {result.uncappedScore}.
        </p>
      )}
      {result.incomplete && (
        <p className="m-0 mt-3 text-xs text-warm">
          A critical check couldn&apos;t run, so there&apos;s no grade yet. {retryText}
        </p>
      )}
      {result.breakdown?.some((item) => item.status === "unavailable") && (
        <p className="m-0 mt-3 text-xs text-muted">
          &quot;Couldn&apos;t check&quot; means a free lookup service didn&apos;t answer. It isn&apos;t counted in your score. {retryText}
        </p>
      )}
      {result.breakdown?.some((item) => item.status === "not_checked") && (
        <p className="m-0 mt-3 text-xs text-muted">
          &quot;Not checked&quot; means the check doesn&apos;t apply here, or this scan is older than the check. {canRescan ? "Re-scan to run every check." : "A new scan runs every check."}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-line pt-3 text-xs text-muted">
        {result.checks?.length > 0 && (
          <span>
            Based on {ranChecks} {ranChecks === 1 ? "check" : "checks"}.
            {missedChecks > 0 && ` ${missedChecks} couldn't run and ${missedChecks === 1 ? "isn't" : "aren't"} counted.`}
          </span>
        )}
        <button
          type="button"
          aria-expanded={ruleOpen}
          aria-controls="score-rule"
          onClick={() => setRuleOpen(!ruleOpen)}
          className="ml-auto inline-flex cursor-pointer items-center gap-1 text-xs! font-semibold! text-accent hover:underline"
        >
          How is this scored?
          <LuChevronDown aria-hidden="true" className={`transition-transform ${ruleOpen ? "rotate-180" : ""}`} />
        </button>
      </div>
      {ruleOpen && <p id="score-rule" className="m-0 mt-2 text-xs leading-relaxed text-muted">{SCORE_RULE}</p>}
    </motion.section>
  );

  // While planning the card lets the plan bar stick to the top of the page
  const findingsCard = (
    <motion.section className={`${styles.card} ${styles.findingsCard} ${projection ? "overflow-visible!" : ""}`} aria-labelledby="findings-title" {...reveal(0.27)}>
      <div className={styles.cardHead}>
        <h2 id="findings-title">Findings · worst first</h2>
        <span className="flex items-center gap-3">
          {shownFindings.length > 0 && (
            <button type="button" onClick={toggleAllFindings} className="cursor-pointer text-xs! font-semibold! text-accent">
              {allFindingsOpen ? "Collapse all" : "Expand all"}
            </button>
          )}
          <span className={styles.count}><NumberTicker value={shownFindings.length} delay={0.3} /></span>
        </span>
      </div>
      {projection && (
        <div className="sticky top-0 z-10 mb-3 rounded-lg border border-accent/40 bg-surface-strong px-3 py-2 text-xs text-muted shadow-sm">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <p className="m-0 flex-auto text-ink">
              <span className="font-semibold">Plan: {plannedCount} {plannedCount === 1 ? "fix" : "fixes"}</span>
              {" · "}
              <span className="whitespace-nowrap">
                {result.score} <span aria-hidden="true">→</span><span className="sr-only">to</span>{" "}
                <span className="font-semibold text-accent">{projection.score}</span>
              </span>
              <span className="ml-2 whitespace-nowrap font-mono text-muted">
                {result.grade} <span aria-hidden="true">→</span><span className="sr-only">to</span> {projection.grade}
              </span>
            </p>
            <button type="button" onClick={() => goToCard("score", "score-title")} className="cursor-pointer font-semibold! text-accent hover:underline">
              See on score card
            </button>
            <button type="button" onClick={clearPlan} className="cursor-pointer text-muted hover:text-ink">
              Clear
            </button>
          </div>
          {projection.partialCheckIds.length > 0 && (
            <p className="m-0 mt-1">Some ticks share points with other findings. Tick the related findings too to count them.</p>
          )}
        </div>
      )}
      {filterNode && (
        <p className="m-0 mb-3 text-xs text-muted">
          Showing findings for <span className="font-mono text-ink">{filterNode.host}</span> ·{" "}
          <button type="button" onClick={() => setFilterNodeId(null)} className="cursor-pointer font-semibold! text-accent">
            Show all
          </button>
        </p>
      )}
      {!filterNode && filterCategory && (
        <p className="m-0 mb-3 text-xs text-muted">
          Showing findings for <span className="font-semibold text-ink">{filterLabel}</span> ·{" "}
          <button type="button" onClick={() => setFilterCategory(null)} className="cursor-pointer font-semibold! text-accent">
            Show all
          </button>
        </p>
      )}
      <ul className={styles.findings}>
        {shownFindings.map((finding) => (
          // A plannable finding gets a second column with its "Plan to fix" box, outside the row button
          <li
            key={finding.id}
            id={`finding-${finding.id}`}
            className={`scroll-mt-4 ${isPlannable(finding) ? "grid grid-cols-[minmax(0,1fr)_auto] gap-x-1.5" : ""}`}
          >
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
              <small>{findingWhere(finding, result) ? `${findingWhere(finding, result)} · ` : ""}{finding.source}</small>
            </button>

            {isPlannable(finding) && (
              <label className="flex w-15 cursor-pointer flex-col items-center justify-center gap-1 rounded-[7px] border border-line px-1 text-center font-mono text-[9px] leading-tight font-semibold tracking-[.04em] text-muted uppercase transition-colors hover:border-accent hover:text-accent has-checked:border-accent has-checked:bg-accent-soft/40 has-checked:text-accent">
                <input
                  type="checkbox"
                  checked={plannedIds.has(finding.id)}
                  onChange={() => togglePlan(finding.id)}
                  aria-label={`Plan to fix: ${finding.title}`}
                  className="size-3.5 cursor-pointer accent-accent"
                />
                Plan to fix
              </label>
            )}

            {openFindingIds.has(finding.id) && (
              <div className={`${styles.findingWhy} col-span-full px-3`}>
                <span className="block">{withTerms(finding.why)}</span>
                {safeLearnMore(finding.learnMore) && (
                  <a
                    href={finding.learnMore.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-xs! text-accent underline"
                  >
                    {finding.learnMore.label} <span aria-hidden="true">↗</span>
                  </a>
                )}
                {showGain(finding, result.incomplete) && (
                  <span className="mt-1.5 block text-xs text-ink">
                    {finding.sharedCheck ? (
                      <>Fixing this and the related findings raises your score by up to <span className="font-semibold">{finding.gain}</span> points.</>
                    ) : (
                      <>Fixing this raises your score from <span className="font-semibold">{result.score}</span> to <span className="font-semibold">{result.score + finding.gain}</span>.</>
                    )}
                  </span>
                )}
                <FixText text={finding.fix} />
              </div>
            )}

            {openFindingIds.has(finding.id) && finding.nodeId && (
              <p className="col-span-full m-0 mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 px-3 text-xs font-semibold text-accent">
                {finding.hosts?.length > 1 && <span>Affects {finding.hosts.length} of your {result.nodes.length} servers</span>}
                {result.domain && (
                  <button
                    type="button"
                    onClick={() => seeOnMap(finding)}
                    className="inline-flex! w-auto! cursor-pointer items-center gap-1 border-0! bg-transparent! p-0! text-accent! hover:underline"
                  >
                    <LuMapPin aria-hidden="true" /> See on map
                  </button>
                )}
              </p>
            )}

            {openFindingIds.has(finding.id) && hasDetails(finding.details) && (
              <div className="col-span-full mt-1.5 px-3">
                <button
                  type="button"
                  aria-expanded={detailsOpenIds.has(finding.id)}
                  aria-controls={`finding-details-${finding.id}`}
                  onClick={() => toggleDetails(finding.id)}
                  className="w-auto! cursor-pointer border-0! bg-transparent! p-0! text-xs! font-semibold! text-accent"
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
  );

  // Each carousel tab shows a short summary of its card
  let serverNote = <TabNote tone="text-accent">All healthy</TabNote>;
  if (statusCounts.critical) {
    serverNote = <TabNote tone="text-critical">{statusCounts.critical} critical</TabNote>;
  } else if (statusCounts.attention) {
    serverNote = <TabNote tone="text-warm">{statusCounts.attention} {statusCounts.attention === 1 ? "needs" : "need"} attention</TabNote>;
  }
  const serverSummary = (
    <>
      <span className="truncate font-semibold">{countOf(result.nodes.length, "server")}</span>
      {result.nodes.length > 0 && serverNote}
    </>
  );

  const repoSummary = repoInfo && (
    <>
      <span className="truncate font-semibold">{repoInfo.name}</span>
      <TabNote tone="text-muted">{countOf(repoChecks.length, "check")}</TabNote>
    </>
  );

  let scoreNote = <span className="flex-none max-md:hidden"><GradeBadge grade={result.grade} size="sm" /></span>;
  if (projection) {
    scoreNote = <span className="flex-none max-md:hidden"><GradeBadge grade={projection.grade} size="sm" /></span>;
  } else if (result.incomplete) {
    scoreNote = <TabNote tone="text-warm">Incomplete</TabNote>;
  }
  const scoreSummary = (
    <>
      <span className="truncate text-base font-semibold max-md:text-sm">
        {result.score}
        {projection && (
          <>
            {" "}<span aria-hidden="true">→</span><span className="sr-only">to</span> {projection.score}
          </>
        )}
      </span>
      {scoreNote}
    </>
  );

  const worst = findings[0]?.severity;
  const worstCount = findings.filter((finding) => finding.severity === worst).length;
  const findingsSummary = (
    <>
      <span className="truncate font-semibold">{findings.length > 0 ? countOf(findings.length, "finding") : "No findings"}</span>
      {worst && <TabNote tone={SEVERITY_TONES[worst]}>{worstCount} {worst}</TabNote>}
    </>
  );

  const slides = [];
  slides.push({ key: "score", label: "Score", Icon: LuGauge, summary: scoreSummary, node: scoreCard });
  if (mapCard) slides.push({ key: "map", label: "Servers", Icon: LuGlobe, summary: serverSummary, node: mapCard });
  if (repoCard) slides.push({ key: "repo", label: "Repository", Icon: LuFolderGit2, summary: repoSummary, node: repoCard });
  slides.push({ key: "findings", label: "Findings", Icon: LuListChecks, summary: findingsSummary, node: findingsCard });

  const layoutToggle = (
    <div role="group" aria-label="Overview layout" className="flex overflow-hidden rounded-md border border-line bg-surface-strong text-xs font-semibold">
      {LAYOUTS.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          aria-pressed={layout === id}
          onClick={() => changeLayout(id)}
          className={`inline-flex cursor-pointer items-center gap-1.5 px-3 py-1.5 focus-visible:-outline-offset-2! ${layout === id ? "bg-accent-soft text-ink" : "text-muted hover:text-ink"}`}
        >
          <Icon aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );

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

      {/* Outside the cards, since the carousel hides the cards that aren't in front */}
      <p className="sr-only" aria-live="polite">
        {projection
          ? `If you fix ${plannedCount} ${plannedCount === 1 ? "finding" : "findings"}, your score would go from ${result.score} to ${projection.score}, grade ${projection.grade}.`
          : ""}
      </p>

      {carousel ? (
        <OverviewCarousel
          slides={slides}
          active={activeCard}
          onChange={changeCard}
          reduceMotion={reduceMotion}
          controls={layoutToggle}
        />
      ) : (
        <>
          <div className="mb-3 flex justify-end">{layoutToggle}</div>
          <div className={styles.grid}>
            {mapCard}
            {repoCard}
            <div className={`${styles.sideColumn} self-start`}>
              {scoreCard}
              {findingsCard}
            </div>
          </div>
        </>
      )}
    </>
  );
}
