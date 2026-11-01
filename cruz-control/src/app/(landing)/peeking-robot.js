"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "motion/react";
import RobotHead from "@/components/robot/robot-head";

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
        <RobotHead headRef={headRef} eyeRef={eyeRef}>
            <g className="robot-alert">
                <path d="M24 14 L46 18 L38 64 L30 63 Z" />
                <circle cx="33" cy="80" r="8" />
            </g>
        </RobotHead>

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
