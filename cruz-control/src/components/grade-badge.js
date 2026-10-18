// A letter grade in a tinted box, used on the scan results and the Projects page.
// Same cut-offs as the API: A 90+, B 80+, C 70+, D 60+, else F.
export const gradeFor = score => {
    if (score >= 90) return "A";
    if (score >= 80) return "B";
    if (score >= 70) return "C";
    if (score >= 60) return "D";
    return "F";
}

// Same colours as the score ring: A-B good, C-D needs work, F at risk
const TONES = {
    A: "border-accent/40 bg-accent/10 text-accent",
    B: "border-accent/40 bg-accent/10 text-accent",
    C: "border-warm/40 bg-warm/10 text-warm",
    D: "border-warm/40 bg-warm/10 text-warm",
    F: "border-critical/40 bg-critical/10 text-critical",
};

const SIZES = {
    sm: "size-7 rounded-md text-sm",
    md: "size-12 rounded-xl text-2xl",
    lg: "size-24 rounded-2xl text-6xl sm:size-28 sm:text-7xl",
};

const GradeBadge = ({ grade, size = "md", className = "" }) => {
    const tone = TONES[grade] ?? "border-line bg-surface text-muted";

    return (
        <span className={`inline-grid flex-none place-items-center border font-bold leading-none ${SIZES[size]} ${tone} ${className}`}>
            <span aria-hidden="true">{grade ?? "?"}</span>
            <span className="sr-only">{grade ? `Grade ${grade}` : "No grade yet"}</span>
        </span>
    );
}

export default GradeBadge;
