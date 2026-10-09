"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { useRouter } from "next/navigation";
import { useScan } from "../overview/scan-context";

import api from "@/lib/api";
import LoginRequired from "@/components/auth/login-required";
import ProjectModal from "./project-modal";

const ProjectPage = _ => {
    const { status } = useAuth();
    const router = useRouter();
    const { startScan } = useScan();
    const popupModalRef = useRef(null);
    const [projects, setProjects] = useState([]);
    const [error, setError] = useState("");
    const [form, setForm] = useState({ name: "", domain: "", githubRepo: "" });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (status !== "authenticated") return;

        const getAllProjects = async _ => {
            try {
                const response = await api.get("/api/project");
                setProjects(response.data);
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

    const createProject = async event => {
        event.preventDefault();
        setLoading(true);
        setError("");
        try {
            const response = await api.post("/api/project", form);
            setProjects([response.data, ...projects]);
            setForm({ name: "", domain: "", githubRepo: "" });
            popupModalRef.current.close();

            if (form.domain) {
                startScan(form.domain, { linkedRepository: form.githubRepo ? `github.com/${form.githubRepo}` : null, fast: false });
                router.push("/overview");
            }
        } catch (e) {
            setError(e.response?.data?.error ?? "Could not create project.");
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="grid gap-4">

            <h1 className="text-2xl font-semibold">My Projects</h1>

            <ProjectModal modalRef={popupModalRef} form={form} updateField={updateField} onSubmit={createProject} error={error} loading={loading} />

            {error && <p role="alert" className="text-critical">{error}</p>}

            <ul className="grid gap-4 grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
                {projects.map(p => (
                    <li key={p.id} className="grid gap-3 p-5 border border-line rounded-2xl bg-surface shadow-sm">
                        <h3 className="font-semibold">{p.name}</h3>
                        <dl className="grid grid-cols-[90px_1fr] gap-y-1 text-sm">
                            <dt className="text-muted">Domain</dt>
                            <dd className="font-mono">{p.domain ?? <i className="text-muted">none</i>}</dd>
                            <dt className="text-muted">Repository</dt>
                            <dd className="font-mono break-all">{p.github_repo ?? <i className="text-muted">none</i>}</dd>
                        </dl>
                        <span className="text-xs text-muted capitalize">{p.role}</span>
                    </li>
                ))}
                <li>
                    <button 
                        type="button" 
                        onClick={() => popupModalRef.current.showModal()} 
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