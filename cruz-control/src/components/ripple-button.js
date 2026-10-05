"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

let nextRippleId = 0;

export default function RippleButton({
  href,
  className = "",
  children,
  onClick,
  type = "button",
  ...props
}) {
  const [ripples, setRipples] = useState([]);
  const timersRef = useRef(new Set());
  const Element = href ? Link : "button";

  useEffect(() => () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
  }, []);

  function createRipple(button, clientX, clientY) {
    const bounds = button.getBoundingClientRect();
    const size = Math.max(bounds.width, bounds.height) * 2.2;
    const ripple = {
      id: nextRippleId++,
      x: clientX - bounds.left,
      y: clientY - bounds.top,
      size,
    };

    setRipples((current) => [...current, ripple]);
    const timer = window.setTimeout(() => {
      setRipples((current) => current.filter((item) => item.id !== ripple.id));
      timersRef.current.delete(timer);
    }, 720);
    timersRef.current.add(timer);
  }

  function handlePointerDown(event) {
    createRipple(event.currentTarget, event.clientX, event.clientY);
  }

  function handleClick(event) {
    if (event.detail === 0) {
      const bounds = event.currentTarget.getBoundingClientRect();
      createRipple(event.currentTarget, bounds.left + bounds.width / 2, bounds.top + bounds.height / 2);
    }
    onClick?.(event);
  }

  return (
    <Element
      {...props}
      href={href}
      type={href ? undefined : type}
      className={`ripple-button ${className}`.trim()}
      onPointerDown={handlePointerDown}
      onClick={handleClick}
    >
      <span className="ripple-content">{children}</span>
      <span className="ripple-layer" aria-hidden="true">
        {ripples.map((ripple) => (
          <span
            className="ripple-wave"
            key={ripple.id}
            style={{
              left: ripple.x,
              top: ripple.y,
              width: ripple.size,
              height: ripple.size,
            }}
          />
        ))}
      </span>
    </Element>
  );
}
