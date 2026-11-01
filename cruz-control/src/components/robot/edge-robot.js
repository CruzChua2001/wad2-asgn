import RobotHead from "./robot-head";

const EdgeRobot = ({ edge = "bottom", offset = 50, curious = false, onDone }) => (
    <div
        className={`edge-robot edge-robot-${edge} ${curious ? "edge-robot-curious" : ""}`}
        style={{ "--offset": `${offset}%` }}
        aria-hidden="true"
    >
        <div
            className="edge-robot-body"
            onAnimationEnd={event => {
                if (event.animationName === "edge-peek" && onDone) onDone();
            }}
        >
            <RobotHead>
                {curious && (
                    <g className="edge-robot-question">
                        <path className="edge-robot-question-outline" d="M22 34 Q24 12 44 14 Q62 18 56 36 Q50 48 40 52 L40 60" />
                        <path className="edge-robot-question-fill" d="M22 34 Q24 12 44 14 Q62 18 56 36 Q50 48 40 52 L40 60" />
                        <circle cx="40" cy="78" r="8" />
                    </g>
                )}
            </RobotHead>
        </div>
    </div>
);

export default EdgeRobot;
