"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";

export default function TypingAnimation({ children, className = "", typeSpeed = 10 }) {
  const [visibleCharacters, setVisibleCharacters] = useState(0);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion || typeof children !== "string" || children.length === 0) return undefined;

    let characterIndex = 0;
    let timeoutId;

    function revealNextCharacter() {
      characterIndex += 1;
      setVisibleCharacters(characterIndex);

      if (characterIndex < children.length) {
        timeoutId = window.setTimeout(revealNextCharacter, typeSpeed);
      }
    }

    timeoutId = window.setTimeout(revealNextCharacter, typeSpeed);
    return () => window.clearTimeout(timeoutId);
  }, [children, prefersReducedMotion, typeSpeed]);

  const displayedText = prefersReducedMotion ? children : children.slice(0, visibleCharacters);

  return (
    <p className={`typing-animation ${className}`.trim()}>
      <span className="sr-only">{children}</span>
      <span aria-hidden="true">
        {displayedText}
        {!prefersReducedMotion && <span className="typing-cursor" />}
      </span>
    </p>
  );
}
