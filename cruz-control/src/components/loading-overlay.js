import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Quantum } from "ldrs/react";
import TypingAnimation from "@/components/typing-animation";

import "ldrs/react/Quantum.css";

const WORDS = [
    "Reticulating splines…",
    "Herding pixels…",
    "Feeding the hamsters…",
    "Untangling cables…",
    "Bribing the server…",
    "Polishing buttons…",
    "Warming up the bits…",
    "Convincing the database…",
];

const LoadingText = _ => {
    const [index, setIndex] = useState(0);
    
    useEffect(() => {
        // Pick a random word, but never the same one twice in a row
        const pickWord = _ => setIndex(i => {
            let next = Math.floor(Math.random() * WORDS.length);
            while (next === i) {
                next = Math.floor(Math.random() * WORDS.length);
            }
            return next;
        });

        const first = setTimeout(pickWord, 0);
        const timer = setInterval(pickWord, 1000);
        return () => {
            clearTimeout(first);
            clearInterval(timer);
        };
    }, []);

    return (
        <TypingAnimation key={index} className="m-0 min-h-6!" typeSpeed={25}>
            {WORDS[index]}
        </TypingAnimation>
    )
}

const LoadingOverlay = ({ show }) => {
    const reduceMotion = useReducedMotion();
    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    key="loader"
                    role="status"
                    className="pointer-events-none fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 text-muted"
                    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.4 }}
                    transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                >
                    <Quantum size={120} color="currentColor" speed={1.25} />
                    <LoadingText />
                </motion.div>
            )}
        </AnimatePresence>
    );
}

export default LoadingOverlay;