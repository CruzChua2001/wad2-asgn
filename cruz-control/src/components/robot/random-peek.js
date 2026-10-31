"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";
import EdgeRobot from "./edge-robot";

const EDGES = ["top", "right", "bottom", "left"];
const CURIOUS_COOLDOWN = 10000;

const randomBetween = (min, max) => min + Math.random() * (max - min);

const randomSpot = curious => ({
    edge: EDGES[Math.floor(Math.random() * EDGES.length)],
    offset: randomBetween(15, 85),
    curious,
});

const RandomPeek = _ => {
    const reduceMotion = useReducedMotion();
    const [peek, setPeek] = useState(null);

    // Waits a random time, peeks, then waits again once the robot has slid away
    useEffect(() => {
        if (reduceMotion || peek) return;
        const timer = setTimeout(() => {
            setPeek(randomSpot(false));
        }, randomBetween(5000, 12000));
        return () => clearTimeout(timer);
    }, [reduceMotion, peek]);

    // Hovering a button marked data-curious makes the robot peek with a question mark, at most once every 10 seconds
    useEffect(() => {
        if (reduceMotion) return;
        let lastCurious = 0;

        const handleOver = event => {
            if (!event.target.closest("[data-curious]")) return;
            if (Date.now() - lastCurious < CURIOUS_COOLDOWN) return;
            lastCurious = Date.now();
            setPeek(current => current ? current : randomSpot(true));
        };

        document.addEventListener("mouseover", handleOver);
        return () => document.removeEventListener("mouseover", handleOver);
    }, [reduceMotion]);

    if (!peek) return null;
    return <EdgeRobot edge={peek.edge} offset={peek.offset} curious={peek.curious} onDone={() => setPeek(null)} />;
};

export default RandomPeek;
