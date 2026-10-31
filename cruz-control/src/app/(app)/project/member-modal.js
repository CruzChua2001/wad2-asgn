"use client";

import { useEffect, useState } from "react";
import { LuX, LuTrash2 } from "react-icons/lu";

import api from "@/lib/api";
import { useAuth } from "@/components/auth/auth-provider";
import RoleSelect from "./role-select";
import SmallLoader from "@/components/small-loader";

const ROLES = [
    { value: "viewer", text: "Viewer", hint: "Can see the results" },
    { value: "owner", text: "Owner", hint: "Can edit, re-scan and invite" },
]

const MemberModal = ({project, modalRef}) => {
    const { user } = useAuth();
    const [members, setMembers] = useState([]);
    const [invites, setInvites] = useState([]);
    const [email, setEmail] = useState("");
    const [role, setRole] = useState("viewer");
    const [errorMsg, setErrorMsg] = useState("");
    const [loading, setLoading] = useState(false);
    const [loadedId, setLoadedId] = useState(null);
    const [removingId, setRemovingId] = useState(null);

    const isCreator = project?.created_by === user?.id;

    useEffect(() => {
        if (!project) return;
        let ignore = false;

        const getMembers = async _ => {
            try {
                const response = await api.get(`/api/project/${project.id}/member`);
                if (ignore) return;

                setMembers(response.data.members);
                setInvites(response.data.invites);
            } catch (e) {
                if (!ignore) setErrorMsg(e.response?.data?.error ?? "Could not load members.")
            } finally {
                if (!ignore) setLoadedId(project.id);
            }
        }

        getMembers();
        // A slow answer for the last project opened mustn't replace this one's list
        return () => { ignore = true; };
    }, [project])

    const sendInvite = async event => {
        event.preventDefault();
        setLoading(true);
        setErrorMsg("");

        try{
            let data = { email, role }
            const response = await api.post(`/api/project/${project.id}/invite`, data);

            setInvites([...invites.filter(invite => invite.email !== response.data.email), response.data]);
            setEmail("");
        } catch (e) {
            setErrorMsg(e.response?.data?.error ?? "Could not send the invite");
        } finally {
            setLoading(false);
        }
    }

    const removeMember = async member => {
        setRemovingId(member.user_id);

        try {
            await api.delete(`/api/project/${project.id}/member/${member.user_id}`);
            setMembers(members.filter(m => m.user_id !== member.user_id));
        } catch (e) {
            setErrorMsg(e.response?.data?.error ?? "Could not remove the member.");
        } finally {
            setRemovingId(null);
        }
    }

    const cancelInvite = async invite => {
        setRemovingId(invite.id);

        try {
            await api.delete(`/api/project/${project.id}/invite/${invite.id}`);
            setInvites(invites.filter(i => i.id !== invite.id));
        } catch (e) {
            setErrorMsg(e.response?.data?.error ?? "Could not cancel the invite.");
        } finally {
            setRemovingId(null);
        }
    }

    // Runs for the close button and for Escape, so the next project opens with an empty dialog
    const resetModal = _ => {
        setErrorMsg("");
        setEmail("");
        setMembers([]);
        setInvites([]);
    }

    const closeModal = _ => {
        modalRef.current.close();
    }

    return (
        // overflow-visible lets the role list hang below the dialog
        <dialog ref={modalRef} onClose={resetModal} aria-labelledby="member-modal-title" className="m-auto w-[min(520px,calc(100%-32px))] p-0 overflow-visible rounded-2xl border border-line bg-surface text-ink shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-sm open:animate-auth-dialog backdrop:animate-auth-fade-in">
            <div className="grid gap-5 p-6 sm:p-8">
                <div className="flex items-start justify-between gap-4">
                    <div className="grid gap-1">
                        <span className="font-mono text-[11px] tracking-[0.18em] text-muted">MEMBERS</span>
                        <h2 id="member-modal-title" className="text-2xl font-semibold"><span className="sr-only">Members of </span>{project?.name}</h2>
                    </div>
                    <button aria-label="Close" onClick={closeModal} className="p-2 rounded-lg text-muted hover:text-ink cursor-pointer">
                        <LuX size={18} />
                    </button>
                </div>

                {errorMsg && <p role="alert" className="text-sm text-critical">{errorMsg}</p>}

                {/* Long lists scroll here, and the cap shrinks on short screens, so the invite form stays on screen */}
                {loadedId !== project?.id ? <SmallLoader text="Where could your friends be..." className="text-sm text-muted" /> : (
                    <ul className="grid gap-2 max-h-[min(12rem,30vh)] overflow-y-auto text-sm">
                        {members.map(member => (
                            <li key={member.user_id} className="flex justify-between gap-2">
                                <span className="break-all">{member.email}</span>
                                <span className="flex items-center gap-2">
                                    <span className="text-muted capitalize">{member.role}</span>
                                    {isCreator && member.user_id !== user?.id && (
                                        <button aria-label={`Remove ${member.email}`} onClick={() => removeMember(member)} disabled={removingId === member.user_id} className="text-muted hover:text-critical cursor-pointer disabled:cursor-default">
                                            {removingId === member.user_id ? <SmallLoader size={14} /> : <LuTrash2 size={14} />}
                                        </button>
                                    )}
                                </span>
                            </li>
                        ))}
                        {invites.map(invite => (
                            <li key={invite.email} className="flex justify-between gap-2 text-muted">
                                <span className="break-all">{invite.email}</span>
                                <span className="flex items-center gap-2">
                                    <span className="capitalize">Pending - {invite.role}</span>
                                    {isCreator && (
                                        <button type="button" aria-label={`Cancel invite for ${invite.email}`} onClick={() => cancelInvite(invite)} disabled={removingId === invite.id} className="text-muted hover:text-critical cursor-pointer disabled:cursor-default">
                                            {removingId === invite.id ? <SmallLoader size={14} /> : <LuTrash2 size={14} />}
                                        </button>
                                    )}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}

                <form onSubmit={sendInvite} className="flex flex-wrap gap-2 pt-5 border-t border-line">
                    <input 
                        type="email" 
                        required 
                        value={email} 
                        onChange={e => setEmail(e.target.value)} 
                        placeholder="john.doe.2025@computing.smu.edu.sg" 
                        aria-label="Email to invite"
                        className="flex-1 min-w-48 h-10 px-3 border border-line rounded-xl bg-page text-sm outline-none focus:border-accent"    
                    />

                    <div className="flex gap-2 ml-auto">
                        <RoleSelect roles={ROLES} value={role} onChange={setRole} />

                        <button type="submit" disabled={loading} className="auth-primaryButton w-fit!">
                             {loading ? <SmallLoader text="Sending invite..." size={16} /> : "Invite"}
                        </button>
                    </div>
                </form>
            </div>
        </dialog>
    )
}

export default MemberModal;