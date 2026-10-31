"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";

const EYE = "M106 146 L142 156 Q144 186 124 188 Q104 188 104 164 Z";
const IDLE_AFTER = 1500;

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const onDuty = head => {
    const wide = window.matchMedia?.("(min-width: 1200px)").matches;
    const peek = head?.getAnimations?.().find(animation => animation.animationName === "robot-peek");
    if (!wide || !peek) return "top";

    const progress = peek.effect.getComputedTiming().progress;
    return progress >= 0.57 && progress < 0.95 ? "left" : "top";
};

const Robot = ({ side, mode, headRef, eyeRef }) => (
    <div className={`robot robot-${side} ${mode}`} aria-hidden="true">
        <svg ref={headRef} className="robot-head" viewBox="0 0 300 260">
            <path className="robot-band" d="M70 118 C40 100 18 112 8 120 C30 126 44 136 52 150 C40 160 34 178 38 196 C56 180 70 162 78 140 Z" />
            <rect className="robot-ear" x="40" y="140" width="34" height="62" rx="16" />
            <rect className="robot-ear" x="226" y="140" width="34" height="62" rx="16" />
            <path className="robot-shell" d="M96 214 L82 254 L132 222 Z" />
            <rect className="robot-shell" x="58" y="86" width="186" height="146" rx="62" />
            <path className="robot-shade" d="M70 196 Q150 236 232 196" />
            <rect className="robot-visor" x="82" y="116" width="138" height="92" rx="40" />

            <g className="robot-antenna">
                <line className="robot-stick" x1="228" y1="92" x2="250" y2="44" />
                <circle className="robot-ball" cx="253" cy="36" r="14" />
                <circle className="robot-shine" cx="249" cy="32" r="4" />
            </g>

            <path className="robot-band" d="M66 128 C70 78 112 50 160 52 C206 54 236 80 240 112 C204 96 160 92 122 98 C100 102 82 112 66 128 Z" />
            <path className="robot-crease" d="M96 92 C130 78 180 76 220 92" />
            <circle className="robot-band" cx="70" cy="126" r="13" />

            <path ref={eyeRef} className="robot-eye" d={EYE} />

            <g className="robot-patch">
                <path className="robot-strap" d="M112 104 L200 156" />
                <ellipse cx="184" cy="164" rx="28" ry="26" />
                <circle className="robot-skull" cx="184" cy="158" r="8" />
                <rect className="robot-skull" x="179" y="163" width="10" height="6" rx="2" />
                <path className="robot-bones" d="M170 174 L198 184 M198 174 L170 184" />
            </g>

            <g className="robot-alert">
                <path d="M24 14 L46 18 L38 64 L30 63 Z" />
                <circle cx="33" cy="80" r="8" />
            </g>
        </svg>

        {side === "top" && <div className="robot-mitts"><span /><span /></div>}
        {side === "left" && <div className="robot-mitts"><span /></div>}
    </div>
);

const PeekingRobots = _ => {
    const reduceMotion = useReducedMotion();
    const topHeadRef = useRef(null);
    const topEyeRef = useRef(null);
    const leftEyeRef = useRef(null);
    const [spottedBy, setSpottedBy] = useState(null);
    const [following, setFollowing] = useState(false);
    const [duty, setDuty] = useState(null);

    useEffect(() => {
        if (reduceMotion) return;
        let active = null;
        let idleTimer;

        const handleMove = event => {
            if (!active) {
                active = onDuty(topHeadRef.current);
                setDuty(active);
                setFollowing(true);
                setSpottedBy(current => current ? current : active);
            }

            const eye = active === "left" ? leftEyeRef.current : topEyeRef.current;
            const box = eye.getBoundingClientRect();
            const x = clamp((event.clientX - (box.left + box.width / 2)) / 20, -20, 14);
            const y = clamp((event.clientY - (box.top + box.height / 2)) / 20, -8, 8);
            eye.style.transform = `translate(${x}px, ${y}px)`;

            clearTimeout(idleTimer);
            idleTimer = setTimeout(() => {
                eye.style.transform = "";
                active = null;
                setFollowing(false);
            }, IDLE_AFTER);
        };

        window.addEventListener("mousemove", handleMove);
        return () => {
            window.removeEventListener("mousemove", handleMove);
            clearTimeout(idleTimer);
        };
    }, [reduceMotion]);

    const modeFor = side => {
        let mode = spottedBy === side ? "robot-spotted" : "";
        if (following) {
            mode += duty === side ? " robot-following" : " robot-waiting";
        } else if (duty) {
            mode += ` robot-resumed-${duty}`;
        }
        return mode;
    };

    return (
        <>
            <Robot side="top" mode={modeFor("top")} headRef={topHeadRef} eyeRef={topEyeRef} />
            <Robot side="left" mode={modeFor("left")} eyeRef={leftEyeRef} />
        </>
    );
};

export default PeekingRobots;
