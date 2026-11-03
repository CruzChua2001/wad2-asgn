"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LuChevronDown, LuFolder, LuLogOut } from "react-icons/lu";
import { useAuth } from "@/components/auth/auth-provider";
import GradeBadge from "@/components/grade-badge";
import { loadProjectData } from "@/lib/load-projects";
import { getProjectCache, setProjectCache } from "@/lib/project-cache";
import { getRating } from "./scan-result";
import styles from "@/styles/overview/profile-menu.module.css";

const shortDate = date => new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

// Takes a user id and returns what was last loaded for them: how many projects and invites, and the
// project scanned most recently. Returns null when nothing has been loaded for them yet
function summaryFor(userId) {
  const saved = getProjectCache();
  if (!saved || saved.userId !== userId) return null;

  let latest = null;
  for (const project of saved.projects) {
    if (!project.latestScan) continue;
    if (!latest || new Date(project.latestScan.created_at) > new Date(latest.latestScan.created_at)) latest = project;
  }
  return { projectCount: saved.projects.length, inviteCount: saved.invites.length, latest };
}

export default function ProfileMenu() {
  const { status, user: profile, signOut, openAuth } = useAuth();
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const userId = profile?.id;
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

  // Every time the menu opens, load the latest projects and keep them in the cache for the Projects page.
  // Closing the menu or signing out drops a late answer, so it can't fill the cache for the wrong person.
  // If loading fails the menu keeps whatever it already shows
  useEffect(() => {
    if (!open || !userId) return undefined;

    let current = true;
    loadProjectData()
      .then((data) => {
        if (!current) return;
        setProjectCache({ userId, projects: data.projects, invites: data.invites });
        setSummary(summaryFor(userId));
      })
      .catch(() => {})
      .finally(() => {
        if (current) setSyncing(false);
      });
    return () => { current = false; };
  }, [open, userId]);

  async function handleSignOut() {
    setOpen(false);
    // Wait for the session to end before leaving the page.
    await signOut();
    // replace (not push) so Back doesn't return to a signed-in page.
    router.replace("/");
  }

  // Opening starts from what is already cached, so the menu isn't empty while the latest is loading
  function toggleMenu() {
    if (!open) {
      setSummary(summaryFor(profile.id));
      setSyncing(true);
    }
    setOpen(!open);
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
        onClick={toggleMenu}
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

          {/* Grey shapes while the first load runs; they stand for nothing, and go away if there is no scan to show */}
          {syncing && !summary && (
            <div role="status" className="flex items-center gap-3 px-[15px] py-3 border-b border-line">
              <span className="sr-only">Loading your projects</span>
              <span aria-hidden="true" className="size-12 flex-none rounded-xl bg-surface-soft motion-safe:animate-pulse" />
              <span aria-hidden="true" className="grid flex-1 gap-2">
                <span className="h-3.5 w-3/5 rounded bg-surface-soft motion-safe:animate-pulse" />
                <span className="h-3 w-2/5 rounded bg-surface-soft motion-safe:animate-pulse" />
              </span>
            </div>
          )}

          {summary?.latest && (
            <Link
              href={`/scan/${summary.latest.latestScan.id}`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-3 px-[15px] py-3 border-b border-line no-underline hover:bg-surface-soft transition-colors duration-200"
            >
              <GradeBadge grade={summary.latest.latestScan.grade} size="md" />
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span className="truncate text-sm font-semibold">{summary.latest.name}</span>
                <span className="text-xs text-muted">Latest scan · {shortDate(summary.latest.latestScan.created_at)}</span>
              </span>
              <span className="flex-none text-right">
                <span className="block text-lg font-semibold leading-tight tabular-nums">
                  {summary.latest.latestScan.score}<span className="text-xs font-normal text-muted">/100</span>
                </span>
                <span className="block text-xs text-muted">{summary.latest.latestScan.grade ? getRating(summary.latest.latestScan.score) : "Incomplete"}</span>
              </span>
            </Link>
          )}

          {/* text-muted! because the global "a { color: inherit }" rule beats Tailwind colours */}
          <Link
            href="/project"
            onClick={() => setOpen(false)}
            className="flex items-center gap-[9px] min-h-[45px] px-[15px] border-b border-line text-[13px] text-muted! no-underline hover:text-accent! hover:bg-surface-soft transition-colors duration-200"
          >
            <LuFolder size={16} aria-hidden="true" />
            My projects
            {summary && (summary.inviteCount > 0 || summary.projectCount > 0) && (
              <span className="ml-auto flex items-center gap-1.5 text-xs font-semibold">
                {summary.inviteCount > 0 && (
                  <span className="rounded-full bg-accent-soft/30 px-2 py-0.5 text-accent">
                    {summary.inviteCount} {summary.inviteCount === 1 ? "invite" : "invites"}
                  </span>
                )}
                {summary.projectCount > 0 && (
                  <span className="rounded-full border border-line px-2 py-0.5">
                    {summary.projectCount}<span className="sr-only"> {summary.projectCount === 1 ? "project" : "projects"}</span>
                  </span>
                )}
              </span>
            )}
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
