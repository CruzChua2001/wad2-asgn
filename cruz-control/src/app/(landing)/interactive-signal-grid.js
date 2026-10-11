export default function InteractiveSignalGrid() {
  return (
    <div className="interactive-signal-grid" aria-hidden="true">
      <span className="signal-grid-layer signal-grid-layer-base" />
      <span className="signal-grid-layer signal-grid-layer-highlight" />
      <span className="signal-grid-glow" />
    </div>
  );
}
