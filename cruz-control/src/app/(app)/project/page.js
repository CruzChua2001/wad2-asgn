"use client";

import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { LuCheck, LuCodeXml, LuFolder, LuGlobe, LuPlus, LuX } from "react-icons/lu";
import { useRouter } from "next/navigation";
import { useScan } from "../overview/scan-context";

import api from "@/lib/api";
import LoginRequired from "@/components/auth/login-required";

// Input with an icon inside, styled like the scan form
const Field = ({ icon: Icon, label, ...props }) => (
    <label className="grid gap-2 font-mono text-[13px] font-semibold">
        {label}
        <span className="flex items-center gap-3 h-12 px-4 border border-line rounded-xl bg-page focus-within:border-accent">
            <Icon size={18} className="shrink-0 text-accent" aria-hidden="true" />
            <input className="w-full bg-transparent outline-none text-sm font-normal" {...props} />
        </span>
    </label>
);

const TARGETS = [
    { key: "domain", label: "Domain", icon: LuGlobe, placeholder: "example.com" },
    { key: "githubRepo", label: "GitHub repository", icon: LuCodeXml, placeholder: "github.com/repo" },
];

const ProjectModal = ({ modalRef, form, updateField, onSubmit, error, loading }) => {
    const [shown, setShown] = useState({ domain: true, githubRepo: false });

    const toggleTarget = key => {
        const next = { ...shown, [key]: !shown[key] };
        if (!next.domain && !next.githubRepo) return; 
        setShown(next);
        if (!next[key]) updateField({ target: { name: key, value: "" } });
    };

    return (
        <dialog ref={modalRef} className="m-auto w-[min(560px,calc(100%-32px))] p-0 rounded-2xl border border-line bg-surface text-ink shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-sm">
            <form onSubmit={onSubmit} className="grid gap-5 p-8">
                <div className="flex items-start justify-between gap-4">
                    <div className="grid gap-1">
                        <span className="font-mono text-[11px] tracking-[0.18em] text-muted">NEW PROJECT</span>
                        <h2 className="text-2xl font-semibold">Track a site or repo</h2>
                        <p className="text-sm text-muted">Add a domain, a GitHub repository, or both. We&apos;ll scan it straight away.</p>
                    </div>
                    <button type="button" aria-label="Close" onClick={() => modalRef.current.close()} className="p-2 rounded-lg text-muted hover:text-ink hover:bg-surface-soft">
                        <LuX size={18} />
                    </button>
                </div>  

                {error && <p role="alert" className="text-sm text-critical">{error}</p>}

                <Field icon={LuFolder} label="Project name" name="name" value={form.name} onChange={updateField} maxLength={60} required placeholder="e.g. WAD2 Assignment 1" />

                <fieldset className="grid gap-3 p-4 border border-dashed border-line rounded-xl">
                    <legend className="px-2 font-mono text-[11px] tracking-[0.18em] text-muted">CHOOSE WHAT TO SCAN · PICK ONE OR BOTH</legend>
                    <div className="flex flex-wrap gap-2">
                         {TARGETS.map(t => (
                            <button
                                key={t.key}
                                type="button"
                                aria-pressed={shown[t.key]}
                                onClick={() => toggleTarget(t.key)}
                                className={`flex items-center gap-2 h-9 px-3 rounded-full border text-sm ${shown[t.key] ? "border-accent bg-accent-soft/20 text-ink" : "border-line text-muted hover:text-ink cursor-pointer"}`}
                            >
                                {shown[t.key] ? <LuCheck size={14} /> : <LuPlus size={14} />} {t.label}
                            </button>
                        ))}
                    </div>
                    {TARGETS.filter(t => shown[t.key]).map(t => (
                        <Field key={t.key} icon={t.icon} label={t.label} name={t.key} value={form[t.key]} onChange={updateField} placeholder={t.placeholder} />
                    ))}
                </fieldset>

                <div className="flex gap-3 pt-5 border-t border-line">
                    <button type="button" className="auth-outlineButton flex-1" onClick={() => modalRef.current.close()}>Cancel</button>
                    <button type="submit" className="auth-primaryButton flex-1" disabled={loading}>{loading ? "Creating..." : "Create & scan"}</button>
                </div>
            </form>
        </dialog>
    );
};

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