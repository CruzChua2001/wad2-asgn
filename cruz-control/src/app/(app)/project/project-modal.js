"use client";

import { useState } from "react";
import { LuCheck, LuCodeXml, LuFolder, LuGlobe, LuPlus, LuX } from "react-icons/lu";

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

const ProjectModal = ({ editing, modalRef, form, updateField, onSubmit, error, loading }) => {
    const [shown, setShown] = useState({ domain: true, githubRepo: false });

    const isShown = key => {
        return shown[key] || Boolean(form[key]);
    }

    const toggleTarget = key => {
        const next = { domain: isShown("domain"), githubRepo: isShown("githubRepo"), [key]: !isShown(key) };
        if (!next.domain && !next.githubRepo) return; 
        setShown(next);
        if (!next[key]) updateField({ target: { name: key, value: "" } });
    };

    return (
        <dialog ref={modalRef} className="m-auto w-[min(560px,calc(100%-32px))] p-0 rounded-2xl border border-line bg-surface text-ink shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-sm">
            <form onSubmit={onSubmit} className="grid gap-5 p-8">
                <div className="flex items-start justify-between gap-4">
                    <div className="grid gap-1">
                        <span className="font-mono text-[11px] tracking-[0.18em] text-muted">
                            {editing ? "EDIT PROJECT" : "NEW PROJECT"}
                        </span>
                        <h2 className="text-2xl font-semibold">
                            {editing ? "Update your project" : "Track a site or repo"}
                        </h2>
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
                    <button type="submit" className="auth-primaryButton flex-1" disabled={loading}>
                        {loading ? "Saving..." : editing ? "Save Changes" : "Create & scan"}
                    </button>
                </div>
            </form>
        </dialog>
    );
};

export default ProjectModal;