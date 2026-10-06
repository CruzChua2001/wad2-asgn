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
    atmosphere: "#7fae9d",
    status: { healthy: "#2a6e60", attention: "#b8733f", critical: "#c85560" },
  },
  dark: {
    globe: "#14201d",
    emissive: "#0b1311",
    land: "rgba(121, 197, 171, 0.5)",
    atmosphere: "#3f7a68",
    status: { healthy: "#79c5ab", attention: "#d7a36b", critical: "#ff6b7a" },
  },
};

const STATUS_LABELS = { healthy: "Healthy", attention: "Needs attention", critical: "Critical" };
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

export default function ExposureGlobe({ nodes, arcs, selectedId, onSelect, theme = "light", reduceMotion = false }) {
  const containerRef = useRef(null);
  const globeRef = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [countries, setCountries] = useState([]);
  const palette = PALETTES[theme] || PALETTES.light;
  const selected = nodes.find((node) => node.id === selectedId);

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
    controls.enableZoom = true;
    controls.minDistance = MIN_DISTANCE;
    controls.maxDistance = MAX_DISTANCE;
    globe.pointOfView({ lat: 20, lng: 60, altitude: 2.3 }, 0);
  }

  // Fly to the selected server and stop rotating so it stays in view.
  useEffect(() => {
    const globe = globeRef.current;
    if (!globe || !selected) return;
    globe.controls().autoRotate = false;
    globe.pointOfView({ lat: selected.lat, lng: selected.lng, altitude: 1.9 }, reduceMotion ? 0 : 1100);
  }, [selected, reduceMotion]);

  const statusColor = (node) => palette.status[node.status] || palette.status.healthy;

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
          atmosphereColor={palette.atmosphere}
          atmosphereAltitude={0.17}
          onGlobeReady={handleGlobeReady}
          hexPolygonsData={countries}
          hexPolygonResolution={3}
          hexPolygonMargin={0.55}
          hexPolygonUseDots
          hexPolygonColor={() => palette.land}
          pointsData={nodes}
          pointLat="lat"
          pointLng="lng"
          pointColor={statusColor}
          pointAltitude={(node) => (node.id === selectedId ? 0.12 : 0.06)}
          pointRadius={(node) => (node.id === selectedId ? 0.75 : 0.55)}
          pointsMerge={false}
          pointLabel={(node) => `
            <div class="globe-tooltip">
              <strong>${escapeHtml(node.host)}</strong>
              <span>${escapeHtml(node.city)}, ${escapeHtml(node.country)} · ${escapeHtml(STATUS_LABELS[node.status])}</span>
            </div>`}
          onPointClick={(node) => onSelect?.(node.id)}
          arcsData={arcs}
          arcStartLat={(arc) => arc.from.lat}
          arcStartLng={(arc) => arc.from.lng}
          arcEndLat={(arc) => arc.to.lat}
          arcEndLng={(arc) => arc.to.lng}
          arcColor={(arc) => [withAlpha(palette.status.healthy, 0.55), withAlpha(palette.status[arc.status], 0.9)]}
          arcStroke={0.45}
          arcAltitudeAutoScale={0.42}
          arcDashLength={0.45}
          arcDashGap={0.18}
          arcDashAnimateTime={reduceMotion ? 0 : 2600}
          ringsData={selected ? [selected] : []}
          ringLat="lat"
          ringLng="lng"
          ringColor={(node) => (t) => withAlpha(statusColor(node), Math.max(0, 1 - t))}
          ringMaxRadius={4.5}
          ringPropagationSpeed={2.4}
          ringRepeatPeriod={reduceMotion ? 0 : 1100}
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
