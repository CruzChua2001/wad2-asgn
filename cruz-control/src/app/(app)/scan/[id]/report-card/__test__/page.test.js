import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { useScan } from "../../../scan-context";
import ReportCardTab from "../page";

vi.mock("next/navigation", () => ({ useParams: () => ({ id: "scan-1" }) }));
vi.mock("../../../scan-context", () => ({ useScan: vi.fn() }));
vi.mock("next/link", () => ({
    default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a>,
}));
// Score trend has its own tests, so here it only shows what it was given
vi.mock("../score-trend", () => ({
    default: ({ projectId, scanId }) => <p>Score trend for {projectId ?? "no project"}, {scanId}</p>,
}));
// Reduced motion so rows and numbers show their final values straight away
vi.mock("motion/react", async importOriginal => ({
    ...await importOriginal(),
    useReducedMotion: () => true,
}));

// jsdom has no IntersectionObserver, which the points counter uses to start once it's on screen
vi.stubGlobal("IntersectionObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
});

const check =(id, category, score, weight = 7.5, status = "ok") => ({
    id, category, label: id, risk: "high", weight, score, status, gain: 0,
});

const finding = (id, overrides = {}) => ({
    id,
    title: id,
    severity: "high",
    kind: "issue",
    category: "ports",
    checkId: "ports-remote-access",
    fix: `Fix ${id}.`,
    gain: 0,
    sharedCheck: false,
    ...overrides,
});

// A website scan with an open MongoDB port: 76 without the cap, capped at 50
const websiteScan = (overrides = {}) => ({
    projectId: null,
    role: null,
    score: 50,
    grade: "F",
    uncappedScore: 76,
    cap: { applied: true, checkIds: ["ports-database-telnet"] },
    incomplete: false,
    breakdown: [
        { category: "email-dns", label: "Email & DNS", lost: 3, status: "ok" },
        { category: "software", label: "Server software", lost: 0, status: "unavailable" },
        { category: "ports", label: "Open ports", lost: 21, status: "ok" },
        { category: "certificate", label: "Certificate (HTTPS)", lost: 0, status: "ok" },
        { category: "web-settings", label: "Website security settings", lost: 0, status: "ok" },
    ],
    checks: [
        check("ports-database-telnet", "ports", 0, 10),
        check("ports-remote-access", "ports", 0),
        check("email-spoofing", "email-dns", 5, 5),
        check("email-caa", "email-dns", 10, 2.5),
        check("software-kev", "software", null, 10, "unavailable"),
        check("cert-validity", "certificate", 10),
        check("web-https-hsts", "web-settings", 10),
        check("web-headers", "web-settings", 9, 5),
    ],
    findings: [
        finding("port-27017", { title: "MongoDB database is open to the internet", severity: "critical", checkId: "ports-database-telnet", gain: 26 }),
        finding("port-22", { title: "SSH is open to the internet", gain: 3, sharedCheck: true }),
        finding("port-3389", { title: "Remote Desktop is open to the internet", gain: 3, sharedCheck: true }),
        finding("dns-dmarc-weak", { title: "DMARC only monitors", severity: "medium", category: "email-dns", checkId: "email-spoofing", gain: 2 }),
        finding("dns-caa", { title: "No CAA record", severity: "low", kind: "recommendation", category: "email-dns", checkId: "email-caa" }),
    ],
    ...overrides,
});

// The same website plus a repository, so both sides get their own score
const bothScan = (overrides = {}) => {
    const website = websiteScan();
    return websiteScan({
        uncappedScore: 71,
        breakdown: [
            ...website.breakdown,
            { category: "secrets", label: "Secret files", lost: 0, status: "ok" },
            { category: "packages", label: "Packages", lost: 5, status: "ok" },
            { category: "workflows", label: "CI workflows", lost: 0, status: "not_checked" },
        ],
        checks: [
            ...website.checks,
            check("secrets-files", "secrets", 10, 10),
            check("packages-vulns", "packages", 7),
            check("workflow-dangerous", "workflows", null, 7.5, "not_checked"),
        ],
        ...overrides,
    });
}

const showReport = result => {
    useScan.mockReturnValue({ result });
    render(<ReportCardTab />);
}

// The category rows under a "Website" or "Repository" heading
const rowsOf = side => within(screen.getByRole("heading", { name: side }).nextElementSibling).getAllByRole("listitem");
const rowFor = (side, label) => rowsOf(side).find(row => row.textContent.includes(label));
const topFixes = _ => within(screen.getByRole("heading", { name: "Fix these first" }).closest("section")).getAllByRole("listitem");

beforeEach(() => {
    vi.clearAllMocks();
});

describe("Report Card grade and score", () => {
    test("shows the grade, the score and its rating", () => {
        showReport(websiteScan());

        // The big badge comes first, before the category rows' small ones
        expect(screen.getAllByText("Grade F")[0].parentElement.className).toContain("size-24");
        expect(screen.getByText("50").textContent).toBe("50 / 100");
        expect(screen.getByText("At risk")).toBeTruthy();
    });

    test("explains the cap and what the score would be without it", () => {
        showReport(websiteScan());

        expect(screen.getByText("Capped at 50 until the critical problem is fixed. Without the cap, you'd score 76.")).toBeTruthy();
    });

    test("says problems are when two critical checks cap the score", () => {
        showReport(websiteScan({ cap: { applied: true, checkIds: ["ports-database-telnet", "software-kev"] } }));

        expect(screen.getByText(/until the critical problems are fixed/)).toBeTruthy();
    });

    test("doesn't mention the cap when the score is already under 50", () => {
        showReport(websiteScan({ score: 45, grade: "F", uncappedScore: 45 }));

        expect(screen.queryByText(/Capped at 50/)).toBeNull();
        expect(screen.getByText("100 - 24 points lost = 45").textContent).toBe("100 - 24 points lost = 45");
    });

    test("shows the score trend for this scan", () => {
        showReport(websiteScan({ projectId: "p1", role: "owner" }));

        expect(screen.getByText("Score trend for p1, scan-1")).toBeTruthy();
    });

    test("shows the scoring rule", () => {
        showReport(websiteScan());

        expect(screen.getByText(/Your score is out of 100, and higher is safer/)).toBeTruthy();
    });
});

describe("Report Card when a critical check couldn't run", () => {
    const incomplete = { incomplete: true, grade: null, score: 62, uncappedScore: 62, cap: { applied: false, checkIds: [] } };

    test("a guest scan says to re-scan", () => {
        showReport(websiteScan(incomplete));

        expect(screen.getByText("Incomplete, re-scan")).toBeTruthy();
        expect(screen.getByText("A critical check couldn't run, so there's no grade yet. Re-scan to try again.")).toBeTruthy();
        expect(screen.getByText("No grade yet")).toBeTruthy();
    });

    test("a project owner is told to re-scan", () => {
        showReport(websiteScan({ ...incomplete, projectId: "p1", role: "owner" }));

        expect(screen.getByText("Incomplete, re-scan")).toBeTruthy();
    });

    test("a viewer is told an owner can re-scan", () => {
        showReport(websiteScan({ ...incomplete, projectId: "p1", role: "viewer" }));

        expect(screen.getByText("Incomplete")).toBeTruthy();
        expect(screen.getByText(/A project owner can re-scan to try again./)).toBeTruthy();
    });

    test("hides the points chips, since there's no grade yet", () => {
        showReport(websiteScan(incomplete));

        expect(screen.queryByLabelText(/Fixing this adds/)).toBeNull();
        expect(screen.queryByText(/↑/)).toBeNull();
    });
});

describe("Report Card category rows", () => {
    test("lists the worst category first and the ones that didn't run last", () => {
        showReport(websiteScan());
        const labels = rowsOf("Website").map(row => row.querySelector(".text-ink").textContent);

        expect(labels).toEqual(["Open ports", "Email & DNS", "Certificate (HTTPS)", "Website security settings", "Server software"]);
    });

    test("a failed category shows 0/10, an F and the points it lost", () => {
        showReport(websiteScan());
        const row = rowFor("Website", "Open ports");

        expect(row.textContent).toContain("0/10");
        expect(row.textContent).toContain("Grade F");
        expect(row.textContent).toContain("-21 pts");
        expect(within(row).getByText("21 points lost")).toBeTruthy();
    });

    test("a category's score is the weighted average of its checks, rounded down", () => {
        showReport(websiteScan());

        expect(rowFor("Website", "Email & DNS").textContent).toContain("6/10");
    });

    test("names the first two findings behind a category and counts the rest", () => {
        showReport(websiteScan());

        expect(rowFor("Website", "Open ports").textContent).toContain("MongoDB database is open to the internet · SSH is open to the internet +1 more");
        expect(rowFor("Website", "Email & DNS").textContent).toContain("DMARC only monitors · No CAA record");
    });

    test("a perfect category shows 10/10, 0 pts and no problems", () => {
        showReport(websiteScan());
        const row = rowFor("Website", "Certificate (HTTPS)");

        expect(row.textContent).toContain("10/10");
        expect(row.textContent).toContain("0 pts");
        expect(row.textContent).toContain("Grade A");
        expect(row.textContent).toContain("No problems found");
    });

    test("losing less than a point says Minor instead of 0 pts", () => {
        showReport(websiteScan());
        const row = rowFor("Website", "Website security settings");

        expect(row.textContent).toContain("9/10");
        expect(row.textContent).toContain("Minor");
        expect(row.textContent).not.toContain("0 pts");
    });

    test("a lookup that failed says Couldn't check, with no grade", () => {
        showReport(websiteScan());
        const row = rowFor("Website", "Server software");

        expect(row.textContent).toContain("Couldn't check");
        expect(row.textContent).toContain("Couldn't check this time. A new scan can try again.");
        expect(row.textContent).not.toContain("Grade");
    });

    test("a check that doesn't apply says Not checked", () => {
        showReport(bothScan());
        const row = rowFor("Repository", "CI workflows");

        expect(row.textContent).toContain("Not checked");
        expect(row.textContent).toContain("Doesn't apply here, or this scan is older than the check.");
    });

    test("findings with no check, like an archived repo, aren't listed as the reason", () => {
        showReport(bothScan({
            findings: [finding("repo-archived", { title: "This repository is archived", kind: "recommendation", category: "secrets", checkId: null })],
        }));

        expect(rowFor("Repository", "Secret files").textContent).toContain("No problems found");
    });

    test("adds up the points lost to the score, plus the cap", () => {
        showReport(websiteScan());
        const sum = screen.getByText("100 - 24 points lost = 76");

        expect(sum.textContent).toBe("100 - 24 points lost = 76, capped at 50");
    });

    test("leaves out the sum when no category ran", () => {
        showReport(websiteScan({
            breakdown: [{ category: "software", label: "Server software", lost: 0, status: "unavailable" }],
            checks: [check("software-kev", "software", null, 10, "unavailable")],
        }));

        expect(screen.queryByText(/points lost =/)).toBeNull();
    });
});

describe("Report Card website and repository scores", () => {
    test("a website-only scan shows one side and no sub-scores", () => {
        showReport(websiteScan());

        expect(screen.getByText("At risk")).toBeTruthy();
        expect(screen.queryByRole("heading", { name: "Repository" })).toBeNull();
    });

    test("a scan of both shows each side's score next to the rating", () => {
        showReport(bothScan());

        expect(screen.getByText("At risk · Website 54 · Repository 87")).toBeTruthy();
        expect(rowsOf("Repository").map(row => row.querySelector(".text-ink").textContent))
            .toEqual(["Packages", "Secret files", "CI workflows"]);
    });

    test("leaves out a side whose checks didn't run", () => {
        showReport(bothScan({
            breakdown: [
                ...websiteScan().breakdown,
                { category: "workflows", label: "CI workflows", lost: 0, status: "not_checked" },
            ],
            checks: [...websiteScan().checks, check("workflow-dangerous", "workflows", null, 7.5, "not_checked")],
        }));

        expect(screen.getByText("At risk · Website 54")).toBeTruthy();
    });

    test("an old scan without a breakdown or checks still loads", () => {
        showReport(websiteScan({ breakdown: undefined, checks: undefined, findings: [], cap: undefined, uncappedScore: undefined }));

        expect(screen.getByText("At risk")).toBeTruthy();
        expect(screen.queryByText(/points lost =/)).toBeNull();
        expect(screen.getByText(/Nothing to fix right now/)).toBeTruthy();
    });
});

describe("Report Card Fix these first", () => {
    test("shows the three worst issues, worst first", () => {
        showReport(websiteScan());
        const titles = topFixes().map(item => within(item).getByRole("link").textContent);

        expect(titles).toEqual([
            "MongoDB database is open to the internet",
            "SSH is open to the internet",
            "Remote Desktop is open to the internet",
        ]);
        expect(within(topFixes()[0]).getByText("Critical")).toBeTruthy();
        expect(within(topFixes()[1]).getByText("High")).toBeTruthy();
    });

    test("puts real issues before good-practice tips, even milder ones", () => {
        showReport(websiteScan({
            findings: [
                finding("repo-dependabot", { title: "No Dependabot config", kind: "recommendation", severity: "high" }),
                finding("dns-dmarc-weak", { title: "DMARC only monitors", severity: "low" }),
            ],
        }));
        const titles = topFixes().map(item => within(item).getByRole("link").textContent);

        expect(titles).toEqual(["DMARC only monitors", "No Dependabot config"]);
    });

    test("each title opens that finding on the Overview", () => {
        showReport(websiteScan({ findings: [finding("dep-@babel/core", { title: "@babel/core has known security bugs" })] }));

        expect(screen.getByRole("link", { name: "@babel/core has known security bugs" }).getAttribute("href"))
            .toBe("/scan/scan-1?finding=dep-%40babel%2Fcore");
        expect(screen.getByRole("link", { name: "See all findings" }).getAttribute("href")).toBe("/scan/scan-1");
    });

    test("shows the fix under each finding", () => {
        showReport(websiteScan());

        expect(within(topFixes()[0]).getByText("What to do:")).toBeTruthy();
        expect(topFixes()[0].textContent).toContain("Fix port-27017.");
    });

    test("shows how many points a fix is worth", () => {
        showReport(websiteScan());

        expect(within(topFixes()[0]).getByLabelText("Fixing this adds 26 points to your score").textContent).toBe("↑ +26 pts");
    });

    test("says up to when other findings share the points", () => {
        showReport(websiteScan());

        expect(within(topFixes()[1]).getByLabelText("Fixing this adds up to 3 points to your score").textContent).toBe("↑ up to +3 pts");
    });

    test("hides the chip when a fix is worth nothing or has no check", () => {
        showReport(websiteScan({
            findings: [
                finding("port-22", { title: "SSH is open to the internet", gain: 0 }),
                finding("repo-archived", { title: "This repository is archived", checkId: null, gain: undefined }),
            ],
        }));

        expect(screen.queryByLabelText(/Fixing this adds/)).toBeNull();
    });

    test("says there's nothing to fix when there are no findings", () => {
        showReport(websiteScan({ findings: [] }));

        const section = screen.getByRole("heading", { name: "Fix these first" }).closest("section");

        expect(within(section).getByText("Nothing to fix right now. Re-scan now and then to keep it that way.")).toBeTruthy();
        expect(within(section).queryByRole("list")).toBeNull();
    });
});
