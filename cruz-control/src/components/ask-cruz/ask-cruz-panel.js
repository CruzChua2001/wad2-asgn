"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { LuSend, LuX } from "react-icons/lu";
import api from "@/lib/api";
import { useAuth } from "@/components/auth/auth-provider";

const GREETING = {
    role: "assistant",
    local: true,
    text: "I'm Cruz. I read your scan results and explain them in plain English, without assuming you've done this before. Ask me about anything, or tap a suggestion below.",
};
const SCAN_STARTERS = ["Explain my score", "What should I fix first?"];
const GENERAL_STARTERS = ["What is a CVE?", "What is a CSP header?"];

const renderMessage = text =>
    text
        .replace(/^#+\s*/gm, "")
        .replace(/^\s*[*-]\s+/gm, "• ")
        .split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
        .map((part, i) => {
            if (part.startsWith("**") && part.endsWith("**")) {
                return <strong key={i}>{part.slice(2, -2)}</strong>;
            }
            if (part.startsWith("`") && part.endsWith("`")) {
                return (
                    <code key={i} className="rounded bg-accent-soft px-1 font-mono text-[0.9em]">
                        {part.slice(1, -1)}
                    </code>
                );
            }
            return part;
        });

export default function AskCruzPanel({ open, onClose }) {
    const { status, openAuth } = useAuth();
    const { id: scanId } = useParams(); // set on /scan/[id]/..., empty on other pages
    const [messages, setMessages] = useState([GREETING]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const inputRef = useRef(null);
    const listRef = useRef(null);

    useEffect(() => {
        if (open) inputRef.current?.focus();
    }, [open]);

    useEffect(() => {
        const list = listRef.current;
        if (list) list.scrollTop = list.scrollHeight;
    }, [messages, loading, open]);

    if (!open) return null;

    const send = async text => {
        const question = text.trim();
        if (!question || loading) return;

        const next = [...messages, { role: "user", text: question }];
        setMessages(next);
        setInput("");
        setError("");
        setLoading(true);

        try {
            const history = next
                .filter(m => !m.local)
                .slice(-10)
                .map(({ role, text }) => ({ role, text }));
            const res = await api.post("/api/chat", { scanId, messages: history });
            setMessages([...next, { role: "assistant", text: res.data.reply }]);
        } catch (e) {
            setError(e.response?.data?.error || "Cruz couldn't answer just now. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const hasAsked = messages.some(m => m.role === "user");
    const starters = scanId ? [...SCAN_STARTERS, ...GENERAL_STARTERS] : GENERAL_STARTERS;

    return (
        <section
            role="dialog"
            aria-label="Ask Cruz"
            onKeyDown={e => {
                if (e.key === "Escape") onClose();
            }}
            className="fixed bottom-24 right-4 z-50 flex h-[min(36rem,calc(100vh-7rem))] w-[min(26rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-xl"
        >
            <header className="flex items-center gap-3 border-b border-line px-4 py-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                    {/* eslint-disable-next-line @next/next/no-img-element -- tiny static icon, next/image adds nothing here */}
                    <img src="/favicon.ico" alt="" className="h-6 w-6" />
                </span>
                <div className="min-w-0 flex-1">
                    <h2 className="font-semibold tracking-wide text-accent">CRUZ</h2>
                    <p className="text-xs text-muted">explains your results in plain English</p>
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close Ask Cruz"
                    className="rounded-full p-1.5 text-muted transition-colors hover:bg-accent-soft hover:text-ink"
                >
                    <LuX className="h-4 w-4" aria-hidden="true" />
                </button>
            </header>

            {status !== "authenticated" ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
                    <p className="text-ink">Log in to chat with Cruz.</p>
                    <button
                        type="button"
                        onClick={() => openAuth("login")}
                        className="rounded-full border border-line px-4 py-1.5 text-sm font-medium text-accent transition-colors hover:bg-accent-soft"
                    >
                        Log in
                    </button>
                </div>
            ) : (
                <>
                    <div ref={listRef} role="log" aria-live="polite" className="flex-1 space-y-3 overflow-y-auto px-4 py-4 text-sm">
                        {messages.map((m, i) => (
                            <div
                                key={i}
                                className={
                                    m.role === "user"
                                        ? "ml-auto w-fit max-w-[85%] whitespace-pre-line rounded-xl bg-accent-soft px-3 py-2 text-ink"
                                        : "max-w-[92%] whitespace-pre-line border-l-4 border-accent bg-page px-3 py-2 text-ink"
                                }
                            >
                                {m.role === "user" ? m.text : renderMessage(m.text)}
                            </div>
                        ))}
                        {loading && <p className="text-muted">Cruz is thinking...</p>}
                        {error && (
                            <p role="alert" className="text-critical">
                                {error}
                            </p>
                        )}
                    </div>

                    {!hasAsked && (
                        <div className="flex flex-wrap gap-2 px-4 pb-3 text-xs">
                            {starters.map(s => (
                                <button
                                    key={s}
                                    type="button"
                                    onClick={() => send(s)}
                                    disabled={loading}
                                    className="rounded-md border border-line px-2.5 py-1.5 text-muted transition-colors hover:bg-accent-soft hover:text-ink disabled:opacity-50"
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    )}

                    <form
                        onSubmit={e => {
                            e.preventDefault();
                            send(input);
                        }}
                        className="flex items-center gap-2 border-t border-line px-3 py-3"
                    >
                        <input
                            ref={inputRef}
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            maxLength={500}
                            aria-label="Ask Cruz a question"
                            placeholder="Ask anything about your results..."
                            className="min-w-0 flex-1 rounded-lg border border-line bg-page px-3 py-2 text-sm text-ink outline-none focus:border-accent"
                        />
                        <button
                            type="submit"
                            disabled={loading || !input.trim()}
                            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-accent transition-colors hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            <LuSend className="h-4 w-4" aria-hidden="true" />
                            Send
                        </button>
                    </form>
                    <p className="px-4 pb-3 text-[11px] text-muted">AI can make mistakes. Double-check before running commands.</p>
                </>
            )}
        </section>
    );
}