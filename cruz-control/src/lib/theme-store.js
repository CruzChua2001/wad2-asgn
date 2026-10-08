"use client";

import { useLayoutEffect, useSyncExternalStore } from "react";
import { THEME_STORAGE_KEY } from "./theme-script";

// One theme store for every page. The active theme also lives on <html data-theme>, so anything
// rendered outside a page's <main> (the auth modal, the body background) follows it too.
const THEME_CHANGE_EVENT = "cruz-control-theme-change";

function subscribeToTheme(callback) {
  window.addEventListener("storage", callback);
  window.addEventListener(THEME_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(THEME_CHANGE_EVENT, callback);
  };
}

function getThemeSnapshot() {
  return window.localStorage.getItem(THEME_STORAGE_KEY) || "light";
}

function getServerThemeSnapshot() {
  return "light";
}

function setTheme(nextTheme) {
  window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  document.documentElement.setAttribute("data-theme", nextTheme);
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, getServerThemeSnapshot);

  // Keeps <html> in sync with changes from other tabs, and re-applies the attribute after
  // React's dev Strict Mode remount resets <html> (a no-op in production).
  useLayoutEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return [theme, setTheme];
}
