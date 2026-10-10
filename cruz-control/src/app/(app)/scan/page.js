"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import { LuArrowRight, LuCheck, LuCodeXml, LuGlobe, LuLink, LuRadar, LuShieldCheck, LuSparkle } from "react-icons/lu";
import LiveScanTerminal from "./live-scan-terminal";
import RippleButton from "@/components/ripple-button";
import { PLACEHOLDER_NOTICE } from "@/lib/placeholder-scan";
import { useTheme } from "@/lib/theme-store";
import { useScan } from "./scan-context";
import styles from "@/styles/overview/overview.module.css";


const ICONS = {
  arrow: LuArrowRight,
  check: LuCheck,
  code: LuCodeXml,
  globe: LuGlobe,
  link: LuLink,
  radar: LuRadar,
  shield: LuShieldCheck,
  spark: LuSparkle,
};

const SAMPLE_TARGETS = {
  website: ["smu.edu.sg", "scanme.nmap.org"],
  repository: ["github.com/juice-shop/juice-shop", "github.com/expressjs/express"],
};

const CHECKS = {
  website: [
    { step: "01", title: "DNS & certificates", detail: "Maps public records, certificate history, and candidate subdomains." },
    { step: "02", title: "Headers & exposure", detail: "Reviews bounded HTTP headers and pre-indexed public service data." },
    { step: "03", title: "Guided findings", detail: "Turns evidence into prioritized explanations and practical next steps." },
  ],
  repository: [
    { step: "01", title: "Dependencies", detail: "Checks supported manifests against public vulnerability records." },
    { step: "02", title: "Configuration", detail: "Reviews public files for risky defaults and redacted secret patterns." },
    { step: "03", title: "Project hygiene", detail: "Explains ignore rules, documentation gaps, and remediation priorities." },
  ],
};

// Same call sites as before; the glyphs now come from react-icons' Lucide set.
function Icon({ name, size = 20 }) {
  const Glyph = ICONS[name];
  return <Glyph aria-hidden="true" size={size} strokeWidth={1.65} />;
}

function normalizeTarget(value, mode) {
  const trimmed = value.trim();
  if (!trimmed) return { valid: false, message: mode === "website" ? "Enter a public website or domain." : "Enter a public GitHub repository." };

  if (mode === "website") {
    try {
      const parsed = new URL(/^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
      const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
      const validHostname = hostname.includes(".") && /^[a-z0-9.-]+$/.test(hostname) && !hostname.startsWith(".") && !hostname.endsWith(".");
      if (!validHostname) throw new Error("invalid-hostname");
      return { valid: true, normalized: hostname, message: `Ready to inspect public signals for ${hostname}.` };
    } catch {
      return { valid: false, message: "Use a public hostname such as example.com." };
    }
  }

  let repository = trimmed.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\.git$/i, "").replace(/\/+$/, "");
  repository = repository.replace(/^github\.com\//i, "");
  if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repository)) {
    return { valid: false, message: "Use a public GitHub URL or owner/repository." };
  }
  return { valid: true, normalized: `github.com/${repository}`, message: `Ready to inspect the public repository ${repository}.` };
}

export default function OverviewPage() {
  const [theme] = useTheme();
  const reduceMotion = useReducedMotion();
  const { phase, scan, lines, startScan, resetScan } = useScan();
  const [mode, setMode] = useState("website");
  const [target, setTarget] = useState("");
  const [linkRepository, setLinkRepository] = useState(false);
  const [repository, setRepository] = useState("");
  const [submissionMessage, setSubmissionMessage] = useState("");

  const targetStatus = useMemo(() => normalizeTarget(target, mode), [target, mode]);
  const repositoryStatus = useMemo(() => normalizeTarget(repository, "repository"), [repository]);
  const canSubmit = targetStatus.valid && (!linkRepository || repositoryStatus.valid);

  function changeMode(nextMode) {
    setMode(nextMode);
    setTarget("");
    setSubmissionMessage("");
    if (nextMode === "repository") setLinkRepository(false);
  }

  function fillSample(sample) {
    setTarget(sample);
    setSubmissionMessage("");
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!canSubmit) return;
    if (mode === "repository") {
      setSubmissionMessage(`Target checked: ${targetStatus.normalized}. Repository scanning isn't available in this preview yet, so no request was sent.`);
      return;
    }
    setSubmissionMessage("");
    startScan(targetStatus.normalized, {
      linkedRepository: linkRepository ? repositoryStatus.normalized : null,
      fast: Boolean(reduceMotion),
    });
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }

  function cancelScan() {
    resetScan();
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }

  const viewTransition = reduceMotion
    ? { initial: false, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0 } }
    : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -12 }, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } };
  const progress = scan ? Math.round((lines.length / scan.script.length) * 100) : 0;

  const entrance = reduceMotion ? {} : { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.48, ease: [0.22, 1, 0.36, 1] } };

  return (
        <AnimatePresence mode="wait" initial={false}>
        {phase === "idle" && (
        <motion.div key="idle" {...viewTransition}>
        <motion.div className={styles.intro} {...entrance}>
          <h1>What would you <em>like to scan?</em></h1>
        </motion.div>

        <motion.div className={styles.commandDeck} {...(reduceMotion ? {} : { initial: { opacity: 0, scale: 0.985 }, animate: { opacity: 1, scale: 1 }, transition: { duration: 0.5, delay: 0.1 } })}>
          <div className={styles.deckMain}>
            <div className={styles.deckHeading}>
              <span className={styles.deckLabel}>TARGET TYPE</span>
              <h2>Start a new assessment</h2>
            </div>

            <div className={styles.modeGrid} role="group" aria-label="Select target type">
              <button type="button" className={mode === "website" ? styles.modeActive : ""} aria-pressed={mode === "website"} onClick={() => changeMode("website")}>
                <span className={styles.modeIcon}><Icon name="globe" /></span>
                <span><strong>Live website</strong><small>Domain, DNS, certificates, and headers</small></span>
                <i className={styles.modeCheck}><Icon name="check" size={14} /></i>
              </button>
              <button type="button" className={mode === "repository" ? styles.modeActive : ""} aria-pressed={mode === "repository"} onClick={() => changeMode("repository")}>
                <span className={styles.modeIcon}><Icon name="code" /></span>
                <span><strong>GitHub repository</strong><small>Dependencies, configuration, and hygiene</small></span>
                <i className={styles.modeCheck}><Icon name="check" size={14} /></i>
              </button>
            </div>

            <form className={styles.scanForm} onSubmit={handleSubmit} noValidate>
              <label htmlFor="scan-target">{mode === "website" ? "Website or domain" : "Public repository"}</label>
              <div className={`${styles.inputShell} ${target && !targetStatus.valid ? styles.inputInvalid : ""}`}>
                <span className={styles.inputIcon}><Icon name={mode === "website" ? "globe" : "code"} /></span>
                <input
                  id="scan-target"
                  type="text"
                  value={target}
                  onChange={(event) => { setTarget(event.target.value); setSubmissionMessage(""); }}
                  placeholder={mode === "website" ? "example.com or https://example.com" : "github.com/owner/repository"}
                  autoComplete="off"
                  spellCheck="false"
                  aria-describedby="target-help"
                  aria-invalid={Boolean(target && !targetStatus.valid)}
                />
                <RippleButton className={styles.scanButton} type="submit" disabled={!canSubmit}>
                  Start scan <Icon name="arrow" size={17} />
                </RippleButton>
              </div>
              <div id="target-help" className={`${styles.formHint} ${targetStatus.valid ? styles.formHintValid : ""}`} aria-live="polite">
                <span>{targetStatus.valid ? <Icon name="check" size={13} /> : <Icon name="spark" size={13} />}</span>
                {targetStatus.message}
              </div>

              {mode === "website" && (
                <div className={styles.linkedRepository}>
                  <label className={styles.checkLabel}>
                    <input type="checkbox" checked={linkRepository} onChange={(event) => { setLinkRepository(event.target.checked); setSubmissionMessage(""); }} />
                    <span className={styles.fakeCheckbox}><Icon name="check" size={12} /></span>
                    <span><Icon name="link" size={15} /> Link a public GitHub repository for more context</span>
                  </label>
                  {linkRepository && (
                    <motion.div className={styles.linkedInput} initial={reduceMotion ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                      <label htmlFor="linked-repository">GitHub repository</label>
                      <input id="linked-repository" value={repository} onChange={(event) => { setRepository(event.target.value); setSubmissionMessage(""); }} placeholder="github.com/owner/repository" aria-invalid={Boolean(repository && !repositoryStatus.valid)} />
                      <small>{repositoryStatus.message}</small>
                    </motion.div>
                  )}
                </div>
              )}

              {submissionMessage && <p className={styles.integrationNotice} role="status"><Icon name="shield" size={16} /> {submissionMessage}</p>}
            </form>

            <div className={styles.samples}>
              <span>TRY AN EXAMPLE</span>
              {SAMPLE_TARGETS[mode].map((sample) => <button type="button" key={sample} onClick={() => fillSample(sample)}>{sample.replace("github.com/", "")}</button>)}
            </div>
          </div>

          <aside className={styles.deckAside} aria-label="Scan coverage preview">
            <div className={styles.asideTopline}><span><Icon name="radar" size={16} /> SCAN SEQUENCE</span><strong>03 MODULES</strong></div>
            <div className={styles.checkList}>
              {CHECKS[mode].map((item, index) => (
                <motion.article key={item.title} initial={reduceMotion ? false : { opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.18 + index * 0.08 }}>
                  <span>{item.step}</span>
                  <div><h3>{item.title}</h3><p>{item.detail}</p></div>
                </motion.article>
              ))}
            </div>
            <div className={styles.coverageNote}>
              <Icon name="shield" size={18} />
              <div><strong>Non-destructive by design</strong><p>Public records and bounded requests only. Coverage varies by provider and target.</p></div>
            </div>
          </aside>
        </motion.div>

        <motion.div className={styles.trustStrip} {...(reduceMotion ? {} : { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { delay: 0.35 } })}>
          <span><Icon name="shield" size={15} /> PUBLIC DATA + BOUNDED CHECKS</span>
          <i />
          <span><Icon name="spark" size={15} /> CLEAR, GUIDED EXPLANATIONS</span>
          <i />
          <span>NO SCAN STARTS WITHOUT YOUR ACTION</span>
        </motion.div>
        </motion.div>
        )}

        {/* Also shown once finished, while moving to /overview/scan or after pressing Back from it. */}
        {phase !== "idle" && scan && (
          <motion.div key="scanning" className={styles.scanning} {...viewTransition}>
            <div className={styles.scanningIntro}>
              <h1>{phase === "scanning" ? "Scanning" : "Scanned"} <em>{scan.domain}</em></h1>
            </div>
            <p className={styles.sampleBanner} role="note"><strong>Sample data</strong><span>{PLACEHOLDER_NOTICE}</span></p>
            <LiveScanTerminal lines={lines} theme={theme} domain={scan.domain} sample />
            <div className={styles.scanProgress}>
              <div className={styles.progressMeta}><span>Checks in progress</span><strong>{progress}%</strong></div>
              <div className={styles.progressTrack} role="progressbar" aria-label="Scan progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
                <span style={{ width: `${progress}%` }} />
              </div>
            </div>
            <div className={styles.scanActions}>
              {phase === "scanning" ? (
                <button type="button" className={styles.ghostButton} onClick={cancelScan}>Cancel scan</button>
              ) : (
                <>
                  <button type="button" className={styles.ghostButton} onClick={cancelScan}>+ New scan</button>
                  <RippleButton className={styles.scanButton} href="/scan/results">View results <Icon name="arrow" size={17} /></RippleButton>
                </>
              )}
            </div>
          </motion.div>
        )}
        </AnimatePresence>
  );
}
