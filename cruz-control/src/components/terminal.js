"use client";

import { Children, cloneElement, createContext, isValidElement, useContext, useRef } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";

const TerminalSequenceContext = createContext({ active: true, reduceMotion: false });

export function Terminal({
  children,
  className = "",
  theme = "light",
  sequence = true,
  startOnView = true,
  title = "CRUZ CONTROL",
  status = "DEMO",
  label = "Illustrative Cruz Control scan output",
  live = false,
  bodyRef,
  bodyClassName = "",
}) {
  const terminalRef = useRef(null);
  const isInView = useInView(terminalRef, { once: true, amount: 0.2 });
  const reduceMotion = useReducedMotion();
  const active = !startOnView || isInView;
  const sequencedChildren = Children.map(children, (child, index) => {
    if (!isValidElement(child)) return child;
    const sequenceDelay = sequence ? (index === 0 ? 0 : 650 + (index - 1) * 500) : (child.props.delay || 0);
    return cloneElement(child, { sequenceDelay });
  });

  return (
    <TerminalSequenceContext.Provider value={{ active, reduceMotion }}>
      <section
        ref={terminalRef}
        className={`magic-terminal ${className}`.trim()}
        data-theme={theme}
        aria-label={label}
      >
        <div className="terminal-titlebar" aria-hidden="true">
          <span className="terminal-window-dots"><i /><i /><i /></span>
          <span className="terminal-window-title">{title}</span>
          <span className="terminal-window-status">{status}</span>
        </div>
        <div
          ref={bodyRef}
          className={`terminal-body ${bodyClassName}`.trim()}
          {...(live ? { role: "log", "aria-live": "polite", "aria-relevant": "additions" } : {})}
        >
          {sequencedChildren}
        </div>
      </section>
    </TerminalSequenceContext.Provider>
  );
}

export function TypingAnimation({ children, className = "", duration = 20, sequenceDelay = 0 }) {
  const { active, reduceMotion } = useContext(TerminalSequenceContext);
  const width = `${children.length}ch`;

  return (
    <p className={`terminal-typing-row ${className}`.trim()} aria-label={children}>
      <motion.span
        className="terminal-typed-text"
        initial={reduceMotion ? false : { width: 0 }}
        animate={{ width: active || reduceMotion ? width : 0 }}
        transition={{
          duration: reduceMotion ? 0 : (children.length * duration) / 1000,
          delay: reduceMotion ? 0 : sequenceDelay / 1000,
          ease: "linear",
        }}
        aria-hidden="true"
      >
        {children}
      </motion.span>
    </p>
  );
}

export function AnimatedSpan({ children, className = "", sequenceDelay = 0 }) {
  const { active, reduceMotion } = useContext(TerminalSequenceContext);

  return (
    <motion.div
      className={`terminal-output-row ${className}`.trim()}
      initial={reduceMotion ? false : { opacity: 0, y: 7 }}
      animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 7 }}
      transition={{ duration: reduceMotion ? 0 : 0.28, delay: reduceMotion ? 0 : sequenceDelay / 1000 }}
    >
      {children}
    </motion.div>
  );
}
