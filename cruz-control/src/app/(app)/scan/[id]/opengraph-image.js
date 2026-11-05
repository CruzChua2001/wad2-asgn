import { ImageResponse } from "next/og";
import { Brand, loadFonts, siteImage } from "@/lib/og";
import { getRating } from "../scan-result";

export const alt = "CruzControl scan result: the exposure score and grade for this website or repo";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Same colours as the app's GradeBadge, flattened onto the dark card
const TONES = {
    good: { tone: "#96e0bd", fill: "#2f473a", border: "#527a66" },
    warn: { tone: "#efc98d", fill: "#384536", border: "#757153" },
    bad: { tone: "#ff9bad", fill: "#3a4039", border: "#7c5e60" },
    none: { tone: "#bfccc1", fill: "#1d2b24", border: "#819589" },
};

const toneFor = score => {
    if (score >= 80) {
        return "good";
    }
    if (score >= 60) {
        return "warn";
    }
    return "bad";
};

// Long names get a smaller font, then get cut
const fitTarget = text => {
    if (text.length <= 18) {
        return { text, size: 64 };
    }
    if (text.length <= 23) {
        return { text, size: 52 };
    }
    return { text: text.length > 27 ? text.slice(0, 26) + "…" : text, size: 44 };
};

const fitRepo = text => (text.length > 34 ? text.slice(0, 33) + "…" : text);

const GlobeIcon = ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#bfccc1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
        <path d="M2 12h20" />
    </svg>
);

const GithubIcon = ({ size }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#bfccc1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
        <path d="M9 18c-4.51 2-5-2-7-2" />
    </svg>
);

const Note = ({ incomplete, critical }) => {
    if (incomplete) {
        return <div style={{ fontSize: 26, color: "#bfccc1" }}>Some checks couldn&apos;t run. Re-scan for a grade.</div>;
    }
    if (critical > 0) {
        return (
            <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 28, fontWeight: 500, color: "#ff9bad" }}>
                <div style={{ width: 14, height: 14, borderRadius: 7, background: "#ff9bad" }} />
                <span>{`${critical} critical ${critical === 1 ? "issue" : "issues"} to fix`}</span>
            </div>
        );
    }
    return <div style={{ fontSize: 26, color: "#bfccc1" }}>No critical issues found</div>;
};

const scanCard = scan => {
    const domain = scan.domain_scans?.domain;
    const repo = scan.repo_scans?.github_repo;
    const incomplete = !scan.grade;
    const score = scan.score ?? 0;
    const t = TONES[incomplete ? "none" : toneFor(score)];
    const critical = scan.findings.filter(finding => finding.severity === "critical").length;
    const main = fitTarget(domain || repo);
    const dash = (score / 100) * 207.35;

    let kind = "Repository scan";
    if (domain && repo) {
        kind = "Website + repo";
    } else if (domain) {
        kind = "Website scan";
    }

    // The older result is the real scan time, like the results header
    let scannedAt = scan.domain_scans?.created_at;
    if (scan.repo_scans && (!scannedAt || new Date(scan.repo_scans.created_at) < new Date(scannedAt))) {
        scannedAt = scan.repo_scans.created_at;
    }
    const date = new Date(scannedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

    return (
        <div style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "space-between", width: 1200, height: 630, padding: "56px 72px 52px", background: "#15201b", color: "#f4f4e9", fontFamily: "Geist" }}>
            <div style={{ position: "absolute", top: 0, left: 0, width: 1200, height: 8, background: incomplete ? "#efc98d" : t.tone }} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Brand size={36} fontSize={20} gap={12} />
                <div style={{ display: "flex", padding: "8px 20px", border: "2px solid #819589", borderRadius: 999, fontFamily: "Geist Mono", fontSize: 18, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#bfccc1" }}>
                    {kind}
                </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 64 }}>
                <div style={{ position: "relative", display: "flex", width: 260, height: 260, flexShrink: 0 }}>
                    <svg width="260" height="260" viewBox="0 0 80 80">
                        <circle cx="40" cy="40" r="33" fill="none" stroke="#404f47" strokeWidth="7" strokeDasharray={incomplete ? "3 4" : undefined} />
                        {!incomplete && (
                            <circle cx="40" cy="40" r="33" fill="none" stroke={t.tone} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${dash} 207.35`} transform="rotate(-90 40 40)" />
                        )}
                    </svg>
                    <div style={{ position: "absolute", top: 0, left: 0, width: 260, height: 260, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontSize: 96, fontWeight: 700, lineHeight: 1, color: t.tone }}>{incomplete ? "--" : String(score)}</span>
                        <span style={{ marginTop: 4, fontSize: 24, fontWeight: 500, color: "#bfccc1" }}>/100</span>
                    </div>
                    <div style={{ position: "absolute", right: -24, bottom: -12, display: "flex", width: 128, height: 128, borderRadius: 26, background: "#24362c", boxShadow: "0 10px 24px rgba(0, 0, 0, 0.45)", transform: "rotate(-8deg)" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 128, height: 128, borderRadius: 26, border: `4px solid ${t.border}`, background: t.fill, color: t.tone, fontSize: 84, fontWeight: 700, lineHeight: 1 }}>
                            {incomplete ? "?" : scan.grade}
                        </div>
                    </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 20, flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 18, minWidth: 0 }}>
                        {domain ? <GlobeIcon size={40} /> : <GithubIcon size={40} />}
                        <span style={{ fontSize: main.size, fontWeight: 600, lineHeight: 1.1, letterSpacing: "-0.02em", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{main.text}</span>
                    </div>
                    {domain && repo && (
                        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
                            <GithubIcon size={30} />
                            <span style={{ fontFamily: "Geist Mono", fontSize: 30, fontWeight: 500, color: "#bfccc1", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{fitRepo(repo)}</span>
                        </div>
                    )}
                    <div style={{ fontSize: 40, fontWeight: 600, color: incomplete ? "#efc98d" : t.tone }}>
                        {incomplete ? "Scan incomplete" : `Grade ${scan.grade} · ${getRating(score)}`}
                    </div>
                    <Note incomplete={incomplete} critical={critical} />
                </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: 22, borderTop: "2px solid #35433c", fontSize: 22, fontWeight: 500, color: "#bfccc1" }}>
                <span style={{ fontFamily: "Geist Mono" }}>{`Scanned ${date}`}</span>
                <span>Public Exposure, Made Clear</span>
            </div>
        </div>
    );
};

// Fetched as a guest, so project scans (members only) and missing scans get the site card instead
const Image = async ({ params }) => {
    const { id } = await params;

    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/scan/${encodeURIComponent(id)}`, { cache: "no-store" });
        if (!res.ok) {
            return siteImage();
        }

        const card = scanCard(await res.json());
        return new ImageResponse(card, { ...size, fonts: await loadFonts() });
    } catch (error) {
        console.error("Failed to make the scan preview image:", error);
        return siteImage();
    }
};

export default Image;
