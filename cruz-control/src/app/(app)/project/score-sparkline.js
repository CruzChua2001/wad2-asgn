const WIDTH = 96;
const HEIGHT = 28;
const PAD = 4;

// Same colours as the score ring: 80+ good, 60+ needs work, else at risk
export const scoreTone = score => {
    if (score >= 80) return "text-accent";
    if (score >= 60) return "text-warm";
    return "text-critical";
}

// Small line of the last few scores, oldest on the left
const ScoreSparkline = ({ scores = [] }) => {
    if (scores.length < 2) return null;

    // Zoom in around the scores so small changes still show
    const low = Math.max(0, Math.min(...scores) - 10);
    const high = Math.min(100, Math.max(...scores) + 10);
    const step = (WIDTH - PAD * 2) / (scores.length - 1);

    const points = scores.map((score, i) => ({
        x: PAD + i * step,
        y: PAD + ((high - score) / (high - low)) * (HEIGHT - PAD * 2),
    }));
    const last = points.at(-1);
    const latest = scores.at(-1);

    return (
        <div className="flex-none">
            <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width={WIDTH} height={HEIGHT} aria-hidden="true" className="block overflow-visible">
                <polyline
                    points={points.map(p => `${p.x},${p.y}`).join(" ")}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-muted opacity-70"
                />
                <circle cx={last.x} cy={last.y} r="3.5" fill="currentColor" className={scoreTone(latest)} />
            </svg>
            <span className="sr-only">Score went from {scores[0]} to {latest} over the last {scores.length} scans</span>
        </div>
    );
}

export default ScoreSparkline;
