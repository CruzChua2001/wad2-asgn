"use client";

import dynamic from "next/dynamic";
import { motion } from "motion/react";
import { useState } from "react";
import NumberTicker from "../../components/number-ticker";
import RippleButton from "../../components/ripple-button";
import styles from "./scan-results.module.css";

const ExposureGlobe = dynamic(() => import("../../components/exposure-globe"), {
  ssr: false,
  loading: () => <div className={styles.globeLoading}>Loading infrastructure map…</div>,
});

const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
const SEVERITY_LABELS = { critical: "Critical", high: "High", medium: "Medium", low: "Low" };
const STATUS_LABELS = { healthy: "Healthy", attention: "Needs attention", critical: "Critical" };

// Secondary navbar for completed scan
const RESULT_TABS = [
  { id: "vulnerabilities", label: "Vulnerabilities" },
  { id: "repository", label: "Repository", requiresRepository: true },
  { id: "fix-guide", label: "Fix Guide" },
  { id: "checklist", label: "Checklist" },
  { id: "report-card", label: "Report Card" },
  { id: "compare", label: "Compare" },
];

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

function ResultTabs({ hasRepository, findingsCount }) {
  const tabs = RESULT_TABS.filter((tab) => !tab.requiresRepository || hasRepository);
  return (
    <nav className={styles.tabs} aria-label="Scan result sections">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={tab.id === "vulnerabilities" ? styles.tabActive : ""}
          aria-current={tab.id === "vulnerabilities" ? "page" : undefined}
        >
          {tab.label}
          {tab.id === "vulnerabilities" && <span className={styles.tabCount}>{findingsCount}</span>}
        </button>
      ))}
    </nav>
  );
}

export default function ScanResults({ result, lines, theme, reduceMotion, onNewScan }) {
  const findings = [...result.findings].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
  const [selectedFindingId, setSelectedFindingId] = useState(findings[0]?.id);
  const [selectedNodeId, setSelectedNodeId] = useState(findings[0]?.nodeId || result.nodes[0]?.id);
  const [logOpen, setLogOpen] = useState(false);

  const selectedNode = result.nodes.find((node) => node.id === selectedNodeId) || result.nodes[0];
  const selectedFinding = findings.find((finding) => finding.id === selectedFindingId && finding.nodeId === selectedNode.id)
    || findings.find((finding) => finding.nodeId === selectedNode.id);
  const statusCounts = result.nodes.reduce((counts, node) => ({ ...counts, [node.status]: (counts[node.status] || 0) + 1 }), {});

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
    <div className={styles.results}>
      <motion.header className={styles.resultsHead} {...reveal(0)}>
        <div>
          <h1>{result.domain}</h1>
          <p className={styles.meta}>
            Scanned just now · {result.sample ? "Sample data" : "Public sources"}
            {result.linkedRepository && <> · Linked to {result.linkedRepository.replace("github.com/", "")}</>}
          </p>
        </div>
        <RippleButton className={styles.newScan} type="button" onClick={onNewScan}>+ New scan</RippleButton>
      </motion.header>

      <motion.div {...reveal(0.04)}>
        <ResultTabs hasRepository={Boolean(result.linkedRepository)} findingsCount={findings.length} />
      </motion.div>

      {result.sample && (
        <motion.p className={styles.sampleNotice} role="note" {...reveal(0.07)}>
          <strong>Placeholder results</strong>
          <span>The scanning backend isn&apos;t connected yet. Every value on this page is sample data for layout review, not real findings about {result.domain}.</span>
        </motion.p>
      )}

      <motion.dl className={styles.stats} {...reveal(0.1)}>
        {result.stats.map((stat, index) => (
          <div key={stat.label}>
            <dt>{stat.label}</dt>
            <dd><NumberTicker value={stat.value} delay={0.15 + index * 0.08} />{stat.suffix}</dd>
          </div>
        ))}
      </motion.dl>

      <div className={styles.grid}>
        <motion.section className={styles.mapCard} aria-labelledby="map-title" {...reveal(0.15)}>
          <div className={styles.cardHead}>
            <h2 id="map-title">Where your servers are</h2>
            <div className={styles.legend} aria-label="Status legend">
              <span data-status="healthy"><i />Healthy {statusCounts.healthy || 0}</span>
              <span data-status="attention"><i />Attention {statusCounts.attention || 0}</span>
              <span data-status="critical"><i />Critical {statusCounts.critical || 0}</span>
            </div>
          </div>

          <div className={styles.globeStage}>
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

          <div className={styles.nodeList} role="group" aria-label="Servers">
            {result.nodes.map((node) => (
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
                <div><dt>Host</dt><dd>{selectedNode.provider}</dd></div>
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

        <div className={styles.sideColumn}>
          <motion.section className={`${styles.card} ${styles.scoreCard}`} aria-labelledby="score-title" {...reveal(0.2)}>
            <div className={styles.cardHead}>
              <h2 id="score-title">Exposure score</h2>
              <span className={styles.ratingBadge} data-tone={scoreTone(result.score)}>{result.rating}</span>
            </div>
            <div className={styles.scoreBody}>
              <ScoreRing score={result.score} reduceMotion={reduceMotion} />
              <div className={styles.breakdown}>
                {result.breakdown.map((item, index) => (
                  <div key={item.label}>
                    <div className={styles.breakdownLabel}>
                      <span>{item.label}</span>
                      <strong data-tone={scoreTone(item.value)}><NumberTicker value={item.value} delay={0.35 + index * 0.08} /></strong>
                    </div>
                    <div className={styles.bar} data-tone={scoreTone(item.value)}>
                      <motion.span
                        initial={reduceMotion ? false : { width: 0 }}
                        animate={{ width: `${item.value}%` }}
                        transition={{ duration: 0.8, delay: 0.35 + index * 0.08 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
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
                    {finding.id === selectedFinding?.id && <span className={styles.findingWhy}>{finding.why}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </motion.section>
        </div>
      </div>
    </div>
  );
}
