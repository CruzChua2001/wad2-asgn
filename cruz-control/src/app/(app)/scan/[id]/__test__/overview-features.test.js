import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, within, fireEvent, act, cleanup } from "@testing-library/react";
import { useSearchParams } from "next/navigation";
import { useScan } from "../../scan-context";
import styles from "@/styles/overview/scan-results.module.css";
import OverviewTab from "../page";

vi.mock("../../scan-context", () => ({ useScan: vi.fn() }));
vi.mock("next/navigation", () => ({ useSearchParams: vi.fn() }));
vi.mock("@/lib/theme-store", () => ({ useTheme: () => ["light"] }));
vi.mock("next/dynamic", () => ({
    default: () => function MapStub() {
        return <div data-testid="map" />;
    },
}));
vi.mock("motion/react", async importOriginal => ({
    ...await importOriginal(),
    useReducedMotion: () => true,
}));

vi.stubGlobal("IntersectionObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
});

Element.prototype.scrollIntoView = () => {};

const LAYOUT_KEY = "cruz-control-overview-view-v1";

const check = (id, category, risk, weight, score, status = "ok") => ({
    id, category, label: `Label ${id}`, risk, weight, score, status, gain: 0,
});

// Ran: 10 x 0, 7.5 x 5, 5 x 0, 10 x 10, 10 x 10 = 237.5 out of 425, so 56, capped at 50
const checks = [
    check("ports-database-telnet", "ports", "critical", 10, 0),
    check("ports-remote-access", "ports", "high", 7.5, 5),
    check("email-spoofing", "email-dns", "medium", 5, 0),
    check("cert-validity", "certificate", "critical", 10, 10),
    check("software-kev", "software", "critical", 10, 10),
    check("web-headers", "web-settings", "medium", 5, null, "unavailable"),
];

const breakdown = [
    { category: "ports", label: "Open ports", lost: 32, status: "ok" },
    { category: "email-dns", label: "Email & DNS", lost: 12, status: "ok" },
    { category: "certificate", label: "Certificate (HTTPS)", lost: 0, status: "ok" },
    { category: "software", label: "Server software", lost: 0, status: "ok" },
    { category: "web-settings", label: "Website security settings", lost: 0, status: "unavailable" },
];

const finding = (id, overrides = {}) => ({
    id,
    title: `Title ${id}`,
    severity: "high",
    kind: "issue",
    category: "ports",
    checkId: "ports-remote-access",
    source: "Website",
    why: `Why ${id}.`,
    fix: `Fix ${id}.`,
    gain: 0,
    sharedCheck: false,
    ...overrides,
});

const node = (id, overrides = {}) => ({
    id,
    host: `${id}.example.com`,
    ip: "203.0.113.1",
    city: "Singapore",
    country: "Singapore",
    lat: 1.3,
    lng: 103.8,
    located: true,
    status: "healthy",
    service: "HTTPS",
    isCdn: false,
    summary: `Summary ${id}.`,
    ...overrides,
});

// ssh and smtp share the remote access check, archived has no check
const scanWith = (overrides = {}) => ({
    domain: "example.com",
    linkedRepository: null,
    projectId: null,
    role: null,
    score: 50,
    uncappedScore: 56,
    grade: "F",
    cap: { applied: true, checkIds: ["ports-database-telnet"] },
    summary: "Some problems need fixing.",
    incomplete: false,
    stats: [],
    arcs: [],
    nodes: [node("web", { status: "critical" }), node("mail", { status: "attention", service: "SMTP" })],
    checks,
    breakdown,
    findings: [
        finding("mongodb", { severity: "critical", checkId: "ports-database-telnet", nodeId: "web", hosts: ["web"], gain: 29 }),
        finding("ssh", { nodeId: "web", hosts: ["web"], sharedCheck: true }),
        finding("smtp", { nodeId: "mail", hosts: ["mail"], sharedCheck: true }),
        finding("dns", { severity: "medium", category: "email-dns", checkId: "email-spoofing" }),
        finding("archived", { severity: "low", kind: "recommendation", category: "repo-basics", checkId: null, source: "Repository" }),
    ],
    ...overrides,
});

const showOverview = (result, query = "") => {
    useSearchParams.mockReturnValue(new URLSearchParams(query));
    useScan.mockReturnValue({ result, lines: [] });
    render(<OverviewTab />);
}

const findingsCard = _ => screen.getByRole("heading", { name: "Findings · worst first" }).closest("section");
const scoreCard = _ => screen.getByRole("heading", { name: "Exposure score" }).closest("section");
const findingTitles = _ => [...findingsCard().querySelectorAll("li > button > strong")].map(title => title.textContent);
const serverDetails = _ => screen.getByRole("region", { name: "Server details" });
// A tab's first line is its label, the rest is the summary
const tabs = _ => within(screen.getByRole("group", { name: "Choose a card" })).getAllByRole("button");
const tabLabel = tab => tab.firstChild.textContent;
const tab = label => tabs().find(item => tabLabel(item) === label);
const activeCard = _ => tabLabel(tabs().find(item => item.getAttribute("aria-current") === "true"));
const layoutButton = name => within(screen.getByRole("group", { name: "Overview layout" })).getByRole("button", { name });
const planBox = title => screen.getByRole("checkbox", { name: `Plan to fix: Title ${title}` });
const estimate = _ => screen.getByText(/^Your real score is still/).textContent;

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe("Overview layout toggle", () => {
    test("starts as a carousel", () => {
        showOverview(scanWith());

        expect(layoutButton("Carousel").getAttribute("aria-pressed")).toBe("true");
        expect(screen.getByRole("region", { name: "Overview cards" })).toBeTruthy();
        expect(activeCard()).toBe("Score");
    });

    test("Grid shows the grid and is remembered", () => {
        showOverview(scanWith());

        fireEvent.click(layoutButton("Grid"));

        expect(layoutButton("Grid").getAttribute("aria-pressed")).toBe("true");
        expect(screen.queryByRole("region", { name: "Overview cards" })).toBeNull();
        expect(findingsCard()).toBeTruthy();
        expect(localStorage.getItem(LAYOUT_KEY)).toBe("grid");
    });

    test("opens on the grid when it was picked before", () => {
        localStorage.setItem(LAYOUT_KEY, "grid");
        showOverview(scanWith());

        expect(layoutButton("Grid").getAttribute("aria-pressed")).toBe("true");
        expect(screen.queryByRole("region", { name: "Overview cards" })).toBeNull();
    });

    test("the toggle sits in the carousel's tab row, and there's no hint line", () => {
        showOverview(scanWith());

        expect(within(screen.getByRole("region", { name: "Overview cards" })).getByRole("group", { name: "Overview layout" })).toBeTruthy();
        expect(screen.queryByText(/Click a side card/)).toBeNull();
    });

    test("blocked storage falls back to the carousel and the toggle still works", () => {
        vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
            throw new Error("blocked");
        });
        vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
            throw new Error("blocked");
        });
        showOverview(scanWith());

        expect(layoutButton("Carousel").getAttribute("aria-pressed")).toBe("true");

        fireEvent.click(layoutButton("Grid"));

        expect(layoutButton("Grid").getAttribute("aria-pressed")).toBe("true");
    });

    test("the grid shows the toggle on its own, with every card usable", () => {
        localStorage.setItem(LAYOUT_KEY, "grid");
        showOverview(scanWith());

        expect(screen.queryByRole("group", { name: "Choose a card" })).toBeNull();
        expect(screen.queryByRole("button", { name: "Next card" })).toBeNull();
        expect(screen.getByRole("group", { name: "Overview layout" }).parentElement.children).toHaveLength(1);
        expect(document.querySelectorAll("[inert], [data-slide]")).toHaveLength(0);
        expect(screen.getByRole("heading", { name: "Where your servers are" })).toBeTruthy();
    });

    test("only the carousel makes the score card wide", () => {
        showOverview(scanWith());

        expect(scoreCard().classList.contains(styles.scoreWide)).toBe(true);

        fireEvent.click(layoutButton("Grid"));

        expect(scoreCard().classList.contains(styles.scoreWide)).toBe(false);
        expect(scoreCard().classList.contains(styles.scoreCard)).toBe(true);
    });

    test("going to the grid and back keeps the card that was in front", () => {
        showOverview(scanWith());

        fireEvent.click(tab("Score"));
        fireEvent.click(layoutButton("Grid"));
        fireEvent.click(layoutButton("Carousel"));

        expect(activeCard()).toBe("Score");
        expect(localStorage.getItem(LAYOUT_KEY)).toBe("carousel");
    });
});

describe("Overview carousel cards", () => {
    test("a Report Card link starts on the findings", () => {
        showOverview(scanWith(), "finding=dns");

        expect(activeCard()).toBe("Findings");
        expect(screen.getByText("Why dns.")).toBeTruthy();
    });

    test("an unknown finding in the link starts on the first card", () => {
        showOverview(scanWith(), "finding=nope");

        expect(activeCard()).toBe("Score");
    });

    test("the cruz:overview-card event brings a card to the front", () => {
        showOverview(scanWith());

        act(() => {
            window.dispatchEvent(new CustomEvent("cruz:overview-card", { detail: "score" }));
        });

        expect(activeCard()).toBe("Score");
    });

    test("a repo-only scan has a Repository card instead of the map", () => {
        showOverview(scanWith({
            domain: null,
            linkedRepository: "owner/repo",
            nodes: [],
            repo: { records: { repo: { name: "repo", defaultBranch: "main", pushedAt: "2026-10-01", stars: 3, url: "https://github.com/owner/repo" } } },
        }));

        expect(tabs().map(tabLabel)).toEqual(["Score", "Repository", "Findings"]);
        expect(tab("Repository").textContent).toBe("Repositoryrepo0 checks");
    });

    test("See on map picks the finding's server and turns to the map", () => {
        showOverview(scanWith(), "finding=dns");

        // Opening ssh last selects the web server, so See on map has to switch it back
        fireEvent.click(screen.getByText("Title smtp").closest("button"));
        fireEvent.click(screen.getByText("Title ssh").closest("button"));
        expect(within(serverDetails()).getByText("web.example.com")).toBeTruthy();

        const item = screen.getByText("Title smtp").closest("li");
        fireEvent.click(within(item).getByRole("button", { name: "See on map" }));

        expect(activeCard()).toBe("Servers");
        expect(within(serverDetails()).getByText("mail.example.com")).toBeTruthy();
    });
});

describe("Overview carousel tabs", () => {
    test("Servers counts the servers and the critical ones", () => {
        showOverview(scanWith());

        expect(within(tab("Servers")).getByText("2 servers")).toBeTruthy();
        expect(within(tab("Servers")).getByText("1 critical").className).toContain("text-critical");
    });

    test("Servers says when every server is healthy", () => {
        showOverview(scanWith({ nodes: [node("web")] }));

        expect(within(tab("Servers")).getByText("1 server")).toBeTruthy();
        expect(within(tab("Servers")).getByText("All healthy")).toBeTruthy();
    });

    test("Score shows the score and grade, or Incomplete", () => {
        showOverview(scanWith());

        expect(within(tab("Score")).getByText("50")).toBeTruthy();
        expect(within(tab("Score")).getByText("Grade F")).toBeTruthy();

        cleanup();
        showOverview(scanWith({ incomplete: true, grade: null }));

        expect(within(tab("Score")).getByText("Incomplete")).toBeTruthy();
    });

    test("Score shows the estimate while a fix is planned", () => {
        showOverview(scanWith());

        fireEvent.click(planBox("mongodb"));

        expect(tab("Score").textContent).toBe("Score50 →to 79CGrade C");
        expect(within(tab("Score")).getByText("Grade C")).toBeTruthy();
    });

    test("Findings counts them and the worst ones", () => {
        showOverview(scanWith());

        expect(within(tab("Findings")).getByText("5 findings")).toBeTruthy();
        expect(within(tab("Findings")).getByText("1 critical")).toBeTruthy();
    });

    test("Servers says how many need attention when none are critical", () => {
        showOverview(scanWith({ nodes: [node("web"), node("mail", { status: "attention" }), node("api", { status: "attention" })] }));

        expect(within(tab("Servers")).getByText("3 servers")).toBeTruthy();
        expect(within(tab("Servers")).getByText("2 need attention").className).toContain("text-warm");

        cleanup();
        showOverview(scanWith({ nodes: [node("web"), node("mail", { status: "attention" })] }));

        expect(within(tab("Servers")).getByText("1 needs attention")).toBeTruthy();
    });

    test("a website with no servers and a repo gets four tabs", () => {
        showOverview(scanWith({
            linkedRepository: "owner/repo",
            nodes: [],
            checks: [...checks, check("repo-secrets", "secrets", "critical", 10, 10)],
            repo: { records: { repo: { name: "repo", defaultBranch: "main", pushedAt: "2026-10-01", stars: 3, url: "https://github.com/owner/repo" } } },
        }));

        expect(tabs().map(tabLabel)).toEqual(["Score", "Servers", "Repository", "Findings"]);
        expect(tab("Servers").textContent).toBe("Servers0 servers");
        expect(tab("Repository").textContent).toBe("Repositoryrepo1 check");
        expect(screen.getByRole("group", { name: "Choose a card" }).className).toContain("md:grid-cols-4");

        fireEvent.click(screen.getByRole("button", { name: "Previous card" }));

        expect(activeCard()).toBe("Findings");
    });

    test("Findings says when there are none", () => {
        showOverview(scanWith({ findings: [] }));

        expect(tab("Findings").textContent).toBe("FindingsNo findings");
    });

    test("Findings names the worst severity when nothing is critical", () => {
        showOverview(scanWith({ findings: [finding("ssh"), finding("dns", { severity: "medium" }), finding("smtp")] }));

        expect(within(tab("Findings")).getByText("3 findings")).toBeTruthy();
        expect(within(tab("Findings")).getByText("2 high").className).toContain("text-warm");
    });

    test("an incomplete scan shows no grade on the Score tab", () => {
        showOverview(scanWith({ incomplete: true, grade: null }));

        expect(within(tab("Score")).queryByText(/^Grade /)).toBeNull();
        expect(within(tab("Score")).getByText("Incomplete").className).toContain("text-warm");
    });

    test("Score goes back to the real score after Reset", () => {
        showOverview(scanWith());
        const before = tab("Score").textContent;

        fireEvent.click(planBox("mongodb"));
        fireEvent.click(within(scoreCard()).getByRole("button", { name: "Reset" }));

        expect(tab("Score").textContent).toBe(before);
        expect(within(tab("Score")).getByText("Grade F")).toBeTruthy();
        expect(within(tab("Score")).queryByText("→")).toBeNull();
    });

    test("clicking a tab brings its card to the front", () => {
        showOverview(scanWith());

        fireEvent.click(tab("Score"));

        expect(activeCard()).toBe("Score");
        expect(scoreCard().closest("[data-slide]").hasAttribute("inert")).toBe(false);
        expect(findingsCard().closest("[data-slide]").hasAttribute("inert")).toBe(true);
    });
});

describe("Overview score breakdown filter", () => {
    test("a category with findings shows only those findings", () => {
        showOverview(scanWith());

        const row = screen.getByRole("button", { name: "Show the 3 findings in Open ports" });
        fireEvent.click(row);

        expect(row.getAttribute("aria-pressed")).toBe("true");
        expect(findingTitles()).toEqual(["Title mongodb", "Title ssh", "Title smtp"]);
        expect(within(findingsCard()).getByText(/Showing findings for/).textContent).toBe("Showing findings for Open ports · Show all");
        expect(activeCard()).toBe("Findings");
    });

    test("categories with no findings aren't buttons", () => {
        showOverview(scanWith());

        expect(screen.getByRole("button", { name: "Show the 1 finding in Email & DNS" })).toBeTruthy();
        expect(screen.queryByRole("button", { name: /in Certificate/ })).toBeNull();
    });

    test("Show all and a second click both clear the category", () => {
        showOverview(scanWith());
        const row = screen.getByRole("button", { name: "Show the 1 finding in Email & DNS" });

        fireEvent.click(row);
        expect(findingTitles()).toEqual(["Title dns"]);

        fireEvent.click(within(findingsCard()).getByRole("button", { name: "Show all" }));
        expect(findingTitles()).toHaveLength(5);

        fireEvent.click(row);
        fireEvent.click(row);
        expect(findingTitles()).toHaveLength(5);
        expect(row.getAttribute("aria-pressed")).toBe("false");
    });

    test("a server filter replaces the category filter", () => {
        showOverview(scanWith());

        fireEvent.click(screen.getByRole("button", { name: "Show the 1 finding in Email & DNS" }));
        fireEvent.click(within(screen.getByRole("group", { name: "Servers" })).getByRole("button", { name: /mail\.example\.com/ }));
        fireEvent.click(within(serverDetails()).getByRole("button", { name: "Show only these" }));

        expect(findingTitles()).toEqual(["Title smtp"]);

        // Clearing the server filter shows everything, not the old category
        fireEvent.click(within(serverDetails()).getByRole("button", { name: "Show all" }));

        expect(findingTitles()).toHaveLength(5);
        expect(screen.getByRole("button", { name: "Show the 1 finding in Email & DNS" }).getAttribute("aria-pressed")).toBe("false");
    });

    test("a category replaces the server filter", () => {
        showOverview(scanWith());

        fireEvent.click(within(serverDetails()).getByRole("button", { name: "Show only these" }));
        fireEvent.click(screen.getByRole("button", { name: "Show the 1 finding in Email & DNS" }));

        expect(findingTitles()).toEqual(["Title dns"]);
        expect(within(serverDetails()).queryByText(/Showing only these/)).toBeNull();
    });
});

describe("Overview what if simulator", () => {
    test("only findings that can raise the score get a Plan to fix box", () => {
        showOverview(scanWith());

        expect(screen.getAllByRole("checkbox").map(box => box.getAttribute("aria-label"))).toEqual([
            "Plan to fix: Title mongodb",
            "Plan to fix: Title ssh",
            "Plan to fix: Title smtp",
            "Plan to fix: Title dns",
        ]);
    });

    test("shows the hint until something is planned, and Go to findings turns to them", () => {
        showOverview(scanWith());

        expect(within(scoreCard()).getByText(/Want to see your score go up\?/)).toBeTruthy();

        fireEvent.click(within(scoreCard()).getByRole("button", { name: "Go to findings" }));

        expect(activeCard()).toBe("Findings");
    });

    test("planning the critical fix shows the estimate without the cap", () => {
        showOverview(scanWith());

        fireEvent.click(planBox("mongodb"));

        // 337.5 out of 425 is 79
        expect(screen.getByText("Plan: 1 fix")).toBeTruthy();
        expect(screen.getByText("Estimate if you fix 1 planned finding")).toBeTruthy();
        expect(estimate()).toBe("Your real score is still 50. Fixing it would take it to 79, grade C. Re-scan after fixing to see it for real.");
        expect(within(scoreCard()).getByText("No longer capped at 50.")).toBeTruthy();
        expect(screen.getByText(/^If you fix/).textContent).toBe("If you fix 1 finding, your score would go from 50 to 79, grade C.");
        expect(screen.getByRole("img", { name: "Estimate: 79 out of 100, now 50" })).toBeTruthy();
        expect(within(scoreCard()).queryByText(/Want to see your score go up\?/)).toBeNull();
    });

    test("a fix that isn't the critical one says it's still capped", () => {
        showOverview(scanWith());

        fireEvent.click(planBox("dns"));

        expect(estimate()).toContain("would take it to 50, grade F");
        expect(within(scoreCard()).getByText("Still capped at 50 until every critical problem is fixed.")).toBeTruthy();
    });

    test("one finding on a shared check asks for the related ones too", () => {
        showOverview(scanWith());
        const note = /Tick the related findings too/;

        fireEvent.click(planBox("ssh"));

        expect(screen.getByText(note)).toBeTruthy();

        fireEvent.click(planBox("smtp"));

        expect(screen.queryByText(note)).toBeNull();
        expect(screen.getByText("Plan: 2 fixes")).toBeTruthy();
        expect(screen.getByText("Estimate if you fix 2 planned findings")).toBeTruthy();
    });

    test("planning the critical and shared fixes adds up", () => {
        showOverview(scanWith());

        fireEvent.click(planBox("mongodb"));
        fireEvent.click(planBox("ssh"));
        fireEvent.click(planBox("smtp"));

        // 375 out of 425 is 88
        expect(estimate()).toContain("would take it to 88, grade B");
    });

    test("See on score card turns to the score", () => {
        showOverview(scanWith(), "finding=dns");

        fireEvent.click(planBox("mongodb"));
        fireEvent.click(screen.getByRole("button", { name: "See on score card" }));

        expect(activeCard()).toBe("Score");
    });

    test("Reset and Clear empty the plan", () => {
        showOverview(scanWith());

        fireEvent.click(planBox("mongodb"));
        fireEvent.click(within(scoreCard()).getByRole("button", { name: "Reset" }));

        expect(screen.queryByText(/^Plan:/)).toBeNull();
        expect(planBox("mongodb").checked).toBe(false);

        fireEvent.click(planBox("dns"));
        fireEvent.click(within(findingsCard()).getByRole("button", { name: "Clear" }));

        expect(screen.queryByText(/^Estimate if you fix/)).toBeNull();
        expect(planBox("dns").checked).toBe(false);
    });

    test("unticking the last finding hides the estimate", () => {
        showOverview(scanWith());

        fireEvent.click(planBox("mongodb"));
        fireEvent.click(planBox("mongodb"));

        expect(screen.queryByText(/^Plan:/)).toBeNull();
        expect(screen.getByRole("img", { name: "50 out of 100" })).toBeTruthy();
    });

    test("an incomplete scan has no plan", () => {
        showOverview(scanWith({ incomplete: true, grade: null }));

        expect(screen.queryAllByRole("checkbox")).toEqual([]);
        expect(screen.queryByText(/Want to see your score go up\?/)).toBeNull();
    });

    test("an old scan with no checks has no plan", () => {
        showOverview(scanWith({ checks: [], breakdown: [] }));

        expect(screen.queryAllByRole("checkbox")).toEqual([]);
        expect(screen.queryByText(/Want to see your score go up\?/)).toBeNull();
    });
});
