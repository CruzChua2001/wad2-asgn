"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import AnimatedThemeToggler from "../components/animated-theme-toggler";
import InteractiveSignalGrid from "../components/interactive-signal-grid";
import RippleButton from "../components/ripple-button";
import ScanTerminal from "../components/scan-terminal";
import TextAnimate from "../components/text-animate";
import TypingAnimation from "../components/typing-animation";

const THEME_STORAGE_KEY = "cruz-control-theme-v2";

function subscribeToTheme(callback) {
  window.addEventListener("storage", callback);
  window.addEventListener("cruz-control-theme-change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("cruz-control-theme-change", callback);
  };
}

function getThemeSnapshot() {
  return window.localStorage.getItem(THEME_STORAGE_KEY) || "light";
}

function getServerThemeSnapshot() {
  return "light";
}

function BrandMark() {
  return <span className="brand-mark" aria-hidden="true"><span /><span /><span /><span /></span>;
}

export default function Home() {
  const theme = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, getServerThemeSnapshot);

  function moveGridSpotlight(event) {
    const grid = event.currentTarget.querySelector(".interactive-signal-grid");
    if (!grid) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    grid.style.setProperty("--pointer-x", `${((event.clientX - bounds.left) / bounds.width) * 100}%`);
    grid.style.setProperty("--pointer-y", `${((event.clientY - bounds.top) / bounds.height) * 100}%`);
  }

  function resetGridSpotlight(event) {
    const grid = event.currentTarget.querySelector(".interactive-signal-grid");
    grid?.style.setProperty("--pointer-x", "50%");
    grid?.style.setProperty("--pointer-y", "50%");
  }

  function updateTheme(nextTheme) {
    window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    window.dispatchEvent(new Event("cruz-control-theme-change"));
  }

  return (
    <main className="landing" data-theme={theme} onPointerMove={moveGridSpotlight} onPointerLeave={resetGridSpotlight}>
      <InteractiveSignalGrid />
      <header className="site-header">
        <Link className="brand" href="/" aria-label="Cruz Control home">
          <BrandMark />
          <span>CRUZ CONTROL</span>
        </Link>
        <nav className="main-nav" aria-label="Main navigation">
          <RippleButton className="nav-action nav-signup" href="/signup">Sign up</RippleButton>
          <RippleButton className="nav-action nav-login" href="/login">Login</RippleButton>
          <AnimatedThemeToggler theme={theme} onThemeChange={updateTheme} />
        </nav>
      </header>

      <section className="hero grid grid-cols-1 items-center gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,.95fr)] lg:gap-6 xl:gap-8">
        <div className="hero-copy">
          <p className="hero-kicker"><span /> FOR STUDENTS &amp; FIRST-TIME DEVELOPERS</p>
          <h1>
            <TextAnimate className="hero-headline-line" by="word" animation="blurInUp">
              See what’s exposed.
            </TextAnimate>
            <TextAnimate className="hero-headline-line hero-headline-accent" by="word" animation="blurInUp" delay={0.16}>
              Learn how to fix it.
            </TextAnimate>
          </h1>
          <TypingAnimation className="hero-description">
            Scan any website or public GitHub repository for security issues, then get clear explanations and practical fixes before or after deployment.
          </TypingAnimation>
          <div className="hero-actions">
            <RippleButton className="button button-primary" href="/overview">Explore as guest <span aria-hidden="true">↗</span></RippleButton>
            <RippleButton className="button button-secondary" href="/signup">Create an account</RippleButton>
          </div>
          <p className="hero-footnote"><span>PUBLIC DATA ONLY</span><i /> <span>NON-INTRUSIVE</span><i /> <span>BUILT FOR LEARNING</span></p>
        </div>

        <div className="hero-visual">
          <ScanTerminal theme={theme} />
        </div>
      </section>
    </main>
  );
}
