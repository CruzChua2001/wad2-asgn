"use client";

import { useState } from "react";
import { LuTrash2 } from "react-icons/lu";

import api from "@/lib/api";

const DeleteModal = ({ project, modalRef, onDeleted }) => {
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const deleteProject = async _ => {
        setLoading(true);
        setError("");

        try {
            await api.delete(`/api/project/${project.id}`);
            onDeleted(project);
            modalRef.current.close();
        } catch (e) {
            setError(e.response?.data?.error ?? "Could not delete the project. Please try again.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <dialog
            ref={modalRef}
            onClose={() => setError("")}
            aria-labelledby="delete-project-title"
            className="m-auto w-[min(440px,calc(100%-32px))] p-0 rounded-2xl border border-line bg-surface text-ink shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-sm open:animate-auth-dialog backdrop:animate-auth-fade-in"
        >
            <div className="grid gap-5 p-6 sm:p-8">
                <div className="flex items-start gap-4">
                    <span className="grid place-items-center size-11 flex-none rounded-xl bg-critical/10 text-critical">
                        <LuTrash2 size={20} aria-hidden="true" />
                    </span>
                    <div className="grid gap-1 min-w-0">
                        <h2 id="delete-project-title" className="text-xl font-semibold break-words">Delete {project?.name}?</h2>
                        <p className="text-sm text-muted">This deletes the project and its scan history for every member. You can&apos;t undo this.</p>
                    </div>
                </div>

                {error && <p role="alert" className="text-sm text-critical">{error}</p>}

                <div className="flex gap-3 pt-5 border-t border-line text-sm font-medium">
                    <button type="button" className="auth-outlineButton flex-1" onClick={() => modalRef.current.close()}>Cancel</button>
                    <button
                        type="button"
                        onClick={deleteProject}
                        disabled={loading}
                        className="flex-1 h-10 px-4 rounded-lg bg-critical text-page hover:opacity-90 cursor-pointer transition-opacity disabled:opacity-50 disabled:cursor-default"
                    >
                        {loading ? "Deleting..." : "Delete project"}
                    </button>
                </div>
            </div>
        </dialog>
    );
}

export default DeleteModal;
