"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LuBot } from "react-icons/lu";
import AnimatedThemeToggler from "@/components/animated-theme-toggler";
import { useAuth } from "@/components/auth/auth-provider";
import { useTheme } from "@/lib/theme-store";
import ProfileMenu from "./overview/profile-menu";
import { ScanProvider } from "./overview/scan-context";
import styles from "@/styles/overview/overview.module.css";

function BrandMark() {
  return <span className="brand-mark" aria-hidden="true"><span /><span /><span /><span /></span>;
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

// Shared shell for /overview and every /overview/scan/* tab. It stays mounted while those pages change.
export default function OverviewLayout({ children }) {
  const [theme, updateTheme] = useTheme();
  const { status } = useAuth();
  const pathname = usePathname();
  const showingResults = pathname.startsWith("/overview/scan");
  const navProps = href => pathname.startsWith(href) ? { className: styles.navActive, "aria-current": "page" } : {};

  return (
    <ScanProvider>
      <main className={styles.page} data-theme={theme}>
        <RadarField />

        <header className={styles.header}>
          {/* Signed-in users treat /overview as home; guests go back to the landing page. */}
          <Link className="brand" href={status === "authenticated" ? "/overview" : "/"} aria-label="Cruz Control home">
            <BrandMark />
            <span>CRUZ CONTROL</span>
          </Link>
          <nav className={styles.primaryNav} aria-label="Primary navigation">
            {status === "authenticated" && <Link href="/project" {...navProps("/project")}>Project</Link>}
            <Link href="/overview" aria-current="page" {...navProps("/overview")}>Overview</Link>
            {status === "authenticated" && <Link href="/history" {...navProps("/history")}>History</Link>}
            <Link href="/docs" {...navProps("/docs")}>Docs</Link>
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
