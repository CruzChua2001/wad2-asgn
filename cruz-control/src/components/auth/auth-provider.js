"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { createClient } from "@/lib/client";
import AuthModal from "./auth-modal";

const AuthContext = createContext(null);

const initialsFor = name => {
  const letters = name.split(/\s+/).filter(word => word).map((word) => word[0]);

  if (letters.length > 1) {
    return (letters[0] + letters.at(-1)).toUpperCase();
  }
  return name.slice(0,2).toUpperCase(); 
}

const toProfile = user => {
  const name = user.user_metadata?.full_name || user.user_metadata?.name || user.email.split("@")[0];
  return {
    id: user.id,
    email: user.email,
    name,
    initials: initialsFor(name)
  }
}

const friendlyErrorMsg = error => {
  const message = {
    invalid_credentials: "Email or password is incorrect.",
    user_already_exists: "An account with this email already exists.",
    weak_password: "Password is too weak. Use at least 8 characters.",
    over_request_rate_limit: "Too many attempts. Please wait a minute and try again."
  }

  return new Error(message[error.code] ?? "Something went wrong. Please try again.");
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("loading");
  const [authTab, setAuthTab] = useState(null);

  useEffect(() => {
    const supabase = createClient();
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session ? toProfile(session.user) : null);
      setStatus(session ? "authenticated" : "guest");
    })
    return () => data.subscription.unsubscribe();
  }, [])

  async function signIn({ email, password }) {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw friendlyErrorMsg(error);
  }

  async function signUp({ name, email, password }) {
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } }
    })
    if (error) throw friendlyErrorMsg(error);
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
  }

  function openAuth(tab = "login") {
    setAuthTab(tab);
  }

  function closeAuth() {
    setAuthTab(null);
  }

  const value = { status, user, signIn, signUp, signOut, openAuth };

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
