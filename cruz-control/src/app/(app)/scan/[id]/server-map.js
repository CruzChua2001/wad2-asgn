"use client";

import { useEffect, useRef, useState } from "react";
import { geoGraticule10, geoNaturalEarth1, geoPath } from "d3-geo";
import { LuMinus, LuPlus } from "react-icons/lu";

const DOT_FILLS = { healthy: "fill-accent", attention: "fill-warm", critical: "fill-critical" };
const STROKES = { healthy: "stroke-accent", attention: "stroke-warm", critical: "stroke-critical" };
const COLORS = { healthy: "var(--accent)", attention: "var(--warm)", critical: "var(--critical)" };
const STATUS_LABELS = { healthy: "Healthy", attention: "Needs attention", critical: "Critical" };
const STATUS_RANK = { healthy: 0, attention: 1, critical: 2 };
// Countries are tinted by their worst server, mixed with the land colour so the dots still stand out
const COUNTRY_FILLS = {
  healthy: "fill-accent-soft",
  attention: "fill-[color-mix(in_srgb,var(--warm)_45%,var(--line))]",
  critical: "fill-[color-mix(in_srgb,var(--critical)_45%,var(--line))]",
};
const MAX_ZOOM = 8;
const graticule = geoGraticule10();

// ip-api says "The Netherlands", Natural Earth says "Netherlands"
function countryName(node) {
  return node.country.replace(/^The /, "");
}

// "2 servers · 1 critical" for the country tooltip
export function countrySummary(stats) {
  const parts = [`${stats.servers} ${stats.servers === 1 ? "server" : "servers"}`];
  if (stats.critical > 0) parts.push(`${stats.critical} critical`);
  if (stats.attention > 0) parts.push(`${stats.attention} ${stats.attention === 1 ? "needs" : "need"} attention`);
  if (parts.length === 1) parts.push(stats.servers === 1 ? "healthy" : "all healthy");
  return parts.join(" · ");
}

// Bend the line between two points into a curve that bows towards the top of the map
function curve([x1, y1], [x2, y2]) {
  let liftX = -(y2 - y1) * 0.22;
  let liftY = (x2 - x1) * 0.22;
  if (liftY > 0) {
    liftX = -liftX;
    liftY = -liftY;
  }
  const qx = (x1 + x2) / 2 + liftX;
  const qy = (y1 + y2) / 2 + liftY;
  return `M${x1},${y1} Q${qx},${qy} ${x2},${y2}`;
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
export default function ServerMap({ nodes, arcs, selectedId, highlightIds = [], dimIds = [], onSelect, reduceMotion = false }) {
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
      // Only zoom with Ctrl held (a trackpad pinch sends it too), so a plain scroll still scrolls the page
      if (!event.ctrlKey) return;
      event.preventDefault();
      const box = element.getBoundingClientRect();
      setView((current) => zoomAround(current, Math.exp(-event.deltaY / 500), event.clientX - box.left, event.clientY - box.top, size));
    }
    element.addEventListener("wheel", handleWheel, { passive: false });
    return () => element.removeEventListener("wheel", handleWheel);
  }, [size]);

  const located = nodes.filter((node) => node.located);

  // Count each country's servers and keep its worst status for the tint
  const byCountry = {};
  for (const node of located) {
    const name = countryName(node);
    const stats = byCountry[name] || { name, servers: 0, attention: 0, critical: 0, worst: "healthy" };
    stats.servers += 1;
    if (node.status === "critical") stats.critical += 1;
    if (node.status === "attention") stats.attention += 1;
    if (STATUS_RANK[node.status] > STATUS_RANK[stats.worst]) stats.worst = node.status;
    byCountry[name] = stats;
  }

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

  // Servers hidden by the status filter are faded, but never the selected one
  function isDimmed(id) {
    return id !== selectedId && dimIds.includes(id);
  }

  function rank(node) {
    if (node.id === selectedId) return 2;
    if (highlightIds.includes(node.id)) return 1;
    return isDimmed(node.id) ? -1 : 0;
  }

  // Selected and highlighted servers are drawn last so they sit on top, faded ones first
  const dots = [...located].sort((a, b) => rank(a) - rank(b));

  // Curved routes from the main site, worked out again on every zoom so they follow the dots
  const routes = [];
  arcs.forEach((arc, index) => {
    if (!arc.from.located || !arc.to.located) return;
    const start = projection([arc.from.lng, arc.from.lat]);
    const end = projection([arc.to.lng, arc.to.lat]);
    // A server in the same city as the main site has no line to draw
    if (Math.hypot(end[0] - start[0], end[1] - start[1]) < 2) return;
    routes.push({ arc, index, start, end, d: curve(start, end) });
  });
  const focusing = highlightIds.length > 0;

  function showTip(event, node) {
    const box = containerRef.current.getBoundingClientRect();
    setTip({ node, x: event.clientX - box.left, y: event.clientY - box.top });
  }

  function showCountryTip(event, stats) {
    // No tooltip while dragging the map around
    if (event.buttons) return;
    const box = containerRef.current.getBoundingClientRect();
    setTip({ country: stats, x: event.clientX - box.left, y: event.clientY - box.top });
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
            <defs>
              {/* Soft glow for the packets and the dots that matter */}
              <filter id="map-glow" filterUnits="userSpaceOnUse" x="0" y="0" width={size.width} height={size.height}>
                <feGaussianBlur stdDeviation="2.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              <radialGradient id="map-ocean">
                <stop offset="0" style={{ stopColor: "var(--accent)", stopOpacity: 0.09 }} />
                <stop offset="1" style={{ stopColor: "var(--accent)", stopOpacity: 0.02 }} />
              </radialGradient>
              {/* Each route fades from green at the main site to its server's status colour */}
              {routes.map(({ arc, index, start, end }) => (
                <linearGradient
                  key={arc.id}
                  id={`map-route-${index}`}
                  gradientUnits="userSpaceOnUse"
                  x1={start[0]}
                  y1={start[1]}
                  x2={end[0]}
                  y2={end[1]}
                >
                  <stop offset="0" style={{ stopColor: COLORS.healthy }} />
                  <stop offset="1" style={{ stopColor: COLORS[arc.status] }} />
                </linearGradient>
              ))}
            </defs>
            <path d={path({ type: "Sphere" })} fill="url(#map-ocean)" />
            <path d={path(graticule)} className="fill-none stroke-muted stroke-[0.5] opacity-15" />
            {land.map((feature) => {
              const { ADMIN, NAME_LONG, ADM0_A3 } = feature.properties;
              const stats = byCountry[ADMIN] || byCountry[NAME_LONG];
              if (!stats) {
                return <path key={ADM0_A3} d={path(feature)} className="fill-line stroke-surface-strong stroke-[0.5]" />;
              }
              return (
                <path
                  key={ADM0_A3}
                  d={path(feature)}
                  className={`stroke-surface-strong stroke-[0.5] ${COUNTRY_FILLS[stats.worst]}`}
                  onPointerEnter={(event) => showCountryTip(event, stats)}
                  onPointerMove={(event) => showCountryTip(event, stats)}
                  onPointerLeave={() => setTip(null)}
                />
              );
            })}
            <g className="pointer-events-none">
              {routes.map(({ arc, index, d }) => {
                const active = arc.to.id === selectedId || highlightIds.includes(arc.to.id);
                let strength = 0.85;
                if (isDimmed(arc.to.id)) strength = 0.2;
                else if (active) strength = 1;
                else if (focusing) strength = 0.35;
                const width = active ? 2.5 : 1.5;
                // Each route draws itself in a little after the one before
                const delay = index * 0.12;
                // Packets start once the line is drawn, slightly out of step so they don't move together
                const travel = `${2.6 + (index % 3) * 0.4}s`;
                const leave = `${delay + 0.9 + (index % 5) * 0.35}s`;
                return (
                  <g key={arc.id}>
                    <path
                      d={d}
                      fill="none"
                      stroke={`url(#map-route-${index})`}
                      strokeWidth={width}
                      strokeLinecap="round"
                      strokeOpacity={reduceMotion ? strength : strength * 0.55}
                      pathLength={reduceMotion ? undefined : 1}
                      strokeDasharray={reduceMotion ? undefined : "1"}
                      style={reduceMotion ? undefined : { animation: `map-route-draw 0.9s ease-out ${delay}s both` }}
                    />
                    {!reduceMotion && (
                      <>
                        {/* Dashes flowing out from the main site once the line is drawn */}
                        <path
                          id={`map-arc-${index}`}
                          d={d}
                          fill="none"
                          stroke={`url(#map-route-${index})`}
                          strokeWidth={width}
                          strokeLinecap="round"
                          strokeOpacity={strength}
                          strokeDasharray="4 10"
                          filter={active ? "url(#map-glow)" : undefined}
                          style={{ animation: `map-route-show 0.5s ease-out ${delay + 0.8}s both, map-route-flow 1.6s linear infinite` }}
                        />
                        <g opacity={strength}>
                          <circle r={active ? 3 : 2.5} opacity="0" filter="url(#map-glow)" className={DOT_FILLS[arc.status]}>
                            <animateMotion dur={travel} begin={leave} repeatCount="indefinite">
                              <mpath href={`#map-arc-${index}`} />
                            </animateMotion>
                            <animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.1;0.85;1" dur={travel} begin={leave} repeatCount="indefinite" />
                          </circle>
                        </g>
                      </>
                    )}
                  </g>
                );
              })}
            </g>
            {dots.map((node) => {
              const [x, y] = projection([node.lng, node.lat]);
              const marked = rank(node) > 0;
              const dimmed = isDimmed(node.id);
              // Critical servers always pulse so they stand out, like on the globe
              const pulsing = !reduceMotion && !dimmed && (marked || node.status === "critical");
              const glowing = !dimmed && (marked || node.status === "critical");
              return (
                <g
                  key={node.id}
                  data-node={node.id}
                  opacity={dimmed ? 0.2 : undefined}
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
                  <circle
                    cx={x}
                    cy={y}
                    r={marked ? 5 : 4}
                    filter={glowing ? "url(#map-glow)" : undefined}
                    className={`stroke-surface-strong stroke-1 ${DOT_FILLS[node.status]}`}
                  />
                </g>
              );
            })}
          </svg>
        )}
        {tip && (
          <div className="globe-tooltip pointer-events-none absolute z-[2]" style={tipStyle}>
            {tip.node ? (
              <>
                <strong>
                  {tip.node.host}
                  {tip.node.isCdn && <span className="ml-1 rounded-sm border border-line px-1 text-[9px] font-medium text-muted">CDN</span>}
                </strong>
                <span>{tip.node.city}, {tip.node.country} · {STATUS_LABELS[tip.node.status]}</span>
              </>
            ) : (
              <>
                <strong>{tip.country.name}</strong>
                <span>{countrySummary(tip.country)}</span>
              </>
            )}
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
