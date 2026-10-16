"use client";

import { useEffect, useRef, useState } from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { LuMinus, LuPlus } from "react-icons/lu";

const DOT_FILLS = { healthy: "fill-accent", attention: "fill-warm", critical: "fill-critical" };
const STROKES = { healthy: "stroke-accent", attention: "stroke-warm", critical: "stroke-critical" };
const STATUS_LABELS = { healthy: "Healthy", attention: "Needs attention", critical: "Critical" };
const MAX_ZOOM = 8;

// ip-api says "The Netherlands", Natural Earth says "Netherlands"
function countryName(node) {
  return node.country.replace(/^The /, "");
}

// Keep the zoomed map covering the stage
function clampView(view, size) {
  const maxX = (size.width * (view.k - 1)) / 2;
  const maxY = (size.height * (view.k - 1)) / 2;
  return { k: view.k, x: Math.max(-maxX, Math.min(maxX, view.x)), y: Math.max(-maxY, Math.min(maxY, view.y)) };
}

// Zoom by factor, keeping the point at (mx, my) in the same place
function zoomAround(view, factor, mx, my, size) {
  const k = Math.min(MAX_ZOOM, Math.max(1, view.k * factor));
  const ratio = k / view.k;
  const cx = size.width / 2;
  const cy = size.height / 2;
  return clampView({ k, x: mx - cx - (mx - cx - view.x) * ratio, y: my - cy - (my - cy - view.y) * ratio }, size);
}

// Flat world map with the same props as ExposureGlobe, so the map card can swap between them
export default function ServerMap({ nodes, arcs, selectedId, highlightIds = [], onSelect, reduceMotion = false }) {
  const containerRef = useRef(null);
  const dragDistance = useRef(0);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [countries, setCountries] = useState([]);
  const [tip, setTip] = useState(null);
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return undefined;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width: Math.round(width), height: Math.round(height) });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  // Same file as the globe, so the browser already has it cached
  useEffect(() => {
    const controller = new AbortController();
    fetch("/globe/countries.geojson", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : { features: [] }))
      .then((data) => setCountries(data.features || []))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  // React's onWheel can't stop the page scrolling, so listen on the element directly
  useEffect(() => {
    const element = containerRef.current;
    if (!element) return undefined;
    function handleWheel(event) {
      // Fully zoomed out and scrolling down: let the page scroll instead
      if (view.k === 1 && event.deltaY > 0) return;
      event.preventDefault();
      const box = element.getBoundingClientRect();
      setView(zoomAround(view, Math.exp(-event.deltaY / 500), event.clientX - box.left, event.clientY - box.top, size));
    }
    element.addEventListener("wheel", handleWheel, { passive: false });
    return () => element.removeEventListener("wheel", handleWheel);
  }, [view, size]);

  const located = nodes.filter((node) => node.located);
  const serverCountries = new Set(located.map(countryName));

  // Nothing is hosted in Antarctica, so leaving it out makes the rest of the map bigger
  const land = countries.filter((feature) => feature.properties.ADMIN !== "Antarctica");
  const fitTo = land.length > 0 ? { type: "FeatureCollection", features: land } : { type: "Sphere" };
  // Leave room for the view toggle at the top and the hint at the bottom
  const projection = geoNaturalEarth1().fitExtent([[12, 44], [size.width - 12, size.height - 28]], fitTo);

  // Zoom around the middle of the stage, then move by the drag offset
  const [tx, ty] = projection.translate();
  const cx = size.width / 2;
  const cy = size.height / 2;
  projection.scale(projection.scale() * view.k).translate([cx + (tx - cx) * view.k + view.x, cy + (ty - cy) * view.k + view.y]);
  const path = geoPath(projection);

  // The buttons zoom around the middle of the stage
  function zoom(factor) {
    setView(zoomAround(view, factor, cx, cy, size));
  }

  function handlePointerMove(event) {
    if (event.buttons !== 1 || view.k === 1) return;
    dragDistance.current += Math.abs(event.movementX) + Math.abs(event.movementY);
    setView((current) => clampView({ ...current, x: current.x + event.movementX, y: current.y + event.movementY }, size));
  }

  // A drag that ends on a dot shouldn't select it
  function selectDot(node) {
    if (dragDistance.current < 4) {
      onSelect?.(node.id);
    }
  }

  function rank(node) {
    if (node.id === selectedId) return 2;
    return highlightIds.includes(node.id) ? 1 : 0;
  }

  // Selected and highlighted servers are drawn last so they sit on top
  const dots = [...located].sort((a, b) => rank(a) - rank(b));

  function showTip(event, node) {
    const box = containerRef.current.getBoundingClientRect();
    setTip({ node, x: event.clientX - box.left, y: event.clientY - box.top });
  }

  // Flip the tooltip past the middle so the card doesn't cut it off
  let tipStyle = null;
  if (tip) {
    tipStyle = tip.x > size.width / 2 ? { top: tip.y + 12, right: size.width - tip.x + 12 } : { top: tip.y + 12, left: tip.x + 12 };
  }

  return (
    <div className="absolute inset-0">
      <div
        ref={containerRef}
        className={`absolute inset-0 ${view.k > 1 ? "cursor-grab touch-none active:cursor-grabbing" : ""}`}
        aria-hidden="true"
        onPointerDown={() => {
          dragDistance.current = 0;
        }}
        onPointerMove={handlePointerMove}
      >
        {size.width > 0 && (
          <svg width={size.width} height={size.height} className="block">
            {land.map((feature) => {
              const { ADMIN, NAME_LONG, ADM0_A3 } = feature.properties;
              const hasServer = serverCountries.has(ADMIN) || serverCountries.has(NAME_LONG);
              return (
                <path
                  key={ADM0_A3}
                  d={path(feature)}
                  className={`stroke-surface-strong stroke-[0.5] ${hasServer ? "fill-accent-soft" : "fill-line"}`}
                />
              );
            })}
            {arcs.filter((arc) => arc.from.located && arc.to.located).map((arc) => (
              <path
                key={arc.id}
                d={path({ type: "LineString", coordinates: [[arc.from.lng, arc.from.lat], [arc.to.lng, arc.to.lat]] })}
                strokeDasharray="4 3"
                className={`fill-none stroke-1 opacity-60 ${STROKES[arc.status]}`}
              />
            ))}
            {dots.map((node) => {
              const [x, y] = projection([node.lng, node.lat]);
              const marked = rank(node) > 0;
              // Critical servers always pulse so they stand out, like on the globe
              const pulsing = !reduceMotion && (marked || node.status === "critical");
              return (
                <g
                  key={node.id}
                  className="cursor-pointer"
                  onClick={() => selectDot(node)}
                  onPointerEnter={(event) => showTip(event, node)}
                  onPointerLeave={() => setTip(null)}
                >
                  {pulsing && (
                    <circle cx={x} cy={y} r={5} className={`fill-none stroke-2 ${STROKES[node.status]}`}>
                      <animate attributeName="r" from="5" to="16" dur="1.1s" repeatCount="indefinite" />
                      <animate attributeName="opacity" from="0.9" to="0" dur="1.1s" repeatCount="indefinite" />
                    </circle>
                  )}
                  {marked && <circle cx={x} cy={y} r={9} className={`fill-none stroke-2 ${STROKES[node.status]}`} />}
                  <circle cx={x} cy={y} r={marked ? 5 : 4} className={`stroke-surface-strong stroke-1 ${DOT_FILLS[node.status]}`} />
                </g>
              );
            })}
          </svg>
        )}
        {tip && (
          <div className="globe-tooltip pointer-events-none absolute z-[2]" style={tipStyle}>
            <strong>
              {tip.node.host}
              {tip.node.isCdn && <span className="ml-1 rounded-sm border border-line px-1 text-[9px] font-medium text-muted">CDN</span>}
            </strong>
            <span>{tip.node.city}, {tip.node.country} · {STATUS_LABELS[tip.node.status]}</span>
          </div>
        )}
      </div>
      <div className="globe-zoom" role="group" aria-label="Map zoom">
        <button type="button" onClick={() => zoom(1.5)} aria-label="Zoom in" title="Zoom in">
          <LuPlus aria-hidden="true" />
        </button>
        <button type="button" onClick={() => zoom(1 / 1.5)} aria-label="Zoom out" title="Zoom out">
          <LuMinus aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
