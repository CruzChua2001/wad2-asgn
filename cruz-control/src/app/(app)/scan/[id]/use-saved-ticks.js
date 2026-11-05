"use client";

import { useRef, useState } from "react";
import api from "@/lib/api";
import { useAuth } from "@/components/auth/auth-provider";
import { useScan } from "../scan-context";

const SAVE_DELAY = 600;

// Ticks for one tab ("fixed" for the Fix guide, "checklist" for the Checklist), starting from what was saved.
// Signed-in users save to their account after a short pause; guests keep them on the page only.
// Mount this once the result has loaded: the saved ticks are only read on the first render.
export const useSavedTicks = (scanId, field, saved) => {
    const { status } = useAuth();
    const { rememberTicks } = useScan();
    const [ticks, setTicks] = useState(saved ?? {});
    const [saveFailed, setSaveFailed] = useState(false);
    const timer = useRef(null);

    const save = next => {
        if (status !== "authenticated") return;

        clearTimeout(timer.current);
        timer.current = setTimeout(async () => {
            try {
                await api.put(`/api/scan/${scanId}/progress`, { [field]: next });
                setSaveFailed(false);
            } catch {
                setSaveFailed(true);
            }
        }, SAVE_DELAY);
    };

    // change is the new ticks object, or a function from the old ticks to the new ones
    const update = change => {
        const next = typeof change === "function" ? change(ticks) : change;

        setTicks(next);
        rememberTicks(field, next);
        save(next);
    };

    return [ticks, update, saveFailed];
};
