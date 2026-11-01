import { Hourglass } from "ldrs/react";
import "ldrs/react/Hourglass.css";

const SmallLoader = ({ text = "", size = 20, className = "" }) => (
    <span role="status" className={`inline-flex items-center gap-2 ${className}`}>
        <Hourglass size={size} color="currentColor" speed={1.75} bgOpacity={0.15} />
        {text ? text : <span className="sr-only">Loading</span>}
    </span>
);

export default SmallLoader;