"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FaGithub } from "react-icons/fa6";
import { FcGoogle } from "react-icons/fc";
import { LuEye, LuEyeOff, LuLock, LuMail, LuUser, LuX } from "react-icons/lu";
import { useAuth } from "./auth-provider";
import styles from "@/styles/components/auth-modal.module.css";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

const TABS = [
  { value: "login", label: "Log In" },
  { value: "signup", label: "Sign Up" },
];

function TextField({ id, label, icon: FieldIcon, ...inputProps }) {
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>{label}</label>
      <div className={styles.inputWrap}>
        <FieldIcon className={styles.fieldIcon} aria-hidden="true" />
        <input id={id} className={styles.input} required {...inputProps} />
      </div>
    </div>
  );
}

function PasswordField({ id, autoComplete, minLength, visible, onToggle, hint }) {
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>Password</label>
      <div className={styles.inputWrap}>
        <LuLock className={styles.fieldIcon} aria-hidden="true" />
        <input
          id={id}
          name="password"
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          placeholder="••••••••"
          required
          minLength={minLength}
          className={`${styles.input} ${styles.inputWithToggle}`}
        />
        <button
          type="button"
          className={styles.toggle}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          onClick={onToggle}
        >
          {visible ? <LuEyeOff className={styles.icon} aria-hidden="true" /> : <LuEye className={styles.icon} aria-hidden="true" />}
        </button>
      </div>
      {hint && <p className={styles.hint}>{hint}</p>}
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

  async function complete(key, action) {
    setPending(key);
    await action();
    onClose();
    // Post-login: continue from the landing page to /overview; elsewhere, stay on the current page.
    if (pathname === "/") router.replace("/overview");
  }

  function handleLogin(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    complete("login", () => signIn({ email: String(form.get("email")), remember }));
  }

  function handleSignup(event) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    complete("signup", () => signUp({ name: String(form.get("name")), email: String(form.get("email")) }));
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
      className: styles.panel,
    };
  }

  function socialSection() {
    return (
      <div className={styles.social}>
        <div className={styles.divider}><span>or</span></div>
        <div className={styles.oauth}>
          <button type="button" className={styles.outlineButton} disabled={busy} onClick={() => handleProvider("github")}>
            <FaGithub className={styles.brandIcon} aria-hidden="true" /> {pending === "github" ? "Connecting…" : "GitHub"}
          </button>
          <button type="button" className={styles.outlineButton} disabled={busy} onClick={() => handleProvider("google")}>
            <FcGoogle className={styles.brandIcon} aria-hidden="true" /> {pending === "google" ? "Connecting…" : "Google"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.backdrop} aria-hidden="true" onClick={onClose} />
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        aria-describedby="auth-modal-description"
      >
        <div className={styles.card}>
          <button type="button" className={styles.close} aria-label="Close" onClick={onClose}>
            <LuX className={styles.icon} aria-hidden="true" />
          </button>

          <div className={styles.header}>
            <h2 id="auth-modal-title" className={styles.title}>Cruz Control</h2>
            <p id="auth-modal-description" className={styles.description}>
              Log in or create an account to save scans and track your websites and repositories.
            </p>
          </div>

          <div className={styles.content}>
            <div className={styles.tabList} role="tablist" aria-label="Account">
              {TABS.map(({ value, label }) => (
                <button
                  key={value}
                  id={`auth-tab-${value}`}
                  type="button"
                  role="tab"
                  className={styles.tab}
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

            <div className={styles.shell}>
              <div {...panelProps("login")}>
                <form className={styles.form} onSubmit={handleLogin}>
                  <TextField id="login-email" label="Email" icon={LuMail} name="email" type="email" autoComplete="email" placeholder="you@example.com" />
                  <PasswordField id="login-password" autoComplete="current-password" visible={showLoginPw} onToggle={() => setShowLoginPw((value) => !value)} />

                  <div className={styles.row}>
                    <label className={styles.remember}>
                      <input type="checkbox" className={styles.checkbox} checked={remember} onChange={(event) => setRemember(event.target.checked)} />
                      Remember me
                    </label>
                    <button type="button" className={styles.textButton} onClick={() => setResetNotice(true)}>
                      Forgot password?
                    </button>
                  </div>
                  {resetNotice && (
                    <p role="status" className={styles.notice}>
                      Password reset isn&apos;t available in this preview yet.
                    </p>
                  )}

                  <button type="submit" className={styles.primaryButton} disabled={busy}>
                    {pending === "login" ? "Signing in…" : "Sign in"}
                  </button>
                </form>
                {socialSection()}
              </div>

              <div {...panelProps("signup")}>
                <form className={styles.form} onSubmit={handleSignup}>
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

                  <button type="submit" className={styles.primaryButton} disabled={busy}>
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
