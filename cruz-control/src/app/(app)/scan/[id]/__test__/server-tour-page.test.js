import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { useSearchParams } from "next/navigation";
import { useScan } from "../../scan-context";
import OverviewTab from "../page";

vi.mock("../../scan-context", () => ({ useScan: vi.fn() }));
vi.mock("next/navigation", () => ({ useSearchParams: vi.fn() }));
vi.mock("@/lib/theme-store", () => ({ useTheme: () => ["light"] }));
vi.mock("next/dynamic", () => ({
    default: () => function MapStub() {
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

const result = {
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
    nodes: [node("web"), node("db", { status: "critical", city: "Tokyo", country: "Japan" }), node("mail", { status: "attention" })],
    checks: [],
    breakdown: [],
    findings: [
        { id: "port-3306", title: "Database port is open", severity: "critical", category: "ports", source: "Website", why: "Why.", fix: "Close it.", hosts: ["db"], nodeId: "db" },
    ],
};

const showOverview = (layout = "grid") => {
    localStorage.setItem(LAYOUT_KEY, layout);
    useSearchParams.mockReturnValue(new URLSearchParams(""));
    useScan.mockReturnValue({ result, lines: [] });
    render(<OverviewTab />);
}

const startTour = _ => fireEvent.click(screen.getByRole("button", { name: "Tour my servers" }));
const caption = _ => screen.queryByRole("group", { name: "Server tour" });
const serverDetails = _ => screen.getByRole("region", { name: "Server details" });
const serverButton = host => within(screen.getByRole("group", { name: "Servers" })).getByRole("button", { name: new RegExp(host) });

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
});

describe("Tour my servers on the Overview", () => {
    test("starts on the worst server and Next moves Server details along", () => {
        showOverview();
        startTour();

        expect(caption().textContent).toContain("db.example.com");
        expect(serverDetails().textContent).toContain("Tokyo, Japan");

        fireEvent.click(screen.getByRole("button", { name: "Next server" }));
        expect(caption().textContent).toContain("mail.example.com");
        expect(serverDetails().textContent).toContain("mail.example.com");
    });

    test("clicking a server in the list stops the tour", () => {
        showOverview();
        startTour();

        fireEvent.click(serverButton("web.example.com"));

        expect(caption()).toBeNull();
        expect(serverDetails().textContent).toContain("web.example.com");
    });

    test("switching to the Map view stops the tour", () => {
        showOverview();
        startTour();

        fireEvent.click(within(screen.getByRole("group", { name: "Map view" })).getByRole("button", { name: "Map" }));

        expect(caption()).toBeNull();
        expect(screen.queryByRole("button", { name: "Tour my servers" })).toBeNull();
    });

    test("Escape in the map card stops the tour", () => {
        showOverview();
        startTour();

        fireEvent.keyDown(screen.getByRole("button", { name: "Next server" }), { key: "Escape" });

        expect(caption()).toBeNull();
    });

    test("turning the carousel away from the map stops the tour", () => {
        showOverview("carousel");
        const tabs = within(screen.getByRole("group", { name: "Choose a card" }));
        fireEvent.click(tabs.getByRole("button", { name: /^Servers/ }));
        startTour();

        fireEvent.click(tabs.getByRole("button", { name: /^Score/ }));

        expect(caption()).toBeNull();
    });

    test("hides the globe hint while touring", () => {
        showOverview();
        expect(screen.queryByText(/Drag to spin/)).toBeTruthy();

        startTour();
        expect(screen.queryByText(/Drag to spin/)).toBeNull();
    });
});
