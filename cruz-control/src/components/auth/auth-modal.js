"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FaGithub } from "react-icons/fa6";
import { FcGoogle } from "react-icons/fc";
import { LuEye, LuEyeOff, LuLock, LuMail, LuUser, LuX } from "react-icons/lu";
import { useAuth } from "./auth-provider";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

const TABS = [
  { value: "login", label: "Log In" },
  { value: "signup", label: "Sign Up" },
];

function TextField({ id, label, icon: FieldIcon, ...inputProps }) {
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-[14px] font-medium leading-none">{label}</label>
      <div className="relative">
        <FieldIcon className="absolute top-[50%] left-3 text-muted transform-[translateY(-50%)] pointer-events-none auth-field-icon" aria-hidden="true" />
        <input id={id} className="auth-input" required {...inputProps} />
      </div>
    </div>
  );
}

function PasswordField({ id, autoComplete, minLength, visible, onToggle, hint }) {
  return (
    <div className="grid gap-2">
      <label htmlFor={id} className="text-[14px] font-medium leading-none">Password</label>
      <div className="relative">
        <LuLock className="absolute top-[50%] left-3 text-muted transform-[translateY(-50%)] pointer-events-none auth-field-icon" aria-hidden="true" />
        <input
          id={id}
          name="password"
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder="••••••••"
          required
          minLength={minLength}
          className="auth-input pr-10"
        />
        <button
          type="button"
          className="auth-toggle"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          onClick={onToggle}
        >
          {visible ? <LuEyeOff className="auth-icon" aria-hidden="true" /> : <LuEye className="auth-icon" aria-hidden="true" />}
        </button>
      </div>
      {hint && <p className="m-0 text-muted text-[12px]">{hint}</p>}
    </div>
  );
}

export default function AuthModal({ initialTab, onClose }) {
  const { signIn, signUp } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const dialogRef = useRef(null);
  const [tab, setTab] = useState(initialTab);
  const [showLoginPw, setShowLoginPw] = useState(false);
  const [showSignupPw, setShowSignupPw] = useState(false);
  const [remember, setRemember] = useState(false);
  const [pending, setPending] = useState(null);
  const [resetNotice, setResetNotice] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Focus management, Escape to close, and background scroll lock while the modal is open.
  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog?.querySelector('[role="tabpanel"][data-state="active"] input')?.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;
      const focusable = [...dialog.querySelectorAll(FOCUSABLE)].filter((element) => !element.closest("[inert]"));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.();
    };
  }, [onClose]);

  async function complete(signInMethod, signInFunc) {
    setPending(signInMethod);
    setErrorMsg("");

    try {
      await signInFunc();
      onClose();

      if (pathname === "/") router.replace("/overview");
    } catch (e) {
      setErrorMsg(e.message);
      setPending(null)
    }
  }

  function handleLogin(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    complete("login", () => signIn({ email: String(form.get("email")), password: String(form.get("password")) }));
  }

  function handleSignup(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    complete("signup", () => signUp({ name: String(form.get("name")), email: String(form.get("email")), password: String(form.get("password")) }));
  }

  function handleProvider(provider) {
    complete(provider, () => signIn({ provider }));
  }

  // Tab pattern: arrow keys move between the two tabs (roving tabindex).
  function handleTabKeyDown(event) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = tab === "login" ? "signup" : "login";
    setTab(next);
    document.getElementById(`auth-tab-${next}`)?.focus();
  }

  const busy = pending !== null;

  function panelProps(value) {
    const active = tab === value;
    return {
      id: `auth-panel-${value}`,
      role: "tabpanel",
      "aria-labelledby": `auth-tab-${value}`,
      "data-state": active ? "active" : "inactive",
      inert: !active,
      className: "auth-panel",
    };
  }

  function socialSection() {
    return (
      <div className="grid gap-5 mt-5">
        <div className="relative h-px bg-line">
          <span className="absolute -top-2.25 left-[50%] px-2 text-muted bg-surface-strong text-[11px] leading-4.5 tracking-widest uppercase transform-[translateX(-50%)]" >or</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button type="button" className="auth-outlineButton" disabled={busy} onClick={() => handleProvider("github")}>
            <FaGithub className="social-icon" aria-hidden="true" /> {pending === "github" ? "Connecting…" : "GitHub"}
          </button>
          <button type="button" className="auth-outlineButton" disabled={busy} onClick={() => handleProvider("google")}>
            <FcGoogle className="social-icon" aria-hidden="true" /> {pending === "google" ? "Connecting…" : "Google"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-1000 flex py-6 px-4 overflow-y-auto text-ink">
      <div className="fixed inset-0 bg-[color-mix(in_srgb,#0b1211 55%,transparent)] backdrop-blur-[6px] animate-auth-fade-in" aria-hidden="true" onClick={onClose} />
      <div
        ref={dialogRef}
        className="relative w-full max-w-md m-auto animate-auth-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        aria-describedby="auth-modal-description"
      >
        <div className="relative border border-line rounded-lg text-ink bg-surface-strong shadow-[0 25px 50px -12px color-mix(in srgb, #000 28%, transparent)]">
          <button
            type="button"
            className="absolute top-3 right-3 grid place-items-center p-2 border-0 rounded-md text-muted bg-none cursor-pointer transition-colors duration-200 ease-[ease] hover:text-ink"
            aria-label="Close"
            onClick={onClose}
          >
            <LuX className="auth-icon" aria-hidden="true" />
          </button>

          <div className="grid gap-1 p-6 pr-12">
            <h2 id="auth-modal-title" className="m-0 text-[24px] font-semibold leading-none tracking-[-.01em]">Cruz Control</h2>
            <p id="auth-modal-description" className="mt-1 m-0 text-muted text-[14px] leading-[1.45]">
              Log in or create an account to save scans and track your websites and repositories.
            </p>
          </div>

          <div className="px-6 pb-6">
            <div
              className="grid grid-cols-2 h-10 p-1 border border-line rounded-md bg-surface-soft"
              role="tablist"
              aria-label="Account"
            >
              {TABS.map(({ value, label }) => (
                <button
                  key={value}
                  id={`auth-tab-${value}`}
                  type="button"
                  role="tab"
                  className="auth-tab"
                  aria-selected={tab === value}
                  aria-controls={`auth-panel-${value}`}
                  tabIndex={tab === value ? 0 : -1}
                  onClick={() => setTab(value)}
                  onKeyDown={handleTabKeyDown}
                >
                  {label}
                </button>
              ))}
            </div>

            {errorMsg && <p role="alert" className="mt-4 m-0 text-critical text-[13px]">{errorMsg}</p>}

            <div className="grid mt-6">
              <div {...panelProps("login")}>
                <form className="grid gap-5" onSubmit={handleLogin}>
                  <TextField id="login-email" label="Email" icon={LuMail} name="email" type="email" autoComplete="email" placeholder="you@example.com" />
                  <PasswordField id="login-password" autoComplete="current-password" visible={showLoginPw} onToggle={() => setShowLoginPw((value) => !value)} />

                  <div className="flex align-items-center justify-between gap-3">
                    <label className="inline-flex align-items-center gap-2 text-muted text-[14px] font-medium cursor-pointer">
                      <input type="checkbox" className="w-4 h-4 m-0 accent-accent cursor-pointer" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
                      Remember me
                    </label>
                    <button type="button" className="p-0 text-muted bg-none text-[14px] cursor-pointer transition-colors duration-200 ease-[ease] underline hover:text-ink" onClick={() => setResetNotice(true)}>
                      Forgot password?
                    </button>
                  </div>
                  {resetNotice && (
                    <p role="status" className="-mt-2 m-0 text-muted text-[12px]">
                      Password reset isn&apos;t available in this preview yet.
                    </p>
                  )}

                  <button type="submit" className="auth-primaryButton" disabled={busy}>
                    {pending === "login" ? "Signing in…" : "Sign in"}
                  </button>
                </form>
                {socialSection()}
              </div>

              <div {...panelProps("signup")}>
                <form className="grid gap-[20px]" onSubmit={handleSignup}>
                  <TextField id="signup-name" label="Full name" icon={LuUser} name="name" type="text" autoComplete="name" placeholder="Your name" />
                  <TextField id="signup-email" label="Email" icon={LuMail} name="email" type="email" autoComplete="email" placeholder="you@example.com" />
                  <PasswordField
                    id="signup-password"
                    autoComplete="new-password"
                    minLength={8}
                    visible={showSignupPw}
                    onToggle={() => setShowSignupPw((value) => !value)}
                    hint="At least 8 characters."
                  />

                  <button type="submit" className="auth-primaryButton" disabled={busy}>
                    {pending === "signup" ? "Creating account…" : "Create account"}
                  </button>
                </form>
                {socialSection()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
