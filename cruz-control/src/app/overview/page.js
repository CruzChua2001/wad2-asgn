"use client";

import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import { LuArrowRight, LuBot, LuCheck, LuCodeXml, LuGlobe, LuLink, LuRadar, LuShieldCheck, LuSparkle } from "react-icons/lu";
import AnimatedThemeToggler from "../../components/animated-theme-toggler";
import { useAuth } from "../../components/auth-provider";
import LiveScanTerminal from "../../components/live-scan-terminal";
import ProfileMenu from "../../components/profile-menu";
import RippleButton from "../../components/ripple-button";
import { buildPlaceholderResult, buildPlaceholderScript, PLACEHOLDER_NOTICE } from "../../lib/placeholder-scan";
import { useTheme } from "../../lib/theme-store";
import ScanResults from "./scan-results";
import styles from "./overview.module.css";


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

function BrandMark() {
  return <span className="brand-mark" aria-hidden="true"><span /><span /><span /><span /></span>;
}

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

function formatLogTime(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `[${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}]`;
}

function RadarField() {
  return (
    <div className={styles.radarField} aria-hidden="true">
      <div className={styles.radarHalo} />
      <div className={`${styles.radarRing} ${styles.radarRingOuter}`} />
      <div className={`${styles.radarRing} ${styles.radarRingMiddle}`} />
      <div className={`${styles.radarRing} ${styles.radarRingInner}`} />
      <div className={styles.radarAxisX} />
      <div className={styles.radarAxisY} />
      <div className={styles.radarSweep} />
      <span className={`${styles.radarNode} ${styles.radarNodeOne}`} />
      <span className={`${styles.radarNode} ${styles.radarNodeTwo}`} />
      <span className={`${styles.radarNode} ${styles.radarNodeThree}`} />
    </div>
  );
}

export default function OverviewPage() {
  const [theme, updateTheme] = useTheme();
  const { status } = useAuth();
  const reduceMotion = useReducedMotion();
  const [mode, setMode] = useState("website");
  const [target, setTarget] = useState("");
  const [linkRepository, setLinkRepository] = useState(false);
  const [repository, setRepository] = useState("");
  const [submissionMessage, setSubmissionMessage] = useState("");
  const [phase, setPhase] = useState("idle");
  const [scan, setScan] = useState(null);
  const [lines, setLines] = useState([]);

  const targetStatus = useMemo(() => normalizeTarget(target, mode), [target, mode]);
  const repositoryStatus = useMemo(() => normalizeTarget(repository, "repository"), [repository]);
  const canSubmit = targetStatus.valid && (!linkRepository || repositoryStatus.valid);

  // Stream the PLACEHOLDER scan script into the terminal, then reveal results.
  useEffect(() => {
    if (phase !== "scanning" || !scan) return undefined;
    const timers = [];
    let elapsed = 0;
    scan.script.forEach((step, index) => {
      elapsed += scan.fast ? 70 : step.delay;
      timers.push(setTimeout(() => {
        setLines((current) => [...current, { ...step, id: index, time: formatLogTime(new Date()) }]);
      }, elapsed));
    });
    timers.push(setTimeout(() => setPhase("results"), elapsed + (scan.fast ? 350 : 1200)));
    return () => timers.forEach(clearTimeout);
  }, [phase, scan]);

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
    const domain = targetStatus.normalized;
    const linkedRepository = linkRepository ? repositoryStatus.normalized : null;
    setSubmissionMessage("");
    setLines([]);
    setScan({
      domain,
      fast: Boolean(reduceMotion),
      script: buildPlaceholderScript(domain, { linkedRepository }),
      result: buildPlaceholderResult(domain, { linkedRepository }),
    });
    setPhase("scanning");
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }

  // Used by both "Cancel scan" and "+ New scan": return to the empty pre-scan form.
  function resetScan() {
    setPhase("idle");
    setLines([]);
    setScan(null);
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }

  const viewTransition = reduceMotion
    ? { initial: false, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0 } }
    : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -12 }, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } };
  const progress = scan ? Math.round((lines.length / scan.script.length) * 100) : 0;

  const entrance = reduceMotion ? {} : { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.48, ease: [0.22, 1, 0.36, 1] } };

  return (
    <main className={styles.page} data-theme={theme}>
      <RadarField />

      <header className={styles.header}>
        {/* Signed-in users treat /overview as home; guests go back to the landing page. */}
        <Link className="brand" href={status === "authenticated" ? "/overview" : "/"} aria-label="Cruz Control home">
          <BrandMark />
          <span>CRUZ CONTROL</span>
        </Link>
        <nav className={styles.primaryNav} aria-label="Primary navigation">
          <Link href="/overview" className={styles.navActive} aria-current="page">Overview</Link>
          {status === "authenticated" && <Link href="/history">History</Link>}
          <Link href="/docs">Docs</Link>
          <Link href="/learn">Learn</Link>
        </nav>
        <div className={styles.headerActions} aria-label="Account and display controls">
          <AnimatedThemeToggler theme={theme} onThemeChange={updateTheme} />
          <ProfileMenu />
        </div>
      </header>

      <section className={`${styles.content} ${phase === "results" ? styles.contentWide : ""}`.trim()}>
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

        {phase === "scanning" && scan && (
          <motion.div key="scanning" className={styles.scanning} {...viewTransition}>
            <div className={styles.scanningIntro}>
              <h1>Scanning <em>{scan.domain}</em></h1>
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
              <button type="button" className={styles.ghostButton} onClick={resetScan}>Cancel scan</button>
            </div>
          </motion.div>
        )}

        {phase === "results" && scan && (
          <motion.div key="results" {...viewTransition}>
            <ScanResults result={scan.result} lines={lines} theme={theme} reduceMotion={Boolean(reduceMotion)} onNewScan={resetScan} />
          </motion.div>
        )}
        </AnimatePresence>
      </section>

      {/* Placeholder for the AI assistant. No behaviour yet; hand off to the AI team. */}
      <button type="button" className={styles.askCruz} aria-label="Ask Cruz, AI assistant (coming soon)" title="AI assistant coming soon">
        <span className={styles.askCruzPulse} aria-hidden="true" />
        <LuBot aria-hidden="true" size={17} strokeWidth={1.7} />
        <span>ASK CRUZ</span>
      </button>
    </main>
  );
}
