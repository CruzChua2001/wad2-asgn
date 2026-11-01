import { scanDate } from "@/lib/scan-comparison";

// Explicit null means not included. Undefined means the target itself is unknown.
export default function ScanCaptureDates({ domain, githubRepo, domainCapturedAt, repoCapturedAt }) {
    const describe = (label, target, date) => {
        if (target === null) return `${label} not included`;
        if (!target) return `${label} information unavailable`;
        return `${label} captured: ${date ? scanDate(date) : "Capture date unknown"}`;
    };
    return (
        <p className="text-sm text-muted">
            {describe("Website", domain, domainCapturedAt)}<br />
            {describe("Repository", githubRepo, repoCapturedAt)}
        </p>
    );
}
