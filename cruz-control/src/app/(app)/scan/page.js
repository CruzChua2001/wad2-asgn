"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useMemo, useState } from "react";
import { LuArrowRight, LuCheck, LuCodeXml, LuGlobe, LuLink, LuRadar, LuShieldCheck, LuSparkle } from "react-icons/lu";
import LiveScanTerminal from "./live-scan-terminal";
import ScanningRobot from "./scanning-robot";
import RippleButton from "@/components/ripple-button";
import { useTheme } from "@/lib/theme-store";
import { useScan } from "./scan-context";
import styles from "@/styles/overview/overview.module.css";

// These local overrides beat the shared module's unlayered font/size rules.
const SCAN_BUTTON = `${styles.scanButton} min-h-12! max-w-full text-base! font-[family-name:var(--font-geist-sans)]! font-semibold! whitespace-normal! [--ripple-color:color-mix(in_srgb,var(--ink)_20%,transparent)] [&_.ripple-content]:whitespace-normal! [&_.ripple-content]:flex-wrap [&_.ripple-content]:justify-center disabled:opacity-100! disabled:bg-surface-soft! disabled:text-muted! disabled:border-line! disabled:border-dashed!`;
const FIELD_LABEL = "font-[family-name:var(--font-geist-sans)]! text-sm! leading-normal! tracking-normal!";
const MODE_BUTTON = "font-[family-name:var(--font-geist-sans)]! text-ink! leading-normal! focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";
const SECONDARY_BUTTON = `${styles.ghostButton} min-h-11! max-w-full text-base! font-[family-name:var(--font-geist-sans)]! text-ink! whitespace-normal!`;

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
    { step: "01", title: "DNS & email", detail: "Reads public DNS records, checks SPF, DMARC and CAA, and finds subdomains in certificate logs." },
    { step: "02", title: "Servers & software", detail: "Looks up open ports and known bugs in Shodan's public data, and maps where your servers are." },
    { step: "03", title: "HTTPS & headers", detail: "Checks your certificate, the HTTPS redirect and the security headers on your home page." },
  ],
  repository: [
    { step: "01", title: "Dependencies", detail: "Checks the npm packages in package.json against the OSV.dev vulnerability database." },
    { step: "02", title: "Secret files", detail: "Looks for committed .env files and private keys by file name, without reading them." },
    { step: "03", title: "Project basics", detail: "Checks your .gitignore rules, README, SECURITY.md, Dependabot and lockfile." },
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
  const { phase, scan, lines, startScan, resetScan, progress } = useScan();
  const [mode, setMode] = useState("website");
  const [target, setTarget] = useState("");
  const [linkRepository, setLinkRepository] = useState(false);
  const [repository, setRepository] = useState("");
  const [forceScan, setForceScan] = useState(false);

  const targetStatus = useMemo(() => normalizeTarget(target, mode), [target, mode]);
  const repositoryStatus = useMemo(() => normalizeTarget(repository, "repository"), [repository]);
  const canSubmit = targetStatus.valid && (!linkRepository || repositoryStatus.valid);

  function changeMode(nextMode) {
    setMode(nextMode);
    setTarget("");
    if (nextMode === "repository") setLinkRepository(false);
  }

  function fillSample(sample) {
    setTarget(sample);
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (!canSubmit) return;

    if (mode === "repository") {
      startScan({ githubRepo: targetStatus.normalized, force: forceScan });
    } else {
      startScan({ domain: targetStatus.normalized, githubRepo: linkRepository ? repositoryStatus.normalized : null, force: forceScan })
    }

    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }

  function cancelScan() {
    resetScan();
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }

  const viewTransition = reduceMotion
    ? { initial: false, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0 } }
    : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -12 }, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } };

  const entrance = reduceMotion ? {} : { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.48, ease: [0.22, 1, 0.36, 1] } };

  return (
        <AnimatePresence mode="wait" initial={false}>
        {phase === "idle" && (
        <motion.div key="idle" className="min-w-0" {...viewTransition}>
        <motion.div className={styles.intro} {...entrance}>
          <h1 className="text-[clamp(2rem,5vw,3.625rem)]! leading-tight!">What would you <em>like to scan?</em></h1>
        </motion.div>

        <motion.div className={`${styles.commandDeck} grid-cols-1! xl:grid-cols-[minmax(0,1.5fr)_minmax(18rem,1fr)]!`} {...(reduceMotion ? {} : { initial: { opacity: 0, scale: 0.985 }, animate: { opacity: 1, scale: 1 }, transition: { duration: 0.5, delay: 0.1 } })}>
          <div className={styles.deckMain}>
            <div className={styles.deckHeading}>
              <span className={`${styles.deckLabel} ${FIELD_LABEL}`}>Target type</span>
              <h2>Start a new assessment</h2>
            </div>

            <div className={`${styles.modeGrid} grid-cols-[repeat(auto-fit,minmax(min(100%,17rem),1fr))]!`} role="group" aria-label="Select target type" data-tour="target-type">
              <button type="button" className={`${MODE_BUTTON} ${mode === "website" ? styles.modeActive : "bg-surface!"}`} aria-pressed={mode === "website"} onClick={() => changeMode("website")}>
                <span className={styles.modeIcon}><Icon name="globe" /></span>
                <span className="min-w-0"><strong className="text-base!">Live website</strong><small className="overflow-visible! text-clip! text-sm! leading-relaxed! wrap-anywhere">Domain, DNS, certificates, and headers</small></span>
                <i className={styles.modeCheck}><Icon name="check" size={14} /></i>
              </button>
              <button type="button" className={`${MODE_BUTTON} ${mode === "repository" ? styles.modeActive : "bg-surface!"}`} aria-pressed={mode === "repository"} onClick={() => changeMode("repository")}>
                <span className={styles.modeIcon}><Icon name="code" /></span>
                <span className="min-w-0"><strong className="text-base!">GitHub repository</strong><small className="overflow-visible! text-clip! text-sm! leading-relaxed! wrap-anywhere">Packages, secret files, and project basics</small></span>
                <i className={styles.modeCheck}><Icon name="check" size={14} /></i>
              </button>
            </div>

            <form className={styles.scanForm} onSubmit={handleSubmit} noValidate>
              <label htmlFor="scan-target" className={FIELD_LABEL}>{mode === "website" ? "Website or domain" : "Public repository"}</label>
              <div data-tour="scan-input" className={`${styles.inputShell} grid-cols-[auto_minmax(0,1fr)]! lg:grid-cols-[auto_minmax(0,1fr)_auto]! ${target && !targetStatus.valid ? styles.inputInvalid : ""}`}>
                <span className={styles.inputIcon}><Icon name={mode === "website" ? "globe" : "code"} /></span>
                <input
                  id="scan-target"
                  className="h-12! text-base! font-[family-name:var(--font-geist-mono)]!"
                  type="text"
                  value={target}
                  onChange={(event) => setTarget(event.target.value)}
                  placeholder={mode === "website" ? "example.com or https://example.com" : "github.com/owner/repository"}
                  autoComplete="off"
                  spellCheck="false"
                  aria-describedby="target-help"
                  aria-invalid={Boolean(target && !targetStatus.valid)}
                />
                <RippleButton className={`${SCAN_BUTTON} col-span-full! w-full! lg:col-auto! lg:w-auto!`} type="submit" disabled={!canSubmit} data-curious>
                  Start scan <Icon name="arrow" size={17} />
                </RippleButton>
              </div>
              <div id="target-help" className={`${styles.formHint} items-start! text-sm! leading-relaxed! ${targetStatus.valid ? styles.formHintValid : ""}`} aria-live="polite">
                <span className="mt-1 shrink-0">{targetStatus.valid ? <Icon name="check" size={13} /> : <Icon name="spark" size={13} />}</span>
                <p className="min-w-0 wrap-anywhere">{targetStatus.message}</p>
              </div>

              {mode === "website" && (
                <div className={styles.linkedRepository}>
                  <label className={`${styles.checkLabel} min-h-11 items-start! py-2 font-[family-name:var(--font-geist-sans)]! text-base! text-ink! leading-normal!`}>
                    <input type="checkbox" aria-describedby="link-repository-help" checked={linkRepository} onChange={(event) => setLinkRepository(event.target.checked)} />
                    <span className={styles.fakeCheckbox}><Icon name="check" size={12} /></span>
                    <span className="min-w-0"><Icon name="link" size={15} /> Link a public GitHub repository</span>
                  </label>
                  <p id="link-repository-help" className="pl-[29px] text-sm leading-relaxed text-muted">Adds checks for packages, secret file names and project basics.</p>
                  {linkRepository && (
                    <motion.div className={`${styles.linkedInput} px-1`} initial={reduceMotion ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}>
                      <label htmlFor="linked-repository" className={FIELD_LABEL}>GitHub repository</label>
                      <input id="linked-repository" className="h-12! text-base! font-[family-name:var(--font-geist-mono)]!" aria-describedby="linked-repository-status" value={repository} onChange={(event) => setRepository(event.target.value)} placeholder="github.com/owner/repository" aria-invalid={Boolean(repository && !repositoryStatus.valid)} />
                      <small id="linked-repository-status" className="text-sm! leading-relaxed! wrap-anywhere">{repositoryStatus.message}</small>
                    </motion.div>
                  )}
                </div>
              )}

              <div className="mt-3">
                <label className={`${styles.checkLabel} min-h-11 items-start! py-2 font-[family-name:var(--font-geist-sans)]! text-base! text-ink! leading-normal!`}>
                  <input type="checkbox" aria-describedby="fresh-scan-help" checked={forceScan} onChange={event => setForceScan(event.target.checked)} />
                  <span className={styles.fakeCheckbox}><Icon name="check" size={12} /></span>
                  <span className="min-w-0">Run a fresh scan</span>
                </label>
                <p id="fresh-scan-help" className="pl-[29px] text-sm leading-relaxed text-muted">Bypasses cached results from the last 12 hours and checks your targets again.</p>
              </div>
            </form>

            <div className={styles.samples}>
              <span className={FIELD_LABEL}>Try an example</span>
              {SAMPLE_TARGETS[mode].map((sample) => <button type="button" key={sample} aria-label={`Use example ${sample.replace("github.com/", "")}`} className="min-h-11 min-w-0 max-w-full cursor-pointer border-accent! bg-accent-soft/30! px-3! py-2! text-sm! font-[family-name:var(--font-geist-mono)]! text-ink! leading-normal! tracking-normal! focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" onClick={() => fillSample(sample)}>{sample.replace("github.com/", "")}</button>)}
            </div>
          </div>

          <aside className={`${styles.deckAside} min-w-0 border-l-0! border-t border-line xl:border-l! xl:border-t-0!`} aria-label="Scan coverage preview">
            <div className={`${styles.asideTopline} flex-wrap font-[family-name:var(--font-geist-sans)]! text-sm! tracking-normal!`}><span><Icon name="radar" size={16} /> Scan sequence</span><strong className="text-sm!">3 steps</strong></div>
            <div className={`${styles.checkList} grid! grid-cols-1! md:grid-cols-3! md:gap-4! xl:block!`}>
              {CHECKS[mode].map((item, index) => (
                <motion.article className="grid! grid-cols-[1.75rem_minmax(0,1fr)]! md:block! xl:grid!" key={item.title} initial={reduceMotion ? false : { opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.18 + index * 0.08 }}>
                  <span>{item.step}</span>
                  <div className="min-w-0"><h3 className="text-base!">{item.title}</h3><p className="text-sm! leading-relaxed! wrap-anywhere">{item.detail}</p></div>
                </motion.article>
              ))}
            </div>
            <div className={styles.coverageNote}>
              <Icon name="shield" size={18} />
              <div className="min-w-0"><strong className="text-base!">Non-destructive by design</strong><p className="text-sm! leading-relaxed!">Public records and a few ordinary requests only. What we can see depends on the site or repo.</p></div>
            </div>
          </aside>
        </motion.div>

        <motion.div className={`${styles.trustStrip} font-[family-name:var(--font-geist-sans)]! text-sm! leading-relaxed! tracking-normal!`} {...(reduceMotion ? {} : { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { delay: 0.35 } })}>
          <span><Icon name="shield" size={15} /> Public data + read-only checks</span>
          <i />
          <span><Icon name="spark" size={15} /> Clear, guided explanations</span>
          <i />
          <span>No scan starts without your action</span>
        </motion.div>
        </motion.div>
        )}

        {/* Also shown once finished, while moving to /scan/[id], after pressing Back from it, or after a failed scan. */}
        {phase !== "idle" && scan && (
          <motion.div key="scanning" className={styles.scanning} {...viewTransition}>
            <div className={styles.scanningIntro}>
              <h1 className="text-[clamp(1.75rem,4vw,2.875rem)]! leading-tight!">{phase === "scanning" ? "Scanning" : phase === "failed" ? "Couldn't scan" : "Scanned"} <em>{scan.domain ?? scan.githubRepo}</em></h1>
            </div>

            <div className="scan-robot-stage">
              <ScanningRobot status={phase} />
              <LiveScanTerminal
                lines={lines}
                theme={theme}
                domain={scan.domain ?? scan.githubRepo}
                status={phase === "scanning" ? "RUNNING" : phase === "failed" ? "STOPPED" : "DONE"}
              />
            </div>
            <div className={styles.scanProgress}>
              <div className={`${styles.progressMeta} gap-3 font-[family-name:var(--font-geist-sans)]! text-sm! tracking-normal! normal-case!`}><span>{phase === "failed" ? "Scan stopped" : "Checks in progress"}</span><strong>{progress}%</strong></div>
              <div className={styles.progressTrack} role="progressbar" aria-label="Scan progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
                <span style={{ width: `${progress}%` }} />
              </div>
            </div>
            <div className={`${styles.scanActions} flex-wrap`}>
              {phase === "scanning" && (
                <button type="button" className={SECONDARY_BUTTON} onClick={cancelScan}>Cancel scan</button>
              )}
              {phase === "failed" && (
                <button type="button" className={SECONDARY_BUTTON} onClick={cancelScan}>+ New scan</button>
              )}
              {phase === "results" && (
                <>
                  <button type="button" className={SECONDARY_BUTTON} onClick={cancelScan}>+ New scan</button>
                  <RippleButton className={SCAN_BUTTON} href={`/scan/${scan.id}`}>View results <Icon name="arrow" size={17} /></RippleButton>
                </>
              )}
            </div>
          </motion.div>
        )}
        </AnimatePresence>
  );
}
