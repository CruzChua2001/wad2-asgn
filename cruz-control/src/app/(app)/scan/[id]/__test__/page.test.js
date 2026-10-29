import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { useScan } from "../../scan-context";
import OverviewTab from "../page";

vi.mock("../../scan-context", () => ({ useScan: vi.fn() }));
vi.mock("next/navigation", () => ({ useSearchParams: () => new URLSearchParams() }));
vi.mock("next/link", () => ({
    default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a>,
}));
vi.mock("@/lib/theme-store", () => ({ useTheme: () => ["light"] }));
// The globe and the 2D map have their own tests, so here they're an empty box
vi.mock("next/dynamic", () => ({
    default: () => function MapStub() {
        return <div data-testid="map" />;
    },
}));
// Reduced motion so numbers and cards show straight away
vi.mock("motion/react", async importOriginal => ({
    ...await importOriginal(),
    useReducedMotion: () => true,
}));

// jsdom has no IntersectionObserver, which the number tickers use to start once they're on screen
vi.stubGlobal("IntersectionObserver", class {
    observe() {}
    unobserve() {}
    disconnect() {}
});

// jsdom doesn't scroll, but "Show only these" scrolls the findings into view
Element.prototype.scrollIntoView = () => {};

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

// web has the worst finding, mail has one, edge is a CDN server with none
const scanWith = (overrides = {}) => ({
    domain: "example.com",
    linkedRepository: null,
    projectId: null,
    role: null,
    score: 60,
    grade: "D",
    summary: "Some problems need fixing.",
    incomplete: false,
    stats: [],
    arcs: [],
    nodes: [
        node("web", { status: "critical" }),
        node("mail", { status: "attention", service: "SMTP" }),
        node("edge", { isCdn: true }),
    ],
    findings: [
        finding("dns", { severity: "medium", category: "email-dns", checkId: "email-spoofing" }),
        finding("smtp", { nodeId: "mail", hosts: ["mail"] }),
        finding("mongodb", { severity: "critical", nodeId: "web", hosts: ["web"], checkId: "ports-database-telnet" }),
    ],
    ...overrides,
});

const showOverview = (result, lines = []) => {
    useScan.mockReturnValue({ result, lines });
    render(<OverviewTab />);
}

const findingsCard = _ => screen.getByRole("heading", { name: "Findings · worst first" }).closest("section");
const findingTitles = _ => [...findingsCard().querySelectorAll("li > button > strong")].map(title => title.textContent);
const findingButton = id => screen.getByText(`Title ${id}`).closest("button");
const serverButton = host => within(screen.getByRole("group", { name: "Servers" })).getByRole("button", { name: new RegExp(host) });
const serverDetails = _ => screen.getByRole("region", { name: "Server details" });

beforeEach(() => {
    vi.clearAllMocks();
});

describe("Overview findings", () => {
    test("lists findings worst first", () => {
        showOverview(scanWith());

        expect(findingTitles()).toEqual(["Title mongodb", "Title smtp", "Title dns"]);
    });

    test("shows how many points a fix is worth", () => {
        showOverview(scanWith({ findings: [finding("ssh", { gain: 3 })] }));

        expect(screen.getByLabelText("Fixing this adds 3 points to your score").textContent).toBe("↑ +3 pts");
    });

    test("says up to when other findings share the points", () => {
        showOverview(scanWith({ findings: [finding("ssh", { gain: 3, sharedCheck: true })] }));

        expect(screen.getByLabelText("Fixing this adds up to 3 points to your score").textContent).toBe("↑ up to +3 pts");
    });

    test("hides the points when the fix is worth nothing or has no check", () => {
        showOverview(scanWith({
            findings: [
                finding("ssh", { gain: 0 }),
                finding("repo-archived", { checkId: null, gain: 4 }),
            ],
        }));

        expect(screen.queryByLabelText(/Fixing this adds/)).toBeNull();
    });

    test("hides the points when the scan is incomplete", () => {
        showOverview(scanWith({ incomplete: true, findings: [finding("ssh", { gain: 3 })] }));

        expect(screen.queryByLabelText(/Fixing this adds/)).toBeNull();
    });

    test("clicking a finding opens it and clicking again closes it", () => {
        showOverview(scanWith());

        expect(screen.queryByText("Why dns.")).toBeNull();

        fireEvent.click(findingButton("dns"));
        const item = findingButton("dns").closest("li");

        expect(within(item).getByText("Why dns.")).toBeTruthy();
        expect(within(item).getByText("What to do:")).toBeTruthy();
        expect(item.textContent).toContain("Fix dns.");

        fireEvent.click(findingButton("dns"));

        expect(screen.queryByText("Why dns.")).toBeNull();
    });

    test("several findings can be open at once", () => {
        showOverview(scanWith());

        // The worst finding starts open
        fireEvent.click(findingButton("dns"));

        expect(screen.getByText("Why mongodb.")).toBeTruthy();
        expect(screen.getByText("Why dns.")).toBeTruthy();
        expect(findingButton("mongodb").getAttribute("aria-expanded")).toBe("true");
        expect(findingButton("dns").getAttribute("aria-expanded")).toBe("true");
    });

    test("Expand all opens every finding and Collapse all closes them", () => {
        showOverview(scanWith());

        fireEvent.click(screen.getByRole("button", { name: "Expand all" }));

        expect(["mongodb", "smtp", "dns"].every(id => screen.queryByText(`Why ${id}.`))).toBe(true);

        fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));

        expect(["mongodb", "smtp", "dns"].some(id => screen.queryByText(`Why ${id}.`))).toBe(false);
        expect(screen.getByRole("button", { name: "Expand all" })).toBeTruthy();
    });

    test("says where each finding is, with no stray dot", () => {
        showOverview(scanWith({
            linkedRepository: "owner/repo",
            findings: [
                finding("smtp", { nodeId: "mail", hosts: ["mail"] }),
                finding("dns", { severity: "medium" }),
                finding("secrets", { severity: "low", source: "Repository" }),
            ],
        }));

        expect(findingButton("smtp").querySelector("small").textContent).toBe("mail.example.com · Website");
        expect(findingButton("dns").querySelector("small").textContent).toBe("example.com · Website");
        expect(findingButton("secrets").querySelector("small").textContent).toBe("owner/repo · Repository");
    });

    test("leaves out the dot when there's nothing to name", () => {
        showOverview(scanWith({ findings: [finding("secrets", { source: "Repository" })] }));

        expect(findingButton("secrets").querySelector("small").textContent).toBe("Repository");
    });

    test("learn more opens in a new tab", () => {
        showOverview(scanWith({
            findings: [finding("ssh", { learnMore: { label: "OWASP guide", url: "https://owasp.org/guide" } })],
        }));
        const link = screen.getByRole("link", { name: /OWASP guide/ });

        expect(link.getAttribute("href")).toBe("https://owasp.org/guide");
        expect(link.getAttribute("target")).toBe("_blank");
        expect(link.getAttribute("rel")).toBe("noreferrer");
    });

    test("technical details link CVE IDs to NVD and GHSA IDs to OSV", () => {
        showOverview(scanWith({
            findings: [finding("dep-lodash", {
                details: { package: "lodash", version: "4.17.20", vulns: ["CVE-2021-23337", "GHSA-35jh-r3h4-6jhm"] },
            })],
        }));

        fireEvent.click(screen.getByRole("button", { name: /Technical details/ }));

        expect(screen.getByRole("link", { name: "CVE-2021-23337" }).getAttribute("href"))
            .toBe("https://nvd.nist.gov/vuln/detail/CVE-2021-23337");
        expect(screen.getByRole("link", { name: "GHSA-35jh-r3h4-6jhm" }).getAttribute("href"))
            .toBe("https://osv.dev/vulnerability/GHSA-35jh-r3h4-6jhm");
    });
});

describe("Overview Show only these", () => {
    test("filters the findings to one server and Show all brings them back", () => {
        showOverview(scanWith());

        fireEvent.click(serverButton("mail.example.com"));
        fireEvent.click(within(serverDetails()).getByRole("button", { name: "Show only these" }));

        expect(findingTitles()).toEqual(["Title smtp"]);
        expect(screen.getByText(/Showing findings for/).textContent).toContain("mail.example.com");

        fireEvent.click(screen.getByRole("button", { name: "Show all" }));

        expect(findingTitles()).toEqual(["Title mongodb", "Title smtp", "Title dns"]);
        expect(screen.queryByText(/Showing findings for/)).toBeNull();
    });
});

describe("Overview Server details", () => {
    test("shows the server's own fix even after Collapse all", () => {
        showOverview(scanWith());

        fireEvent.click(screen.getByRole("button", { name: "Expand all" }));
        fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));

        expect(within(serverDetails()).getByText("Fix mongodb.")).toBeTruthy();
        expect(within(serverDetails()).queryByText("No issues were listed for this server.")).toBeNull();
    });

    test("says there are no issues only for a server with no findings", () => {
        showOverview(scanWith());

        fireEvent.click(serverButton("edge.example.com"));

        expect(within(serverDetails()).getByText("No issues were listed for this server.")).toBeTruthy();
        expect(within(serverDetails()).queryByText(/on this server/)).toBeNull();

        fireEvent.click(serverButton("mail.example.com"));

        expect(within(serverDetails()).queryByText("No issues were listed for this server.")).toBeNull();
        expect(within(serverDetails()).getByText("Fix smtp.")).toBeTruthy();
    });

    test("a CDN server shows the CDN badge in the server list", () => {
        showOverview(scanWith());

        expect(within(serverButton("edge.example.com")).getByText("CDN")).toBeTruthy();
        expect(within(serverButton("web.example.com")).queryByText("CDN")).toBeNull();
    });
});

describe("Overview scan logs", () => {
    test("with no lines, opening the logs shows an empty list", () => {
        showOverview(scanWith());
        const bar = screen.getByRole("button", { name: /Scan logs/ });

        expect(bar.getAttribute("aria-expanded")).toBe("false");

        fireEvent.click(bar);

        expect(bar.getAttribute("aria-expanded")).toBe("true");
        expect(document.getElementById("scan-log").children.length).toBe(0);
    });

    test("with lines, opening the logs lists them", () => {
        showOverview(scanWith(), [
            { id: 1, kind: "info", time: "10:00:01", text: "Looking up DNS" },
            { id: 2, kind: "info", time: "10:00:04", text: "Scan finished" },
        ]);

        fireEvent.click(screen.getByRole("button", { name: /Scan logs/ }));
        const log = document.getElementById("scan-log");

        expect(within(log).getAllByRole("listitem").map(item => item.textContent))
            .toEqual(["10:00:01Looking up DNS", "10:00:04Scan finished"]);
    });
});
