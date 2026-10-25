import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import api from "@/lib/api";
import { useScan } from "../../../scan-context";
import { gradeFor } from "@/components/grade-badge";
import ScoreTrend from "../score-trend";

vi.mock("@/lib/api", () => ({ default: { get: vi.fn() } }));
vi.mock("../../../scan-context", () => ({ useScan: vi.fn() }));
vi.mock("next/link", () => ({
    default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a>,
}));
// Reduced motion so the chart is drawn in its final state
vi.mock("motion/react", async importOriginal => ({
    ...await importOriginal(),
    useReducedMotion: () => true,
}));

// A project's scans as the API sends them: newest first, one day apart, ending on 20 Oct 2026.
// The newest scan is "scan-N" and the oldest is "scan-1".
const history = scores => scores.map((score, i) => ({
    id: `scan-${scores.length - i}`,
    created_at: new Date(2026, 9, 20 - i, 12).toISOString(),
    score,
    grade: gradeFor(score),
}));

const scanState = (overrides = {}) => {
    const state = { saveToProject: vi.fn(), savedScanId: null, saving: false, ...overrides };
    useScan.mockReturnValue(state);
    return state;
}

const showHistory = async (scans, scanId) => {
    api.get.mockResolvedValue({ data: scans });
    render(<ScoreTrend projectId="p1" scanId={scanId} />);
    await screen.findByRole("img");
}

beforeEach(() => {
    vi.clearAllMocks();
    scanState();
});

describe("ScoreTrend outside a project", () => {
    test("asks to save the scan to a project", () => {
        render(<ScoreTrend projectId={null} scanId="scan-1" />);

        expect(screen.getByText("Save to a project to track your score over time.")).toBeTruthy();
        expect(api.get).not.toHaveBeenCalled();
    });

    test("Save to project saves this scan", () => {
        const state = scanState();
        render(<ScoreTrend projectId={null} scanId="scan-1" />);
        fireEvent.click(screen.getByRole("button", { name: /Save to project/ }));

        expect(state.saveToProject).toHaveBeenCalledWith("scan-1");
    });

    test("shows Saving... and can't be clicked while it saves", () => {
        scanState({ saving: true });
        render(<ScoreTrend projectId={null} scanId="scan-1" />);
        const button = screen.getByRole("button", { name: /Saving/ });

        expect(button.disabled).toBe(true);
    });

    test("once saved, links to Projects instead of the button", () => {
        scanState({ savedScanId: "scan-1" });
        render(<ScoreTrend projectId={null} scanId="scan-1" />);

        expect(screen.getByRole("link", { name: "View it in Projects" }).getAttribute("href")).toBe("/project");
        expect(screen.queryByRole("button")).toBeNull();
    });

    test("a different saved scan still shows the button", () => {
        scanState({ savedScanId: "another-scan" });
        render(<ScoreTrend projectId={null} scanId="scan-1" />);

        expect(screen.getByRole("button", { name: /Save to project/ })).toBeTruthy();
    });
});

describe("ScoreTrend in a project", () => {
    test("loads the project's history while it waits", () => {
        api.get.mockReturnValue(new Promise(() => {}));
        render(<ScoreTrend projectId="p1" scanId="scan-1" />);

        expect(api.get).toHaveBeenCalledWith("/api/project/p1/scan");
        expect(screen.getByText("Loading score history...")).toBeTruthy();
    });

    test("shows the API's error", async () => {
        api.get.mockRejectedValue({ response: { data: { error: "Project not found." } } });
        render(<ScoreTrend projectId="p1" scanId="scan-1" />);

        expect((await screen.findByRole("alert")).textContent).toBe("Project not found.");
    });

    test("shows a friendly error when the request fails without an answer", async () => {
        api.get.mockRejectedValue(new Error("Network Error"));
        render(<ScoreTrend projectId="p1" scanId="scan-1" />);

        expect((await screen.findByRole("alert")).textContent).toBe("Could not load your score history.");
    });

    test.each([
        [[]],
        [[72]],
    ])("with %j there's no chart yet", async scores => {
        api.get.mockResolvedValue({ data: history(scores) });
        render(<ScoreTrend projectId="p1" scanId="scan-1" />);

        expect(await screen.findByText(/This is the project's first scan/)).toBeTruthy();
        expect(screen.queryByRole("img")).toBeNull();
    });

    test("draws the scores oldest to newest with the date range", async () => {
        await showHistory(history([72, 60, 45]), "scan-3");

        expect(screen.getByText("Score over last 3 scans")).toBeTruthy();
        expect(screen.getByRole("img", { name: "Scores over the last 3 scans: 45, 60, 72" })).toBeTruthy();
        expect(screen.getByText("18 Oct 2026 to 20 Oct 2026")).toBeTruthy();
    });

    test("says how much the score went up since the last scan", async () => {
        await showHistory(history([72, 60, 45]), "scan-3");

        expect(screen.getByText("Up 12 since the last scan")).toBeTruthy();
    });

    test("compares an older scan with the one before it", async () => {
        await showHistory(history([72, 60, 45]), "scan-2");

        expect(screen.getByText("Up 15 since the last scan")).toBeTruthy();
    });

    test("says when the score went down", async () => {
        await showHistory(history([40, 55]), "scan-2");

        expect(screen.getByText("Down 15 since the last scan")).toBeTruthy();
    });

    test("says when the score stayed the same", async () => {
        await showHistory(history([60, 60]), "scan-2");

        expect(screen.getByText("Same as the last scan")).toBeTruthy();
    });

    test("the first scan has nothing to compare with", async () => {
        await showHistory(history([72, 60, 45]), "scan-1");

        expect(screen.queryByText(/since the last scan|Same as the last scan/)).toBeNull();
    });

    test("a scan missing from the history compares the newest two", async () => {
        await showHistory(history([72, 60, 45]), "not-in-history");

        expect(screen.getByText("Up 12 since the last scan")).toBeTruthy();
    });

    test("shows only the last 10 scans, numbered by their place in the history", async () => {
        const scores = [90, 88, 85, 80, 78, 75, 70, 66, 60, 55, 50, 45];
        await showHistory(history(scores), "scan-12");

        expect(screen.getByText("Score over last 10 scans")).toBeTruthy();
        expect(screen.queryByRole("link", { name: /^Scan 2 of 12/ })).toBeNull();
        expect(screen.getByRole("link", { name: /^Scan 3 of 12/ }).textContent).toBe("#3");
        expect(screen.getByRole("link", { name: /^Scan 12 of 12/ }).textContent).toBe("#12");
        expect(screen.getAllByRole("link")).toHaveLength(10);
    });

    test("each number links to that scan's Report Card and marks the one being viewed", async () => {
        await showHistory(history([72, 60, 45]), "scan-2");
        const current = screen.getByRole("link", { name: /^Scan 2 of 3/ });
        const other = screen.getByRole("link", { name: /^Scan 3 of 3/ });

        expect(current.getAttribute("href")).toBe("/scan/scan-2/report-card");
        expect(current.getAttribute("aria-current")).toBe("page");
        expect(other.getAttribute("aria-current")).toBeNull();
        expect(other.getAttribute("aria-label")).toBe("Scan 3 of 3, 20 Oct 2026, score 72, grade C");
    });

    test("hovering a scan shows its date, grade and score", async () => {
        await showHistory(history([72, 60, 45]), "scan-3");
        const link = screen.getByRole("link", { name: /^Scan 2 of 3/ });

        fireEvent.mouseEnter(link);
        expect(screen.getByText("19 Oct 2026 · Grade D · 60")).toBeTruthy();

        fireEvent.mouseLeave(link);
        expect(screen.queryByText("19 Oct 2026 · Grade D · 60")).toBeNull();
    });

    test("tabbing to a scan shows its details too", async () => {
        await showHistory(history([72, 60]), "scan-2");
        const link = screen.getByRole("link", { name: /^Scan 1 of 2/ });

        fireEvent.focus(link);
        expect(screen.getByText("19 Oct 2026 · Grade D · 60")).toBeTruthy();

        fireEvent.blur(link);
        expect(screen.queryByText("19 Oct 2026 · Grade D · 60")).toBeNull();
    });

    test("an incomplete scan says it has no grade", async () => {
        const scans = history([72, 48]);
        scans[1].grade = null;
        await showHistory(scans, "scan-2");
        const link = screen.getByRole("link", { name: /^Scan 1 of 2/ });

        expect(link.getAttribute("aria-label")).toBe("Scan 1 of 2, 19 Oct 2026, score 48, grade no grade");
        fireEvent.mouseEnter(link);
        expect(screen.getByText("19 Oct 2026 · No grade · 48")).toBeTruthy();
    });

    test("loads the history again when the project changes", async () => {
        api.get.mockResolvedValue({ data: history([72, 60]) });
        const { rerender } = render(<ScoreTrend projectId="p1" scanId="scan-2" />);
        await screen.findByRole("img");

        rerender(<ScoreTrend projectId="p2" scanId="scan-2" />);

        expect(api.get).toHaveBeenLastCalledWith("/api/project/p2/scan");
        expect(api.get).toHaveBeenCalledTimes(2);
    });
});
