"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { LuUserPlus } from "react-icons/lu";

import api from "@/lib/api";
import { useAuth } from "@/components/auth/auth-provider";
import LoginRequired from "@/components/auth/login-required";
import ProjectModal from "./project-modal";
import MemberModal from "./member-modal";
import { useScan } from "../overview/scan-context";

const ProjectPage = _ => {
    const { status, user } = useAuth();
    const router = useRouter();
    const { startScan } = useScan();
    const popupModalRef = useRef(null);
    const memberRef = useRef(null);
    const [projects, setProjects] = useState([]);
    const [error, setError] = useState("");
    const [form, setForm] = useState({ name: "", domain: "", githubRepo: "" });
    const [loading, setLoading] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [memberProject, setMemberProject] = useState(null);
    const [invites, setInvites] = useState([]);

    useEffect(() => {
        if (status !== "authenticated") return;

        const getAllProjects = async _ => {
            try {
                const projectResponse = await api.get("/api/project");
                setProjects(projectResponse.data);

                const inviteResponse = await api.get("/api/invite");
                setInvites(inviteResponse.data);
            } catch (e) {
                setError(e.response?.data?.error ?? "Could not load projects.")
            }
        }

        getAllProjects();
    }, [status])

    if (status === "loading") return null;

    if (status === "guest") {
        return <LoginRequired title="Projects need an account" message="Log in to save your scan result to a project" /> 
    }

    const updateField = event => {
        setForm({ ...form, [event.target.name]: event.target.value });
    }

    const openModal = project => {
        setEditingId(project?.id ?? null);
        setForm({ name: project?.name ?? "", domain: project?.domain ?? "", githubRepo: project?.github_repo ?? "" });
        setError("");
        popupModalRef.current.showModal();
    }

    const openMemberModal = project => {
        setMemberProject(project);
        memberRef.current.showModal();
    }

    const scanProject = project => {
        if (!project.domain) return;
        startScan(project.domain, { linkedRepository: project.github_repo ? `github.com/${project.github_repo}` : null, fast: false });
        router.push("/overview");
    };

    const createProject = async event => {
        event.preventDefault();
        setLoading(true);
        setError("");
        try {
            if (editingId) {
                const response = await api.put(`/api/project/${editingId}`, form);
                setProjects(projects.map(p => p.id === editingId ? response.data : p));
                popupModalRef.current.close();
                return;
            }

            const response = await api.post("/api/project", form);
            setProjects([response.data, ...projects]);
            setForm({ name: "", domain: "", githubRepo: "" });
            popupModalRef.current.close();

            scanProject(response.data);
        } catch (e) {
            setError(e.response?.data?.error ?? "Could not create or update project.");
        } finally {
            setLoading(false)
        }
    }

    const deleteProject = async project => {
        if (!window.confirm(`Confirm to delete ${project.name}?`)) return;
        try {
            await api.delete(`/api/project/${project.id}`);
            setProjects(projects.filter(tmp => tmp.id !== project.id))
        } catch (e) {
            setError(e.response?.data?.error ?? "Could not delete project.");
        }
    }

    const acceptInvite = async invite => {
        try {
            await api.post(`/api/invite/${invite.id}/accept`);
            setInvites(invites.filter(i => i.id !== invite.id));
            
            const response = await api.get("/api/project");
            setProjects(response.data);
        } catch (e) {   
            setError(e.response?.data?.error ?? "Could not accept the invite.");
        }
    }

    const declineInvite = async invite => {
        try {
            await api.delete(`/api/invite/${invite.id}`);
            setInvites(invites.filter(i => i.id !== invite.id));
        } catch (e) {   
            setError(e.response?.data?.error ?? "Could not decline the invite.");
        }
    }

    return (
        <div className="grid gap-4">


            {invites.length > 0 && (
                <>
                <div className="flex gap-3">
                    <h1 className="text-2xl">My Invitations</h1>
                    <span className="bg-accent rounded-full px-3 py-1 text-background">{invites.length}</span>
                </div>
                

                <ul className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
                    {invites.map(invite => (
                        <li key={invite.id} className="grid gap-3 p-5 border border-dashed border-accent rounded-2xl bg-surface shadow-sm">
                            <div>
                                <h3 className="font-semibold">{invite.projects?.name}</h3>
                                <span className="text-xs text-accent capitalize">Invited as {invite.role}</span>
                            </div>

                            <dl className="grid grid-cols-[90px_1fr] gap-y-1 text-sm">
                                <dt className="text-muted">Domain</dt>
                                <dd className="font-mono">{invite.projects?.domain ?? <i className="text-muted">none</i>}</dd>
                                <dt className="text-muted">Repository</dt>
                                <dd className="font-mono break-all">{invite.projects?.github_repo ?? <i className="text-muted">none</i>}</dd>
                            </dl>

                            <div className="flex gap-2 justify-end text-sm">
                                <button type="button" onClick={() => declineInvite(invite)} className="text-muted hover:text-critical cursor-pointer">Decline</button>
                                <button type="button" onClick={() => acceptInvite(invite)} className="h-8 px-3 rounded-full border border-accent text-accent text-xs font-semibold hover:bg-accent-soft/20 cursor-pointer">Accept</button>
                            </div>
                        </li>
                    ))}
                </ul>  
                </>
            )}

             

            <h1 className="text-2xl font-semibold">My Projects</h1>

            <ProjectModal editing={Boolean(editingId)} modalRef={popupModalRef} form={form} updateField={updateField} onSubmit={createProject} error={error} loading={loading} />
            <MemberModal project={memberProject} modalRef={memberRef} />

            {error && <p role="alert" className="text-critical">{error}</p>}

            <ul className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
                {projects.map(p => (
                    <li key={p.id} className="grid gap-3 p-5 border border-line rounded-2xl bg-surface shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                            <div>
                                <h3 className="font-semibold">{p.name}</h3>
                                <span className="text-xs text-muted capitalize">Project {p.role}</span>
                            </div>
                            {p.role === "owner" && (
                                <button 
                                    aria-label={`Manage members of ${p.name}`} 
                                    className="p-1.5 rounded-lg text-muted hover:text-accent hover:bg-line cursor-pointer transition-colors duration-200 ease-[ease]"
                                    onClick={() => openMemberModal(p)}    
                                >
                                    <LuUserPlus size={18} />
                                </button>
                            )}
                        </div>
                        
                        <dl className="grid grid-cols-[90px_1fr] gap-y-1 text-sm">
                            <dt className="text-muted">Domain</dt>
                            <dd className="font-mono">{p.domain ?? <i className="text-muted">none</i>}</dd>
                            <dt className="text-muted">Repository</dt>
                            <dd className="font-mono break-all">{p.github_repo ?? <i className="text-muted">none</i>}</dd>
                        </dl>

                        <button
                            disabled
                            className="h-9 rounded-lg border border-line text-sm font-semibold text-muted disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                            View results
                        </button>

                        {p.role === "owner" && (
                            <div className="flex text-sm justify-between">
                                <button 
                                    onClick={() => scanProject(p)}
                                    disabled={!p.domain}
                                    className="h-8 px-3 rounded-full border border-accent text-accent text-xs font-semibold hover:bg-accent-soft/20 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    Re-scan
                                </button>
                                <div className="flex gap-3">
                                    <button onClick={() => openModal(p)} className="text-muted hover:text-ink cursor-pointer">Edit</button>
                                    {p.created_by === user?.id && (
                                        <button onClick={() => deleteProject(p)} className="text-muted hover:text-critical cursor-pointer">Delete</button>
                                    )}
                                </div>
                            </div>
                        )}
                    </li>
                ))}
                <li>
                    <button 
                        type="button" 
                        onClick={() => openModal(null)} 
                        className="grid place-items-center content-center gap-1 w-full h-full min-h-48 cursor-pointer border border-dashed border-accent-soft rounded-2xl text-muted font-semibold hover:text-accent hover:border-accent hover:bg-line hover:opacity-50 transition-colors duration-300 ease-[ease]"
                    >
                        <span className="text-2xl">+</span>
                        New Project
                    </button>
                </li>
            </ul>
        </div>
    )
}

export default ProjectPage;