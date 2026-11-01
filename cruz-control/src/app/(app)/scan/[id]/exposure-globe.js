"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Globe from "react-globe.gl";
import { LuMinus, LuPlus } from "react-icons/lu";
import { MeshPhongMaterial } from "three";

const PALETTES = {
  light: {
    globe: "#efe7da",
    emissive: "#d8cdbb",
    land: "rgba(42, 110, 96, 0.55)",
    // The glow around the globe follows the grade
    glow: { good: "#7fae9d", fair: "#d9a066", poor: "#d9707a", none: "#b5ad9f" },
    status: { healthy: "#24917a", attention: "#d9822b", critical: "#de4655" },
  },
  dark: {
    globe: "#14201d",
    emissive: "#0b1311",
    land: "rgba(121, 197, 171, 0.5)",
    glow: { good: "#3f7a68", fair: "#9a6a35", poor: "#a3434e", none: "#56605a" },
    status: { healthy: "#7fe0bd", attention: "#ffb066", critical: "#ff6b7a" },
  },
};

const STATUS_LABELS = { healthy: "Healthy", attention: "Needs attention", critical: "Critical" };
const STATUS_RANK = { healthy: 0, attention: 1, critical: 2 };
// Servers hidden by the status filter stay on the globe, just faded
const DIM_ALPHA = 0.18;

// The tooltip is raw HTML inside the canvas overlay, so the CDN tag uses the theme tokens directly
const CDN_TAG_STYLE = "margin-left:4px;padding:0 3px;border:1px solid var(--line);border-radius:3px;color:var(--muted);font-size:9px;font-weight:500";
const MIN_DISTANCE = 180;
const MAX_DISTANCE = 420;
const MIN_ALTITUDE = MIN_DISTANCE / 100 - 1;
const MAX_ALTITUDE = MAX_DISTANCE / 100 - 1;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function withAlpha(hex, alpha) {
  const value = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((start) => parseInt(value.slice(start, start + 2), 16));
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Servers only keep their ports as text ("80, 443", cut at 6 with "...", or "None found")
function portCount(node) {
  if (Array.isArray(node.ports)) return node.ports.length;
  if (!node.service || node.service === "None found") return 0;
  return node.service.split(",").length + (node.service.endsWith("...") ? 1 : 0);
}

function portLabel(node) {
  const count = portCount(node);
  const more = !Array.isArray(node.ports) && node.service?.endsWith("...") ? "+" : "";
  return `${count}${more} open port${count === 1 ? "" : "s"}`;
}

// More open ports make a taller column, up to 8. New columns grow up from the ground (three-globe starts them at 0)
function columnHeight(node) {
  return 0.03 + 0.03 * Math.min(portCount(node), 8);
}

function glowColor(grade, palette) {
  if (grade === "A" || grade === "B") return palette.glow.good;
  if (grade === "C" || grade === "D") return palette.glow.fair;
  if (grade === "F") return palette.glow.poor;
  return palette.glow.none;
}

// ip-api says "The Netherlands", Natural Earth says "Netherlands"
function countryName(node) {
  return node.country.replace(/^The /, "");
}

export default function ExposureGlobe({ nodes, arcs, selectedId, highlightIds = [], dimIds = [], onSelect, theme = "light", grade = null, reduceMotion = false }) {
  const containerRef = useRef(null);
  const globeRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [countries, setCountries] = useState([]);
  const palette = PALETTES[theme] || PALETTES.light;

  // Only servers we located have coordinates to draw
  const located = useMemo(() => nodes.filter((node) => node.located), [nodes]);
  const locatedArcs = useMemo(() => arcs.filter((arc) => arc.from.located && arc.to.located), [arcs]);
  // A faint wider disc under each column, so it glows at the base
  const points = useMemo(() => [...located.map((node) => ({ ...node, halo: true })), ...located], [located]);
  const selected = located.find((node) => node.id === selectedId);
  // The selected server, plus every server the selected finding affects
  const isMarked = (node) => node.id === selectedId || highlightIds.includes(node.id);
  // The selected server is never faded, since Server details is showing it
  const isDimmed = (node) => node.id !== selectedId && dimIds.includes(node.id);
  // Critical servers always pulse so they stand out, unless they're faded
  const pulsing = located.filter((node) => !isDimmed(node) && (node.status === "critical" || isMarked(node)));

  // Countries with a server take the colour of their worst server
  const countryStatus = {};
  for (const node of located) {
    const name = countryName(node);
    if (!countryStatus[name] || STATUS_RANK[node.status] > STATUS_RANK[countryStatus[name]]) {
      countryStatus[name] = node.status;
    }
  }

  const material = useMemo(
    () => new MeshPhongMaterial({ color: palette.globe, emissive: palette.emissive, emissiveIntensity: 0.35, shininess: 4 }),
    [palette.globe, palette.emissive],
  );
  useEffect(() => () => material.dispose(), [material]);

  // Size the WebGL canvas to its container.
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

  // Country outlines are served locally from /public (Natural Earth, via three-globe).
  useEffect(() => {
    const controller = new AbortController();
    fetch("/globe/countries.geojson", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : { features: [] }))
      .then((data) => setCountries(data.features || []))
      .catch(() => {});
    return () => controller.abort();
  }, []);

  function handleGlobeReady() {
    const globe = globeRef.current;
    if (!globe) return;
    const controls = globe.controls();
    controls.autoRotate = !reduceMotion;
    controls.autoRotateSpeed = 0.45;
    // The + and - buttons zoom, so the scroll wheel keeps scrolling the page
    controls.enableZoom = false;
    controls.minDistance = MIN_DISTANCE;
    controls.maxDistance = MAX_DISTANCE;
    // Start facing the servers, not a fixed spot that may hide them all
    const start = selected || located[0];
    globe.pointOfView(start ? { lat: start.lat, lng: start.lng, altitude: 2 } : { lat: 20, lng: 60, altitude: 2.3 }, 0);
  }

  // Fly to the selected server and stop rotating so it stays in view.
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe || !selected) return;
    globe.controls().autoRotate = false;
    globe.pointOfView({ lat: selected.lat, lng: selected.lng, altitude: 1.9 }, reduceMotion ? 0 : 1100);
  }, [selected, reduceMotion]);

  const statusColor = (node) => palette.status[node.status] || palette.status.healthy;

  function landColor(feature) {
    const { ADMIN, NAME_LONG } = feature.properties || {};
    const status = countryStatus[ADMIN] || countryStatus[NAME_LONG];
    return status ? withAlpha(palette.status[status], 0.9) : palette.land;
  }

  function pointColor(node) {
    if (isDimmed(node)) return withAlpha(statusColor(node), node.halo ? DIM_ALPHA / 3 : DIM_ALPHA);
    return node.halo ? withAlpha(statusColor(node), isMarked(node) ? 0.4 : 0.25) : statusColor(node);
  }

  function arcColor(arc) {
    if (isDimmed(arc.to)) return [withAlpha(palette.status.healthy, DIM_ALPHA / 2), withAlpha(palette.status[arc.status], DIM_ALPHA)];
    return [withAlpha(palette.status.healthy, 0.55), withAlpha(palette.status[arc.status], 0.9)];
  }

  function pointAltitude(node) {
    return node.halo ? 0.004 : columnHeight(node);
  }

  function pointRadius(node) {
    if (node.halo) return isMarked(node) ? 2.1 : 1.5;
    return isMarked(node) ? 0.8 : 0.5;
  }

  // Globe radius is 100, so altitude = camera distance / 100 - 1 (matches min/maxDistance).
  function zoom(factor) {
    const globe = globeRef.current;
    if (!globe) return;
    const { lat, lng, altitude } = globe.pointOfView();
    const nextAltitude = Math.min(MAX_ALTITUDE, Math.max(MIN_ALTITUDE, altitude * factor));
    globe.controls().autoRotate = false;
    globe.pointOfView({ lat, lng, altitude: nextAltitude }, reduceMotion ? 0 : 450);
  }

  return (
    <div className="exposure-globe-wrap">
    <div ref={containerRef} className="exposure-globe" aria-hidden="true">
      {size.width > 0 && (
        <Globe
          ref={globeRef}
          width={size.width}
          height={size.height}
          backgroundColor="rgba(0,0,0,0)"
          globeMaterial={material}
          showAtmosphere
          atmosphereColor={glowColor(grade, palette)}
          atmosphereAltitude={0.22}
          onGlobeReady={handleGlobeReady}
          hexPolygonsData={countries}
          hexPolygonResolution={3}
          hexPolygonMargin={0.55}
          hexPolygonUseDots
          hexPolygonColor={landColor}
          pointsData={points}
          pointLat="lat"
          pointLng="lng"
          pointColor={pointColor}
          pointAltitude={pointAltitude}
          pointRadius={pointRadius}
          pointsMerge={false}
          pointsTransitionDuration={reduceMotion ? 0 : 1200}
          pointLabel={(node) => `
            <div class="globe-tooltip">
              <strong>${escapeHtml(node.host)}${node.isCdn ? ` <span style="${CDN_TAG_STYLE}">CDN</span>` : ""}</strong>
              <span>${escapeHtml(node.city)}, ${escapeHtml(node.country)} · ${escapeHtml(STATUS_LABELS[node.status])}</span>
              <span>${portLabel(node)}</span>
            </div>`}
          onPointClick={(node) => onSelect?.(node.id)}
          arcsData={locatedArcs}
          arcStartLat={(arc) => arc.from.lat}
          arcStartLng={(arc) => arc.from.lng}
          arcEndLat={(arc) => arc.to.lat}
          arcEndLng={(arc) => arc.to.lng}
          arcColor={arcColor}
          arcStroke={0.45}
          arcAltitudeAutoScale={0.42}
          arcDashLength={0.45}
          arcDashGap={0.18}
          arcDashAnimateTime={reduceMotion ? 0 : 2600}
          ringsData={reduceMotion ? [] : pulsing}
          ringLat="lat"
          ringLng="lng"
          ringColor={(node) => (t) => withAlpha(statusColor(node), Math.max(0, 1 - t))}
          ringMaxRadius={4.5}
          ringPropagationSpeed={2.4}
          ringRepeatPeriod={1100}
        />
      )}
    </div>
    <div className="globe-zoom" role="group" aria-label="Map zoom">
      <button type="button" onClick={() => zoom(0.75)} aria-label="Zoom in" title="Zoom in">
        <LuPlus aria-hidden="true" />
      </button>
      <button type="button" onClick={() => zoom(1 / 0.75)} aria-label="Zoom out" title="Zoom out">
        <LuMinus aria-hidden="true" />
      </button>
    </div>
    </div>
  );
}
