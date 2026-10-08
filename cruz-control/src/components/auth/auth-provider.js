"use client";

import { createContext, useCallback, useContext, useMemo, useState, useSyncExternalStore } from "react";
import AuthModal from "./auth-modal";
import { PLACEHOLDER_PROFILE } from "@/lib/placeholder-profile";

const SESSION_KEY = "cruz-control-session";
const AUTH_CHANGE_EVENT = "cruz-control-auth-change";
const STUB_DELAY_MS = 600;

const AuthContext = createContext(null);

function subscribeToSession(callback) {
  window.addEventListener("storage", callback);
  window.addEventListener(AUTH_CHANGE_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(AUTH_CHANGE_EVENT, callback);
  };
}

function getSessionSnapshot() {
  return window.localStorage.getItem(SESSION_KEY) ?? window.sessionStorage.getItem(SESSION_KEY) ?? "";
}

// null = "not read yet" (server render and hydration), so nothing renders as signed in or out too early.
function getServerSessionSnapshot() {
  return null;
}

function parseSession(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearSession() {
  window.localStorage.removeItem(SESSION_KEY);
  window.sessionStorage.removeItem(SESSION_KEY);
}

function writeSession(user, remember) {
  clearSession();
  (remember ? window.localStorage : window.sessionStorage).setItem(SESSION_KEY, JSON.stringify(user));
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}

function initialsFor(name) {
  const letters = name.split(/\s+/).filter(Boolean).map((word) => word[0]);
  return (letters.length > 1 ? letters[0] + letters.at(-1) : name.slice(0, 2)).toUpperCase();
}

function buildUser({ name, email }) {
  const displayName = name?.trim() || email.split("@")[0];
  return { ...PLACEHOLDER_PROFILE, name: displayName, email, initials: initialsFor(displayName) };
}

function stubDelay() {
  return new Promise((resolve) => setTimeout(resolve, STUB_DELAY_MS));
}

async function signIn({ email, remember, provider }) {
  await stubDelay();
  writeSession(provider ? PLACEHOLDER_PROFILE : buildUser({ email }), provider ? true : remember);
}

async function signUp({ name, email }) {
  await stubDelay();
  writeSession(buildUser({ name, email }), true);
}

async function signOut() {
  clearSession();
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
}

export function AuthProvider({ children }) {
  const raw = useSyncExternalStore(subscribeToSession, getSessionSnapshot, getServerSessionSnapshot);
  const user = useMemo(() => parseSession(raw), [raw]);
  const status = raw === null ? "loading" : user ? "authenticated" : "guest";
  const [authTab, setAuthTab] = useState(null);

  const openAuth = useCallback((tab = "login") => setAuthTab(tab), []);
  const closeAuth = useCallback(() => setAuthTab(null), []);

  const value = useMemo(
    () => ({ status, user, signIn, signUp, signOut, openAuth }),
    [status, user, openAuth],
  );

  return (
    <AuthContext value={value}>
      {children}
      {authTab && <AuthModal initialTab={authTab} onClose={closeAuth} />}
    </AuthContext>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>.");
  return context;
}
