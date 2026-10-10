"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LuBot } from "react-icons/lu";
import AnimatedThemeToggler from "@/components/animated-theme-toggler";
import { useTheme } from "@/lib/theme-store";
import ProfileMenu from "./scan/profile-menu";
import { ScanProvider, useScan } from "./scan/scan-context";
import styles from "@/styles/overview/overview.module.css";

const BrandMark = _ => {
  return <span className="brand-mark" aria-hidden="true"><span /><span /><span /><span /></span>;
}

const ScanLink = ({children, ...props}) => {
  const { resetScan } = useScan();
  return <Link href="/scan" onClick={resetScan} {...props}>{children}</Link>;
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
  const pathname = usePathname();
  const showingResults = pathname.startsWith("/scan/results");
  const navProps = href => pathname.startsWith(href) ? { className: styles.navActive, "aria-current": "page" } : {};

  return (
    <ScanProvider>
      <main className={styles.page} data-theme={theme}>
        <RadarField />

        <header className={styles.header}>
           <ScanLink className="brand" aria-label="Cruz Control home">
            <BrandMark />
            <span>CRUZCONTROL</span>
          </ScanLink>
          <nav className={styles.primaryNav} aria-label="Primary navigation">
            <ScanLink {...navProps("/scan")}>Scan</ScanLink>
            <Link href="/project" {...navProps("/project")}>Projects</Link>
            <Link href="/learn" {...navProps("/learn")}>Learn</Link>
          </nav>
          <div className={styles.headerActions} aria-label="Account and display controls">
            <AnimatedThemeToggler theme={theme} onThemeChange={updateTheme} />
            <ProfileMenu />
          </div>
        </header>

        <section className={`${styles.content} ${showingResults ? styles.contentWide : ""}`.trim()}>
          {children}
        </section>

        {/* Placeholder for the AI assistant. No behaviour yet; hand off to the AI team. */}
        <button type="button" className={styles.askCruz} aria-label="Ask Cruz, AI assistant (coming soon)" title="AI assistant coming soon">
          {/* eslint-disable-next-line @next/next/no-img-element -- tiny static icon, next/image adds nothing here */}
          <img src="/AIChat.png" alt="" className={styles.askCruzIcon} />
          <span>ASK CRUZ</span>
        </button>
      </main>
    </ScanProvider>
  );
}
