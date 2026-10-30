"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AnimatedThemeToggler from "@/components/animated-theme-toggler";
import { useTheme } from "@/lib/theme-store";
import { useAuth } from "@/components/auth/auth-provider";
import ProfileMenu from "./scan/profile-menu";
import { ScanProvider, useScan } from "./scan/scan-context";
import styles from "@/styles/overview/overview.module.css";
import ProductTour from "@/components/tour/product-tour";  
import AskCruzPanel from "@/components/ask-cruz/ask-cruz-panel";
import { useEffect, useState } from "react";
import { LuCompass } from "react-icons/lu";

const BrandMark = _ => {
  return <img src="/favicon.ico" alt="" className="brand-mark" aria-hidden="true" />;
}

const ScanLink = ({children, href = "/scan", ...props}) => {
  const { resetScan } = useScan();
  return <Link href={href} onClick={resetScan} {...props}>{children}</Link>;
}

const RadarField = _ => {
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

export default function OverviewLayout({ children }) {
  const [theme, updateTheme] = useTheme();
  const { status } = useAuth();
  const [askOpen, setAskOpen] = useState(false);
  const [hop, setHop] = useState(false);
  const pathname = usePathname();
  const showingResults = pathname.startsWith("/scan/");
  const onOverview = /^\/scan\/[^/]+$/.test(pathname);
  const showTourButton = pathname === "/scan" || onOverview;
  const navProps = href => pathname.startsWith(href) ? { className: styles.navActive, "aria-current": "page" } : {};
  const [tour, setTour] = useState(null);

  useEffect(() => {
    if (askOpen) return;
    const IDLE_MS = 20000; // 20 seconds
    const events = ["pointermove", "pointerdown", "keydown", "scroll"];
    let timer;
    const restart = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setHop(true), IDLE_MS);
    };
    events.forEach(name => window.addEventListener(name, restart, { passive: true }));
    restart();
    return () => {
      clearTimeout(timer);
      events.forEach(name => window.removeEventListener(name, restart));
    };
  }, [askOpen, pathname]);
  return (
    <ScanProvider>
      <main className={styles.page} data-theme={theme}>
        <RadarField />

        <header className={styles.header}>
           <ScanLink className="brand" href={status === "guest" ? "/" : "/scan"} aria-label="Cruz Control home">
            <BrandMark />
            <span>CRUZCONTROL</span>
          </ScanLink>
          <nav className={styles.primaryNav} aria-label="Primary navigation">
            <ScanLink {...navProps("/scan")}>Scan</ScanLink>
            <Link href="/project" {...navProps("/project")}>Projects</Link>
            <Link href="/learn" {...navProps("/learn")}>Learn</Link>
          </nav>
          <div className={styles.headerActions} aria-label="Account and display controls">
            {showTourButton && (
              <button
                type="button"
                aria-label="Take the tour"
                title="Take the tour"
                onClick={() => setTour(showingResults ? "results" : "intro")}
                className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-xs! font-semibold! text-accent hover:bg-accent-soft max-sm:px-2"
              >
                <LuCompass className="h-4 w-4 sm:hidden" aria-hidden="true" />
                <span className="max-sm:hidden">Take the tour</span>
              </button>
            )}
            <AnimatedThemeToggler theme={theme} onThemeChange={updateTheme} />
            <ProfileMenu />
          </div>
        </header>

        <section className={`${styles.content} ${showingResults ? styles.contentWide : ""}`.trim()}>
          {children}
        </section>

        <ProductTour part={tour} onStart={setTour} onClose={() => setTour(null)} />

        <button
          type="button"
          className={`${styles.askCruz} ${hop ? "ask-cruz-glow" : ""}`}
          aria-label="Ask Cruz, AI assistant"
          aria-expanded={askOpen}
          onClick={() => { setHop(false); setAskOpen(open => !open); }}
          onAnimationEnd={() => setHop(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- tiny static icon, next/image adds nothing here */}
          <img src="/AIChat.png" alt="" className={styles.askCruzIcon} />
          <span>ASK CRUZ</span>
        </button>

        <AskCruzPanel open={askOpen} onClose={() => setAskOpen(false)} />
      </main>
    </ScanProvider>
  );
}
