import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Shared pieces for the link preview images (opengraph-image.js files)
const FONT_CSS = "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@500;600";

const logo = await readFile(join(process.cwd(), "public/og-mark.png"), "base64");
const logoSrc = `data:image/png;base64,${logo}`;

let fonts = null;

// Google Fonts sends .ttf files when the request doesn't come from a browser, which is what the image renderer needs
export const loadFonts = async _ => {
    if (fonts) {
        return fonts;
    }

    try {
        const res = await fetch(FONT_CSS);
        const css = await res.text();
        const faces = [...css.matchAll(/font-family: '(.+?)';[\s\S]*?font-weight: (\d+);[\s\S]*?url\((.+?)\)/g)];

        fonts = await Promise.all(faces.map(async ([, name, weight, url]) => {
            const font = await fetch(url);
            return { name, weight: Number(weight), style: "normal", data: await font.arrayBuffer() };
        }));
        return fonts;
    } catch (error) {
        // Leaving fonts out makes the image use the built-in font instead
        console.error("Failed to load the preview image fonts:", error);
        return undefined;
    }
};

export const Brand = ({ size, fontSize, gap }) => (
    <div style={{ display: "flex", alignItems: "center", gap }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- the image renderer only understands plain img tags */}
        <img src={logoSrc} width={size} height={size} alt="" />
        <span style={{ fontFamily: "Geist Mono", fontSize, fontWeight: 600, letterSpacing: "0.08em" }}>CRUZCONTROL</span>
    </div>
);

const Dot = ({ size, color }) => (
    <div style={{ width: size, height: size, borderRadius: size / 2, background: color }} />
);

const Globe = _ => (
    <svg width="520" height="520" viewBox="0 0 520 520" fill="none">
        <circle cx="260" cy="260" r="220" fill="#18261f" stroke="#47584f" strokeWidth="2" />
        <ellipse cx="260" cy="260" rx="150" ry="220" stroke="#32423a" strokeWidth="2" />
        <ellipse cx="260" cy="260" rx="70" ry="220" stroke="#32423a" strokeWidth="2" />
        <path d="M69.5 150 Q260 186 450.5 150" stroke="#32423a" strokeWidth="2" />
        <path d="M40 260 Q260 300 480 260" stroke="#32423a" strokeWidth="2" />
        <path d="M69.5 370 Q260 406 450.5 370" stroke="#32423a" strokeWidth="2" />
        <path d="M205 235 Q262 150 335 165" stroke="#96e0bd" strokeOpacity="0.75" strokeWidth="2.5" strokeDasharray="7 7" strokeLinecap="round" />
        <path d="M205 235 Q310 250 370 330" stroke="#96e0bd" strokeOpacity="0.75" strokeWidth="2.5" strokeDasharray="7 7" strokeLinecap="round" />
        <path d="M205 235 Q140 300 150 360" stroke="#96e0bd" strokeOpacity="0.75" strokeWidth="2.5" strokeDasharray="7 7" strokeLinecap="round" />
        <circle cx="205" cy="235" r="22" fill="#96e0bd" fillOpacity="0.16" />
        <circle cx="205" cy="235" r="9" fill="#96e0bd" stroke="#15201b" strokeWidth="3" />
        <circle cx="335" cy="165" r="7" fill="#96e0bd" />
        <circle cx="370" cy="330" r="7" fill="#efc98d" />
        <circle cx="150" cy="360" r="20" stroke="#ff9bad" strokeOpacity="0.55" strokeWidth="2" />
        <circle cx="150" cy="360" r="7" fill="#ff9bad" />
    </svg>
);

const SiteCard = _ => (
    <div style={{ position: "relative", display: "flex", width: 1200, height: 630, overflow: "hidden", background: "radial-gradient(ellipse 640px 520px at 84% 50%, #263e32 0%, #15201b 72%)", color: "#f4f4e9", fontFamily: "Geist" }}>
        <div style={{ position: "absolute", right: -70, top: 55, display: "flex" }}>
            <Globe />
        </div>
        <div style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "space-between", width: 740, height: 630, padding: "64px 0 64px 72px" }}>
            <Brand size={44} fontSize={24} gap={14} />
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 22, fontWeight: 500, letterSpacing: "0.04em", color: "#96e0bd" }}>
                    <div style={{ width: 10, height: 10, borderRadius: 5, background: "#96e0bd", boxShadow: "0 0 12px rgba(150, 224, 189, 0.55)" }} />
                    <span>For students & first-time developers</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", fontSize: 76, fontWeight: 600, lineHeight: 1.08, letterSpacing: "-0.035em" }}>
                    <span>Public Exposure,</span>
                    <span style={{ color: "#96e0bd" }}>Made Clear.</span>
                </div>
                <div style={{ maxWidth: 600, fontSize: 28, lineHeight: 1.45, color: "#bfccc1" }}>
                    Passive, read-only checks of your website and public GitHub repo, explained in plain language.
                </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 16, fontFamily: "Geist Mono", fontSize: 20, fontWeight: 500, color: "#bfccc1" }}>
                <span>Public data only</span>
                <Dot size={6} color="#efc98d" />
                <span>Non-intrusive</span>
                <Dot size={6} color="#efc98d" />
                <span>Built for learning</span>
            </div>
        </div>
    </div>
);

export const siteImage = async _ => new ImageResponse(<SiteCard />, { width: 1200, height: 630, fonts: await loadFonts() });
