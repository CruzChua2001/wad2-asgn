"use client";

import { useRef, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/components/auth/auth-provider";
import { useScan } from "../scan-context";

const SAVE_DELAY = 600;
const RETRY_DELAY = 1000;

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// Worth trying again: no answer at all, a server error, or a login token that was missing for a moment.
// A 400, 403 or 404 would fail the same way again.
const canRetry = error => !error.response || error.response.status >= 500 || error.response.status === 401;

const localKey = (scanId, field) => `cruz-control-ticks-v1:${scanId}:${field}`;

// Guests' ticks, kept in this browser. Storage can be blocked or full, so a failure just means nothing is kept
const readLocal = key => {
    try {
        const value = JSON.parse(localStorage.getItem(key));
        return value && typeof value === "object" && !Array.isArray(value) ? value : null;
    } catch {
        return null;
    }
};

const writeLocal = (key, ticks) => {
    try {
        localStorage.setItem(key, JSON.stringify(ticks));
    } catch { /* storage blocked or full */ }
};

// Ticks for one tab ("fixed" for the Fix guide, "checklist" for the Checklist), starting from what was saved.
// Signed-in users save to their account after a short pause; guests keep them in this browser (localStorage).
// Mount this once the result has loaded: the saved ticks are only read on the first render.
export const useSavedTicks = (scanId, field, saved) => {
    const { status } = useAuth();
    const { rememberTicks } = useScan();
    const isSignedIn = status === "authenticated";
    const [ticks, setTicks] = useState(() => (isSignedIn ? null : readLocal(localKey(scanId, field))) ?? saved ?? {});
    const [saveFailed, setSaveFailed] = useState(false);
    const timer = useRef(null);
    const sending = useRef(false);
    const waiting = useRef(null); // the newest ticks that have not been sent yet

    // One request at a time, always the newest ticks. Two requests at once can finish out of order,
    // and an older failure would then show an error even though the newer save worked
    const send = async () => {
        if (sending.current || waiting.current === null) return;

        sending.current = true;
        const next = waiting.current;
        waiting.current = null;

        try {
            for (let attempt = 1; ; attempt++) {
                try {
                    await api.put(`/api/scan/${scanId}/progress`, { [field]: next });
                    break;
                } catch (error) {
                    if (attempt === 2 || !canRetry(error)) throw error;
                    await wait(RETRY_DELAY);
                }
            }
            setSaveFailed(false);
        } catch (error) {
            console.error("Couldn't save ticks:", error.response?.status, error.response?.data ?? error.message);
            setSaveFailed(true);
        } finally {
            sending.current = false;
            send(); // ticks that arrived while this one was sending
        }
    };

    const save = next => {
        clearTimeout(timer.current);
        timer.current = setTimeout(() => {
            waiting.current = next;
            send();
        }, SAVE_DELAY);
    };

    // change is the new ticks object, or a function from the old ticks to the new ones
    const update = change => {
        const next = typeof change === "function" ? change(ticks) : change;

        setTicks(next);
        rememberTicks(field, next);

        if (isSignedIn) {
            save(next);
        } else {
            writeLocal(localKey(scanId, field), next);
        }
    };

    return [ticks, update, saveFailed];
};
