"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LuChevronDown, LuFolder, LuLogOut } from "react-icons/lu";
import { useAuth } from "@/components/auth/auth-provider";
import styles from "@/styles/overview/profile-menu.module.css";

export default function ProfileMenu() {
  const { status, user: profile, signOut, openAuth } = useAuth();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    }

    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setOpen(false);
        rootRef.current?.querySelector("button")?.focus();
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  async function handleSignOut() {
    setOpen(false);
    // Wait for the session to end before leaving the page.
    await signOut();
    // replace (not push) so Back doesn't return to a signed-in page.
    router.replace("/");
  }

  // Session not read yet: show neither the menu nor Login, so neither flashes.
  if (status === "loading") return null;

  if (!profile) {
    return <button type="button" className={styles.loginLink} onClick={() => openAuth("login")}>Login</button>;
  }

  return (
    <div className={styles.root} ref={rootRef}>
      <button
        type="button"
        className={styles.trigger}
        aria-label={`Open profile menu for ${profile.name}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={styles.avatar} aria-hidden="true">{profile.initials}</span>
        <span className={styles.triggerName}>{profile.name}</span>
        <LuChevronDown className={styles.chevron} aria-hidden="true" />
      </button>

      {open && (
        <section className={styles.menu} role="dialog" aria-label="Profile menu">
          <div className={styles.identity}>
            <span className={styles.identityAvatar} aria-hidden="true">{profile.initials}</span>
            <div>
              <strong>{profile.name}</strong>
              <span>{profile.email}</span>
            </div>
          </div>

          {/* text-muted! because the global "a { color: inherit }" rule beats Tailwind colours */}
          <Link
            href="/project"
            onClick={() => setOpen(false)}
            className="flex items-center gap-[9px] min-h-[45px] px-[15px] border-b border-line text-[10px] text-muted! no-underline hover:text-accent! hover:bg-surface-soft transition-colors duration-200"
          >
            <LuFolder size={16} aria-hidden="true" />
            My projects
          </Link>

          <button type="button" className={styles.signOut} onClick={handleSignOut}>
            <LuLogOut aria-hidden="true" />
            Sign out
          </button>
        </section>
      )}
    </div>
  );
}
