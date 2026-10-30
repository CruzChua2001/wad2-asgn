"use client";

import { motion, useReducedMotion } from "motion/react";

const elements = { div: motion.div, section: motion.section, li: motion.li };

// Match Overview / Report Card easing, with a smaller movement and short stagger.
// Keep the same element mounted when selections change: initial runs only on entry.
export default function ScanEntrance({ as = "div", enabled = true, delay = 0, children, ...props }) {
    const reducedMotion = useReducedMotion();
    const Element = elements[as];
    return (
        <Element
            {...props}
            initial={enabled && !reducedMotion ? { opacity: 0, y: 10 } : false}
            animate={{ opacity: 1, y: 0 }}
            transition={reducedMotion || !enabled ? { duration: 0 } : { duration: 0.45, delay: Math.min(delay, 0.24), ease: [0.22, 1, 0.36, 1] }}
        >
            {children}
        </Element>
    );
}
