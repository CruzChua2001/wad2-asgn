import RobotHead from "@/components/robot/robot-head";

const ScanningRobot = ({ status = "scanning" }) => (
    <div className={`scan-robot scan-robot-${status}`} aria-hidden="true">
        <RobotHead>
            <g className="scan-robot-glass">
                <line className="scan-robot-handle" x1="64" y1="198" x2="96" y2="236" />
                <circle className="scan-robot-lens" cx="42" cy="176" r="30" />
                <circle className="scan-robot-glint" cx="32" cy="164" r="7" />
                <rect className="robot-shell" x="84" y="222" width="32" height="24" rx="11" />
            </g>

            <g className="scan-robot-check">
                <circle cx="40" cy="48" r="24" />
                <path d="M28 48 L37 57 L53 39" />
            </g>
        </RobotHead>
    </div>
);

export default ScanningRobot;
