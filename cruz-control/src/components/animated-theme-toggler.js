"use client";

import { flushSync } from "react-dom";
import { LuMoon, LuSun } from "react-icons/lu";

export default function AnimatedThemeToggler({ theme, onThemeChange }) {
  function toggleTheme(event) {
    const nextTheme = theme === "light" ? "dark" : "light";
    const { left, top, width, height } = event.currentTarget.getBoundingClientRect();
    const x = left + width / 2;
    const y = top + height / 2;
    const maxRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y),
    );

    const updateTheme = () => onThemeChange(nextTheme);
    if (
      !document.startViewTransition ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      updateTheme();
      return;
    }

    const transition = document.startViewTransition(() => flushSync(updateTheme));
    transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${maxRadius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 450,
          easing: "ease-in-out",
          fill: "forwards",
          pseudoElement: "::view-transition-new(root)",
        },
      );
    }).catch(() => {});
  }

  const isLight = theme === "light";
  return (
    <button
      className="theme-toggle"
      type="button"
      onClick={toggleTheme}
      aria-label={`Switch to ${isLight ? "dark" : "light"} mode`}
      title={`Switch to ${isLight ? "dark" : "light"} mode`}
    >
      {isLight
        ? <LuSun aria-hidden="true" className="theme-toggle-icon" />
        : <LuMoon aria-hidden="true" className="theme-toggle-icon" />}
      <span>{isLight ? "Dark mode" : "Light mode"}</span>
    </button>
  );
}
