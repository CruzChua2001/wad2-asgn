"use client";

import { useEffect, useRef } from "react";
import { useInView, useMotionValue, useReducedMotion, useSpring } from "motion/react";

// Adapted from Magic UI's Number Ticker (https://magicui.design/docs/components/number-ticker).
function formatNumber(number, decimalPlaces) {
  return Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  }).format(Number(number.toFixed(decimalPlaces)));
}

export default function NumberTicker({
  value,
  startValue = 0,
  direction = "up",
  delay = 0,
  decimalPlaces = 0,
  className = "",
  ...props
}) {
  const ref = useRef(null);
  const reduceMotion = useReducedMotion();
  const motionValue = useMotionValue(direction === "down" ? value : startValue);
  const springValue = useSpring(motionValue, { damping: 60, stiffness: 100 });
  const isInView = useInView(ref, { once: true, margin: "0px" });

  const format = (number) => formatNumber(number, decimalPlaces);

  useEffect(() => {
    if (reduceMotion || !isInView) return undefined;
    const timer = setTimeout(() => motionValue.set(direction === "down" ? startValue : value), delay * 1000);
    return () => clearTimeout(timer);
  }, [motionValue, isInView, delay, value, direction, startValue, reduceMotion]);

  useEffect(() => springValue.on("change", (latest) => {
    if (ref.current) ref.current.textContent = formatNumber(latest, decimalPlaces);
  }), [springValue, decimalPlaces]);

  const initial = reduceMotion ? value : direction === "down" ? value : startValue;

  return (
    <span ref={ref} className={`number-ticker ${className}`.trim()} {...props}>
      {format(initial)}
    </span>
  );
}
