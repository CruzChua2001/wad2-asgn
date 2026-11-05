"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";
import EdgeRobot from "./edge-robot";

const EDGES = ["top", "right", "bottom", "left"];
const IDLE_TIME = 8000;
const ACTIVITY_EVENTS = ["mousemove", "scroll", "wheel", "keydown", "touchstart", "mousedown"];

const randomBetween = (min, max) => min + Math.random() * (max - min);

const randomSpot = curious => ({
    edge: EDGES[Math.floor(Math.random() * EDGES.length)],
    offset: randomBetween(15, 85),
    curious,
});

const RandomPeek = _ => {
    const reduceMotion = useReducedMotion();
    const [peek, setPeek] = useState(null);
    const [idle, setIdle] = useState(false);

    // The user counts as idle after a while with no mouse, scroll or keys
    useEffect(() => {
        if (reduceMotion) return;
        let timer;

        const startTimer = _ => {
            timer = setTimeout(() => setIdle(true), IDLE_TIME);
        };

        const handleActivity = _ => {
            setIdle(false);
            // If the robot is out, it gets a fright and hides
            setPeek(current => {
                if (!current || current.startled) return current;
                return { ...current, startled: true };
            });
            clearTimeout(timer);
            startTimer();
        };

        ACTIVITY_EVENTS.forEach(name => window.addEventListener(name, handleActivity));
        startTimer();

        return () => {
            clearTimeout(timer);
            ACTIVITY_EVENTS.forEach(name => window.removeEventListener(name, handleActivity));
        };
    }, [reduceMotion]);

    // While idle, peeks at random times, waiting again once the robot has slid away
    useEffect(() => {
        if (!idle || peek) return;
        const timer = setTimeout(() => {
            setPeek(randomSpot(false));
        }, randomBetween(2000, 8000));
        return () => clearTimeout(timer);
    }, [idle, peek]);

    if (!peek) return null;
    return <EdgeRobot edge={peek.edge} offset={peek.offset} curious={peek.curious} startled={peek.startled} onDone={() => setPeek(null)} />;
};

export default RandomPeek;
