"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { LuCodeXml, LuGlobe, LuPencil, LuPlus, LuRefreshCw, LuTrash2, LuUserPlus } from "react-icons/lu";

import api from "@/lib/api";
import { useAuth } from "@/components/auth/auth-provider";
import LoginRequired from "@/components/auth/login-required";
import GradeBadge from "@/components/grade-badge";
import ProjectModal from "./project-modal";
import MemberModal from "./member-modal";
import DeleteModal from "./delete-modal";
import ScoreSparkline, { scoreTone } from "./score-sparkline";
import { useScan } from "../scan/scan-context";
import { getRating } from "../scan/scan-result";

const shortDate = date => new Date(date).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

const EASE = [0.22, 1, 0.36, 1];

const IconButton = ({ label, danger, ...props }) => (
    <button
        type="button"
        aria-label={label}
        title={label}
        className={`grid place-items-center size-8 rounded-lg text-muted hover:bg-line/50 cursor-pointer transition-colors duration-200 ${danger ? "hover:text-critical" : "hover:text-accent"}`}
        {...props}
    />
);

// Domain and repo rows, shared by the invite and project cards
const Targets = ({ domain, repo }) => (
    <dl className="grid grid-cols-[104px_minmax(0,1fr)] gap-y-1.5 text-sm">
        <dt className="flex items-center gap-1.5 text-muted"><LuGlobe size={14} aria-hidden="true" /> Domain</dt>
        <dd className="font-mono break-all">{domain ?? <i className="text-muted">none</i>}</dd>
        <dt className="flex items-center gap-1.5 text-muted"><LuCodeXml size={14} aria-hidden="true" /> Repository</dt>
        <dd className="font-mono break-all">{repo ?? <i className="text-muted">none</i>}</dd>
    </dl>
);

const ProjectPage = _ => {
    const { status, user } = useAuth();
    const router = useRouter();
    const { startScan, phase, scan } = useScan();
    const reduceMotion = useReducedMotion();
    const popupModalRef = useRef(null);
    const memberRef = useRef(null);
    const deleteRef = useRef(null);
    const submitRef = useRef(false);
    const [projects, setProjects] = useState([]);
    const [error, setError] = useState("");
    const [formError, setFormError] = useState("");
    const [form, setForm] = useState({ name: "", domain: "", githubRepo: "" });
    const [loading, setLoading] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [memberProject, setMemberProject] = useState(null);
    const [deletingProject, setDeletingProject] = useState(null);
    const [invites, setInvites] = useState([]);
    const [busyInviteId, setBusyInviteId] = useState(null);
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        if (status !== "authenticated") return;

        const getAllProjects = async _ => {
            try {
                // Load both together so the cards animate in at the same time. A failed invite list still shows the projects
                const [projectResponse, inviteResponse] = await Promise.all([api.get("/api/project"), api.get("/api/invite").catch(_ => ({ data: [] }))]);
                setProjects(projectResponse.data);
                setInvites(inviteResponse.data);
            } catch (e) {
                setError(e.response?.data?.error ?? "Could not load projects.")
            } finally {
                setLoaded(true);
            }
        }

        getAllProjects();
    }, [status])

    if (status === "loading") return null;

    if (status === "guest") {
        return <LoginRequired title="Projects need an account" message="Log in to save your scan result to a project" />
    }

    // Cards rise in one after another, and slide into place when one is added or removed
    const cardMotion = index => (reduceMotion ? {} : {
        layout: "position",
        initial: { opacity: 0, y: 12 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, scale: 0.95, transition: { duration: 0.25 } },
        transition: { duration: 0.4, delay: index * 0.06, ease: EASE, layout: { duration: 0.3, ease: EASE } },
    });

    const updateField = event => {
        setForm({ ...form, [event.target.name]: event.target.value });
    }

    const openModal = project => {
        setEditingId(project?.id ?? null);
        setForm({ name: project?.name ?? "", domain: project?.domain ?? "", githubRepo: project?.github_repo ?? "" });
        setFormError("");
        popupModalRef.current.showModal();
    }

    const openMemberModal = project => {
        // A new object each time, so reopening the same project loads its members again
        setMemberProject({ ...project });
        memberRef.current.showModal();
    }

    const openDeleteModal = project => {
        setDeletingProject(project);
        deleteRef.current.showModal();
    }

    const scanProject = project => {
        startScan({ domain: project.domain, githubRepo: project.github_repo, projectId: project.id, force: true })
        router.push("/scan");
    };

    const createProject = async event => {
        event.preventDefault();
        if (submitRef.current) return;
        submitRef.current = true;
        setLoading(true);
        setFormError("");
        try {
            if (editingId) {
                const response = await api.put(`/api/project/${editingId}`, form);
                // Keep the latest scan and scores, the edit answer doesn't have them
                setProjects(projects.map(p => p.id === editingId ? { ...p, ...response.data } : p));
                popupModalRef.current.close();
                return;
            }

            const response = await api.post("/api/project", form);
            setProjects(current => [response.data, ...current]);
            setForm({ name: "", domain: "", githubRepo: "" });
            popupModalRef.current.close();

            scanProject(response.data);
        } catch (e) {
            setFormError(e.response?.data?.error ?? "Could not create or update project.");
        } finally {
            submitRef.current = false;
            setLoading(false)
        }
    }

    const removeProject = project => {
        setProjects(projects.filter(tmp => tmp.id !== project.id));
    }

    // busyInviteId stops a double click sending the same request twice
    const acceptInvite = async invite => {
        setBusyInviteId(invite.id);
        setError("");
        try {
            await api.post(`/api/invite/${invite.id}/accept`);
            setInvites(invites.filter(i => i.id !== invite.id));

            const response = await api.get("/api/project");
            setProjects(response.data);
        } catch (e) {
            setError(e.response?.data?.error ?? "Could not accept the invite.");
        } finally {
            setBusyInviteId(null);
        }
    }

    const declineInvite = async invite => {
        setBusyInviteId(invite.id);
        setError("");
        try {
            await api.delete(`/api/invite/${invite.id}`);
            setInvites(invites.filter(i => i.id !== invite.id));
        } catch (e) {
            setError(e.response?.data?.error ?? "Could not decline the invite.");
        } finally {
            setBusyInviteId(null);
        }
    }

    return (
        <div className="grid gap-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="grid gap-1">
                    <h1 className="text-3xl font-semibold tracking-tight">My Projects</h1>
                    <p className="text-sm text-muted">Use Re-scan to add a scan to an existing project. New project creates a separate project.</p>
                </div>
                <div className="text-sm font-semibold">
                    <button
                        type="button"
                        onClick={() => openModal(null)}
                        className="flex items-center justify-center gap-2 w-full sm:w-auto h-10 px-4 rounded-lg bg-accent text-page hover:bg-accent-bright cursor-pointer transition-colors duration-200"
                    >
                        <LuPlus size={16} aria-hidden="true" /> New project
                    </button>
                </div>
            </div>

            <ProjectModal editing={Boolean(editingId)} modalRef={popupModalRef} form={form} updateField={updateField} onSubmit={createProject} error={formError} loading={loading} />
            <MemberModal project={memberProject} modalRef={memberRef} />
            <DeleteModal project={deletingProject} modalRef={deleteRef} onDeleted={removeProject} />

            {error && <p role="alert" className="text-critical">{error}</p>}

            {/* LayoutGroup lets the project cards slide up once an invite card has left */}
            <LayoutGroup>
                <AnimatePresence>
                    {invites.length > 0 && (
                        <motion.section key="invites" exit={{ opacity: 0, transition: { duration: 0.25 } }} aria-labelledby="invites-title" className="grid gap-4 pb-8 border-b border-line">
                            <div className="grid gap-1">
                                <div className="flex items-center gap-2">
                                    <h2 id="invites-title" className="text-lg font-semibold">Invitations</h2>
                                    <span className="rounded-full bg-accent-soft/30 px-2.5 py-0.5 text-xs font-semibold text-accent">{invites.length}</span>
                                </div>
                                <p className="text-sm text-muted">Accept an invite to see that project here.</p>
                            </div>

                            <ul className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))]">
                                <AnimatePresence>
                                    {invites.map((invite, index) => (
                                        <motion.li key={invite.id} {...cardMotion(index)} className="grid gap-4 p-5 border border-dashed border-accent rounded-2xl bg-surface shadow-sm hover:shadow-md transition-[translate,box-shadow] duration-200 motion-safe:hover:-translate-y-1">
                                            <div className="min-w-0">
                                                <h3 className="font-semibold break-words">{invite.projects?.name}</h3>
                                                <span className="text-xs text-accent capitalize">Invited as {invite.role}</span>
                                            </div>

                                            <Targets domain={invite.projects?.domain} repo={invite.projects?.github_repo} />

                                            <div className="flex items-center justify-end gap-2 text-sm font-semibold">
                                                <button type="button" onClick={() => declineInvite(invite)} disabled={busyInviteId === invite.id} className="h-9 px-3 rounded-lg text-muted hover:text-critical cursor-pointer transition-colors duration-200 disabled:cursor-default disabled:opacity-60">Decline<span className="sr-only"> the invite to {invite.projects?.name}</span></button>
                                                <button type="button" onClick={() => acceptInvite(invite)} disabled={busyInviteId === invite.id} className="h-9 px-4 rounded-lg bg-accent text-page hover:bg-accent-bright cursor-pointer transition-colors duration-200 disabled:cursor-default disabled:opacity-60">Accept<span className="sr-only"> the invite to {invite.projects?.name}</span></button>
                                            </div>
                                        </motion.li>
                                    ))}
                                </AnimatePresence>
                            </ul>
                        </motion.section>
                    )}
                </AnimatePresence>

                <h2 className="sr-only">Your projects</h2>
                <ul className="relative grid gap-4 grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))]">
                    <AnimatePresence mode="popLayout">
                        {projects.map((p, index) => (
                            <motion.li key={p.id} {...cardMotion(index)} className="flex flex-col gap-4 p-5 border border-line rounded-2xl bg-surface shadow-sm hover:border-accent-soft hover:shadow-md transition-[translate,border-color,box-shadow] duration-200 motion-safe:hover:-translate-y-1">
                                <div className="flex items-start gap-3">
                                    <GradeBadge grade={p.latestScan?.grade ?? null} size="md" />
                                    <div className="grid gap-0.5 min-w-0 flex-1">
                                        <h3 className="font-semibold break-words">{p.name}</h3>
                                        <span className="text-xs text-muted">
                                            <span className="capitalize">{p.role}</span>
                                            {p.latestScan && ` · Scanned ${shortDate(p.latestScan.created_at)}`}
                                        </span>
                                    </div>
                                    <div className="flex gap-0.5 -mr-1.5 -mt-1">
                                        {p.role === "owner" && (
                                            <>
                                                <IconButton label={`Manage members of ${p.name}`} onClick={() => openMemberModal(p)}><LuUserPlus size={17} /></IconButton>
                                                <IconButton label={`Edit ${p.name}`} onClick={() => openModal(p)}><LuPencil size={16} /></IconButton>
                                            </>
                                        )}
                                        {p.created_by === user?.id && (
                                            <IconButton label={`Delete ${p.name}`} danger onClick={() => openDeleteModal(p)}><LuTrash2 size={16} /></IconButton>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between gap-3 min-h-14 px-4 py-3 rounded-xl bg-surface-soft">
                                    {p.latestScan ? (
                                        <p className="flex flex-wrap items-baseline gap-x-1.5 min-w-0">
                                            <span className="text-3xl font-semibold leading-none tabular-nums">{p.latestScan.score}</span>
                                            <span className="text-sm text-muted">/100</span>
                                            {/* No grade means a critical check couldn't run, like "Incomplete, re-scan" on the Overview */}
                                            <span className={`ml-1 text-sm font-semibold ${p.latestScan.grade ? scoreTone(p.latestScan.score) : "text-warm"}`}>
                                                {p.latestScan.grade ? getRating(p.latestScan.score) : "Incomplete"}
                                            </span>
                                        </p>
                                    ) : (
                                        <p className="text-sm text-muted">Not scanned yet</p>
                                    )}
                                    <ScoreSparkline scores={p.scores} />
                                </div>

                                <Targets domain={p.domain} repo={p.github_repo} />

                                <Link href={`/project/${p.id}/history`} aria-label={`View history for ${p.name}`} className="inline-flex min-h-10 w-fit items-center rounded-lg border border-line px-3 text-sm font-semibold text-accent hover:border-accent hover:bg-accent-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                                    View history<span className="sr-only"> for {p.name}</span>
                                </Link>

                                <div className="flex gap-2 mt-auto text-sm font-semibold">
                                    {p.latestScan ? (
                                        <Link href={`/scan/${p.latestScan.id}`} className="grid place-items-center flex-1 h-10 rounded-lg bg-accent text-page! no-underline hover:bg-accent-bright transition-colors duration-200">
                                            <span>View results<span className="sr-only"> for {p.name}</span></span>
                                        </Link>
                                    ) : p.role === "owner" ? (
                                        <button type="button" onClick={() => scanProject(p)} className="flex-1 h-10 rounded-lg bg-accent text-page hover:bg-accent-bright cursor-pointer transition-colors duration-200">
                                            Run first scan
                                        </button>
                                    ) : (
                                        <span className="grid place-items-center flex-1 h-10 rounded-lg border border-dashed border-line text-muted">No scans yet</span>
                                    )}

                                    {p.role === "owner" && p.latestScan && (
                                        <button type="button" aria-label={`${phase === "scanning" && scan?.projectId === p.id ? "Scanning..." : "Re-scan"} ${p.name}`} disabled={phase === "scanning" && scan?.projectId === p.id} onClick={() => scanProject(p)} className="flex items-center gap-1.5 h-10 px-3 rounded-lg border border-line text-ink hover:border-accent hover:text-accent cursor-pointer transition-colors duration-200 disabled:cursor-default disabled:opacity-60">
                                            <LuRefreshCw size={15} aria-hidden="true" /> {phase === "scanning" && scan?.projectId === p.id ? "Scanning..." : "Re-scan"}<span className="sr-only"> {p.name}</span>
                                        </button>
                                    )}
                                </div>
                            </motion.li>
                        ))}
                    </AnimatePresence>
                    {/* Shown after loading so it arrives after the last card */}
                    {loaded && (
                        <motion.li {...cardMotion(projects.length)} className="font-semibold">
                            <button
                                type="button"
                                onClick={() => openModal(null)}
                                className="grid place-items-center content-center gap-2 w-full h-full min-h-48 p-5 cursor-pointer border border-dashed border-accent-soft rounded-2xl text-muted hover:text-accent hover:border-accent hover:bg-accent-soft/10 transition-[color,border-color,background-color,translate] duration-300 ease-[ease] motion-safe:hover:-translate-y-1"
                            >
                                <span className="grid place-items-center size-10 rounded-full border border-dashed border-current">
                                    <LuPlus size={18} aria-hidden="true" />
                                </span>
                                New Project
                            </button>
                        </motion.li>
                    )}
                </ul>
            </LayoutGroup>
        </div>
    )
}

export default ProjectPage;
