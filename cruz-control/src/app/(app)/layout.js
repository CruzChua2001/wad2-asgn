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
import RandomPeek from "@/components/robot/random-peek";
import { useEffect, useState } from "react";
import { LuCompass } from "react-icons/lu";

const BrandMark = _ => {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny static icon, next/image adds nothing here
    <img src="/favicon.ico" alt="" className="brand-mark" aria-hidden="true" />
  );
}

const ScanLink = ({children, href = "/scan", ...props}) => {
  const { resetScan } = useScan();
  return <Link href={href} onClick={resetScan} {...props}>{children}</Link>;
}

const RadarField = _ => {
  return (
    <div className={`${styles.radarField} overflow-clip`} aria-hidden="true">
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
  const navProps = href => ({
    className: `inline-flex min-h-11 items-center justify-center px-3! py-2! text-base! font-medium text-ink! focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent hover:text-accent! ${pathname.startsWith(href) ? styles.navActive : ""}`,
    "aria-current": pathname.startsWith(href) ? "page" : undefined,
  });
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
      <main className={`${styles.page} overflow-visible!`} data-theme={theme}>
        <RadarField />

        <header className={`${styles.header} flex! h-auto! min-h-20! w-[calc(100%-2rem)]! flex-wrap items-center gap-3 py-3 lg:flex-nowrap`}>
           <ScanLink className="brand" href={status === "guest" ? "/" : "/scan"} aria-label="Cruz Control home">
            <BrandMark />
            <span>CRUZCONTROL</span>
          </ScanLink>
          <nav className={`${styles.primaryNav} order-3 basis-full border-t border-line pt-2 lg:order-none lg:basis-auto lg:border-t-0 lg:pt-0`} aria-label="Primary navigation">
            <ScanLink {...navProps("/scan")}>Scan</ScanLink>
            <Link href="/project" {...navProps("/project")}>Projects</Link>
          </nav>
          <div className={`${styles.headerActions} ml-auto min-w-0 max-w-full flex-wrap justify-end gap-2! [&_button]:min-h-11!`} aria-label="Account and display controls">
            {showTourButton && (
              <button
                type="button"
                aria-label="Take the tour"
                title="Take the tour"
                onClick={() => setTour(showingResults ? "results" : "intro")}
                className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full border border-line px-3 py-2 text-sm! font-semibold! text-accent hover:bg-accent-soft hover:text-ink max-sm:px-2"
              >
                <LuCompass className="h-4 w-4 sm:hidden" aria-hidden="true" />
                <span className="max-sm:hidden">Take the tour</span>
              </button>
            )}
            <div className="shrink-0 [&_.theme-toggle]:px-2 [&_.theme-toggle]:text-sm! [&_.theme-toggle]:text-ink!">
              <AnimatedThemeToggler theme={theme} onThemeChange={updateTheme} />
            </div>
            {/* Anchor Jeffers' menu to its trigger when the header grows or wraps. */}
            <div className="min-w-0 max-w-full [&_button]:text-base! [&_button[aria-haspopup=dialog]]:max-w-full [&_button[aria-haspopup=dialog]]:wrap-anywhere [&_[role=dialog]]:absolute! [&_[role=dialog]]:right-0! [&_[role=dialog]]:top-[calc(100%+0.5rem)]! [&_[role=dialog]]:max-h-[60dvh] [&_[role=dialog]]:overflow-y-auto!">
              <ProfileMenu />
            </div>
          </div>
        </header>

        <section className={`${styles.content} ${showingResults ? styles.contentWide : ""}`.trim()}>
          {children}
        </section>

        <ProductTour part={tour} onStart={setTour} onClose={() => setTour(null)} />

        <button
          type="button"
          className={`${styles.askCruz} min-h-11! font-[family-name:var(--font-geist-sans)]! text-sm! tracking-normal! ${hop ? "ask-cruz-glow" : ""}`}
          aria-label="Ask Cruz, AI assistant"
          aria-expanded={askOpen}
          onClick={() => { setHop(false); setAskOpen(open => !open); }}
          onAnimationEnd={() => setHop(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- tiny static icon, next/image adds nothing here */}
          <img src="/AIChat.png" alt="" className={styles.askCruzIcon} />
          <span>Ask Cruz</span>
        </button>

        <AskCruzPanel open={askOpen} onClose={() => setAskOpen(false)} />
        <RandomPeek />
      </main>
    </ScanProvider>
  );
}
