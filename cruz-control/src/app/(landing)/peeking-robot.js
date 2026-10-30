// The Cruz robot peeking over the landing terminal. Styles are in src/styles/robot.css
const EYE = "M106 146 L142 156 Q144 186 124 188 Q104 188 104 164 Z";

// side: "top" peeks over the terminal with its mitts, "left" leans out from the left edge
const PeekingRobot = ({ side = "top" }) => {
    return (
        <div className={`robot robot-${side}`} aria-hidden="true">
            <svg className="robot-head" viewBox="0 0 300 260">
                <path className="robot-band" d="M70 118 C40 100 18 112 8 120 C30 126 44 136 52 150 C40 160 34 178 38 196 C56 180 70 162 78 140 Z" />
                <rect className="robot-ear" x="40" y="140" width="34" height="62" rx="16" />
                <rect className="robot-ear" x="226" y="140" width="34" height="62" rx="16" />
                <path className="robot-shell" d="M96 214 L82 254 L132 222 Z" />
                <rect className="robot-shell" x="58" y="86" width="186" height="146" rx="62" />
                <path className="robot-shade" d="M70 196 Q150 236 232 196" />
                <rect className="robot-visor" x="82" y="116" width="138" height="92" rx="40" />

                <g className="robot-antenna">
                    <line className="robot-stick" x1="228" y1="92" x2="250" y2="44" />
                    <circle className="robot-ball" cx="253" cy="36" r="14" />
                    <circle className="robot-shine" cx="249" cy="32" r="4" />
                </g>

                <path className="robot-band" d="M66 128 C70 78 112 50 160 52 C206 54 236 80 240 112 C204 96 160 92 122 98 C100 102 82 112 66 128 Z" />
                <path className="robot-crease" d="M96 92 C130 78 180 76 220 92" />
                <circle className="robot-band" cx="70" cy="126" r="13" />

                {/* The eye is drawn before the patch, so it slides under it */}
                <path className="robot-eye" d={EYE} />

                <g className="robot-patch">
                    <path className="robot-strap" d="M112 104 L200 156" />
                    <ellipse cx="184" cy="164" rx="28" ry="26" />
                    <circle className="robot-skull" cx="184" cy="158" r="8" />
                    <rect className="robot-skull" x="179" y="163" width="10" height="6" rx="2" />
                    <path className="robot-bones" d="M170 174 L198 184 M198 174 L170 184" />
                </g>
            </svg>

            {side === "top" && <div className="robot-mitts"><span /><span /></div>}
            {side === "left" && <div className="robot-mitts"><span /></div>}
        </div>
    );
};

export default PeekingRobot;
