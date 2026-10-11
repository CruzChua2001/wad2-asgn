"use client";

import { motion, useReducedMotion } from "motion/react";

const blurInUpVariants = {
  hidden: { opacity: 0, filter: "blur(8px)", y: 18 },
  show: {
    opacity: 1,
    filter: "blur(0px)",
    y: 0,
    transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] },
  },
};
const slideUpVariants = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] } },
};
const animationVariants = {
  blurInUp: blurInUpVariants,
  slideUp: slideUpVariants,
};

export default function TextAnimate({
  children,
  className = "",
  segmentClassName = "",
  by = "word",
  startOnView = false,
  once = true,
  delay = 0,
  as = "span",
  animation = "blurInUp",
}) {
  const reduceMotion = useReducedMotion();
  const MotionElement = as === "div" ? motion.div : motion.span;
  const segments = by === "character" ? Array.from(children) : children.split(/(\s+)/);
  const variants = animationVariants[animation] || blurInUpVariants;
  const containerVariants = {
    hidden: { opacity: 1 },
    show: { opacity: 1, transition: { delayChildren: delay, staggerChildren: 0.065 } },
  };

  return (
    <MotionElement
      className={`text-animate ${className}`.trim()}
      variants={containerVariants}
      initial={reduceMotion ? false : "hidden"}
      animate={startOnView ? undefined : "show"}
      whileInView={startOnView ? "show" : undefined}
      viewport={{ once }}
      aria-label={children}
    >
      <span className="sr-only">{children}</span>
      {segments.map((segment, index) => (
        <motion.span
          key={`${index}-${segment}`}
          className={`text-animate-segment ${segmentClassName}`.trim()}
          variants={reduceMotion ? { hidden: { opacity: 1 }, show: { opacity: 1 } } : variants}
          aria-hidden="true"
        >
          {segment}
        </motion.span>
      ))}
    </MotionElement>
  );
}
