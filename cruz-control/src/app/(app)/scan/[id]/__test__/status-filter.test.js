import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent, act } from "@testing-library/react";
import { useSearchParams } from "next/navigation";
import { useScan } from "../../scan-context";
import OverviewTab from "../page";

// The globe and the map share this stub, so it keeps the props each one was last given
const maps = vi.hoisted(() => ({ globe: null, map: null }));

vi.mock("../../scan-context", () => ({ useScan: vi.fn() }));
vi.mock("next/navigation", () => ({ useSearchParams: vi.fn() }));
vi.mock("@/lib/theme-store", () => ({ useTheme: () => ["light"] }));
vi.mock("next/dynamic", () => ({
    default: () => function MapStub(props) {
        // Only the globe gets a theme
        if (props.theme) maps.globe = props;
        else maps.map = props;
        return <canvas data-testid="map" />;
    },
}));
// Reduced motion, so the tour only moves with Next
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

const node = (id, overrides = {}) => ({
    id,
    host: `${id}.example.com`,
    ip: id,
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

const finding = (id, host, severity = "high") => ({
    id, title: `Title ${id}`, severity, category: "ports", source: "Website", why: "Why.", fix: `Fix ${id}.`, hosts: [host], nodeId: host,
});

const baseResult = {
    domain: "example.com",
    linkedRepository: null,
    projectId: null,
    role: null,
    score: 70,
    grade: "C",
    summary: "Some problems need fixing.",
    incomplete: false,
    stats: [],
    arcs: [],
    checks: [],
    breakdown: [],
    // No server needs attention, so that legend item is disabled
    nodes: [
        node("web"),
        node("db", { status: "critical", city: "Tokyo", country: "Japan" }),
        node("api"),
        node("cache", { status: "critical" }),
        node("mail"),
    ],
    findings: [
        finding("port-3306", "db", "critical"),
        finding("port-6379", "cache", "critical"),
        finding("port-22", "web"),
        finding("port-25", "mail"),
    ],
};

const showOverview = (result = baseResult) => {
    localStorage.setItem(LAYOUT_KEY, "grid");
    useSearchParams.mockReturnValue(new URLSearchParams(""));
    useScan.mockReturnValue({ result, lines: [] });
    render(<OverviewTab />);
}

const legend = _ => within(screen.getByRole("group", { name: "Filter servers by status" }));
const legendButton = name => legend().getByRole("button", { name: new RegExp(`^${name}`) });
const serverList = _ => within(screen.getByRole("group", { name: "Servers" }));
// Server buttons are toggles, the Show all button isn't
const listedHosts = _ => serverList().getAllByRole("button")
    .filter(button => button.hasAttribute("aria-pressed"))
    .map(button => button.querySelector("strong").textContent);
const serverDetails = _ => screen.getByRole("region", { name: "Server details" });
const openFindings = _ => screen.getByRole("region", { name: /Findings/ }).querySelectorAll('[aria-expanded="true"]');

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    maps.globe = null;
    maps.map = null;
});

describe("Status legend filter", () => {
    test("each status is a toggle button with its count", () => {
        showOverview();

        expect(legendButton("Healthy").textContent).toBe("Healthy 3");
        expect(legendButton("Critical").textContent).toBe("Critical 2");

        fireEvent.click(legendButton("Critical"));
        expect(legendButton("Critical").getAttribute("aria-pressed")).toBe("true");
        expect(legendButton("Healthy").getAttribute("aria-pressed")).toBe("false");

        // Clicking it again clears the filter
        fireEvent.click(legendButton("Critical"));
        expect(legendButton("Critical").getAttribute("aria-pressed")).toBe("false");
    });

    test("a status with no servers can't be picked", () => {
        showOverview();

        const attention = legendButton("Attention");
        expect(attention.disabled).toBe(true);

        fireEvent.click(attention);
        expect(attention.getAttribute("aria-pressed")).toBe("false");
        expect(legend().queryByRole("button", { name: "Show all" })).toBeNull();
    });

    test("the server list only shows matching servers", () => {
        showOverview();

        fireEvent.click(legendButton("Healthy"));

        expect(listedHosts()).toEqual(["web.example.com", "api.example.com", "mail.example.com"]);
    });

    test("Show all clears the filter", () => {
        showOverview();

        fireEvent.click(legendButton("Critical"));
        expect(listedHosts()).toHaveLength(2);

        fireEvent.click(legend().getByRole("button", { name: "Show all" }));

        expect(listedHosts()).toHaveLength(5);
        expect(legendButton("Critical").getAttribute("aria-pressed")).toBe("false");
        expect(legend().queryByRole("button", { name: "Show all" })).toBeNull();
    });

    test("keeps the selected server when it matches, otherwise picks the first match", () => {
        showOverview();
        // The worst finding is on db, so db starts selected
        expect(serverDetails().textContent).toContain("db.example.com");

        fireEvent.click(legendButton("Critical"));
        expect(serverDetails().textContent).toContain("db.example.com");

        fireEvent.click(legendButton("Healthy"));
        expect(serverDetails().textContent).toContain("web.example.com");
        expect(serverList().getByRole("button", { name: /web\.example\.com/ }).getAttribute("aria-pressed")).toBe("true");
    });

    test("the globe and map are given exactly the servers to fade", () => {
        showOverview();
        expect(maps.globe.dimIds).toEqual([]);

        fireEvent.click(legendButton("Critical"));
        expect(maps.globe.dimIds).toEqual(["web", "api", "mail"]);

        fireEvent.click(within(screen.getByRole("group", { name: "Map view" })).getByRole("button", { name: "Map" }));
        expect(maps.map.dimIds).toEqual(["web", "api", "mail"]);
    });

    test("doesn't change the findings filter or the highlight", () => {
        showOverview();

        fireEvent.click(legendButton("Healthy"));

        expect(screen.queryByText(/Showing findings for/)).toBeNull();
        expect(screen.getByRole("region", { name: /Findings/ }).querySelectorAll("li")).toHaveLength(4);
        // web's finding is selected now, so the highlight follows it as before
        expect(maps.globe.highlightIds).toEqual(["web"]);
    });

    test("the Show all servers button counts the filtered list", () => {
        const nodes = [
            ...Array.from({ length: 7 }, (_, index) => node(`ok${index}`)),
            node("bad", { status: "critical" }),
        ];
        showOverview({ ...baseResult, nodes, findings: [] });

        expect(serverList().getByRole("button", { name: "Show all 8 servers" })).toBeTruthy();

        fireEvent.click(legendButton("Healthy"));
        expect(serverList().getByRole("button", { name: "Show all 7 servers" })).toBeTruthy();
        expect(listedHosts()).toHaveLength(6);

        // One critical server, so there's nothing more to show
        fireEvent.click(legendButton("Critical"));
        expect(serverList().queryByRole("button", { name: /Show all/ })).toBeNull();
    });

    test("changing the filter stops the tour, which then only visits matching servers", () => {
        showOverview();
        fireEvent.click(screen.getByRole("button", { name: "Tour my servers" }));
        expect(screen.getByRole("group", { name: "Server tour" })).toBeTruthy();

        fireEvent.click(legendButton("Healthy"));
        expect(screen.queryByRole("group", { name: "Server tour" })).toBeNull();

        fireEvent.click(screen.getByRole("button", { name: "Tour my servers" }));
        expect(screen.getByRole("group", { name: "Server tour" }).textContent).toContain("of 3");
    });

    test("clicking a faded dot brings every server back", () => {
        showOverview();
        fireEvent.click(legendButton("Critical"));

        act(() => maps.globe.onSelect("mail"));

        expect(legendButton("Critical").getAttribute("aria-pressed")).toBe("false");
        expect(serverDetails().textContent).toContain("mail.example.com");
    });
});

describe("Tour my servers and the findings card", () => {
    test("touring moves Server details but doesn't open findings", () => {
        showOverview();
        // Only the worst finding starts open
        expect(openFindings()).toHaveLength(1);

        fireEvent.click(screen.getByRole("button", { name: "Tour my servers" }));
        // db, then cache, then web
        fireEvent.click(screen.getByRole("button", { name: "Next server" }));
        fireEvent.click(screen.getByRole("button", { name: "Next server" }));

        expect(serverDetails().textContent).toContain("web.example.com");
        expect(openFindings()).toHaveLength(1);
        // The fix still follows the server the tour is on
        expect(serverDetails().textContent).toContain("Fix port-22.");
    });

    test("clicking a server in the list still opens its finding", () => {
        showOverview();

        fireEvent.click(serverList().getByRole("button", { name: /mail\.example\.com/ }));

        expect(openFindings()).toHaveLength(2);
    });
});
