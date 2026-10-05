"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import styles from "./profile-menu.module.css";

const PLACEHOLDER_PROFILE = {
  initials: "TK",
  name: "tk",
  email: "tk.liang.2024@smu.edu.sg",
  repositories: [
    { name: "kopiwerks-site", detail: "Public · checked 2h ago" },
    { name: "cruz-control", detail: "Public · not scanned" },
  ],
  websites: [
    { name: "kopiwerks.sg", cadence: "weekly" },
    { name: "merlion-labs.io", cadence: "off" },
  ],
};

export default function ProfileMenu({ profile = PLACEHOLDER_PROFILE, onSignOut }) {
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
    // Wait for the real session to end (e.g. Supabase signOut) before leaving the page.
    if (onSignOut) await onSignOut();
    // replace (not push) so Back doesn't return to a signed-in page.
    router.replace("/");
  }

  if (!profile) {
    return <Link href="/login" className={styles.loginLink}>Login</Link>;
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
        <svg className={styles.chevron} aria-hidden="true" viewBox="0 0 12 12">
          <path d="m3 4.5 3 3 3-3" />
        </svg>
      </button>

      {open && (
        <section className={styles.menu} role="dialog" aria-label="Profile and tracked assets">
          <div className={styles.identity}>
            <span className={styles.identityAvatar} aria-hidden="true">{profile.initials}</span>
            <div>
              <strong>{profile.name}</strong>
              <span>{profile.email}</span>
            </div>
            <span className={styles.previewBadge}>Preview</span>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionHeading}>
              <span>Tracked repositories</span>
              <strong>{profile.repositories.length}</strong>
            </div>
            <div className={styles.assetList}>
              {profile.repositories.map((repository) => (
                <div className={styles.repository} key={repository.name}>
                  <span className={styles.assetIcon} aria-hidden="true">&lt;/&gt;</span>
                  <div><strong>{repository.name}</strong><small>{repository.detail}</small></div>
                  <span className={styles.statusDot} aria-label="Tracked" />
                </div>
              ))}
            </div>
          </div>

          <div className={styles.section}>
            <div className={styles.sectionHeading}>
              <span>Tracked websites</span>
              <strong>{profile.websites.length}</strong>
            </div>
            <div className={styles.websiteList}>
              {profile.websites.map((website) => (
                <div className={styles.website} key={website.name}>
                  <span>{website.name}</span>
                  <small>{website.cadence}</small>
                </div>
              ))}
            </div>
          </div>

          <button type="button" className={styles.signOut} onClick={handleSignOut}>
            <svg aria-hidden="true" viewBox="0 0 20 20"><path d="M8 3H4v14h4M12 6l4 4-4 4m4-4H7" /></svg>
            Sign out
          </button>
        </section>
      )}
    </div>
  );
}
