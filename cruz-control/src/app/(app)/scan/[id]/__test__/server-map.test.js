import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ServerMap, { countrySummary } from "../server-map";

// The map only renders once its container has a size
vi.stubGlobal("ResizeObserver", class {
    constructor(callback) {
        this.callback = callback;
    }
    observe() {
        this.callback([{ contentRect: { width: 400, height: 300 } }]);
    }
    disconnect() {}
});

// Three square "countries" instead of the real outline file
const square = (name, lng, lat) => ({
    type: "Feature",
    properties: { ADMIN: name, NAME_LONG: name, ADM0_A3: name.slice(0, 3).toUpperCase() },
    geometry: { type: "Polygon", coordinates: [[[lng, lat], [lng, lat + 4], [lng + 4, lat + 4], [lng + 4, lat], [lng, lat]]] },
});

const geojson = { features: [square("Germany", 8, 48), square("France", 0, 44), square("Spain", -6, 38)] };

vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(geojson) })));

const node = (id, overrides = {}) => ({
    id,
    host: `${id}.example.com`,
    city: "Berlin",
    country: "Germany",
    lat: 50,
    lng: 10,
    located: true,
    status: "healthy",
    isCdn: false,
    ...overrides,
});

const main = node("main");
const nodes = [
    main,
    node("db", { status: "critical", city: "Frankfurt", lat: 51, lng: 11 }),
    node("paris", { city: "Paris", country: "France", lat: 46, lng: 2 }),
    node("tokyo", { city: "Tokyo", country: "Japan", lat: 35.7, lng: 139.7 }),
    node("lost", { located: false, lat: null, lng: null }),
];

const arcs = [
    { id: "paris", from: main, to: nodes[2], status: "healthy" },
    { id: "tokyo", from: main, to: nodes[3], status: "healthy" },
    { id: "lost", from: main, to: nodes[4], status: "healthy" },
];

const showMap = (props = {}) => render(<ServerMap nodes={nodes} arcs={arcs} onSelect={vi.fn()} {...props} />);

describe("Server map routes", () => {
    test("draws one route and one travelling packet per located arc", () => {
        const { container } = showMap();

        expect(container.querySelectorAll('path[id^="map-arc-"]')).toHaveLength(2);
        expect(container.querySelectorAll("animateMotion")).toHaveLength(2);
        expect(container.querySelectorAll("linearGradient")).toHaveLength(2);
    });

    test("reduced motion keeps the routes but stops them moving", () => {
        const { container } = showMap({ reduceMotion: true });

        expect(container.querySelectorAll('path[stroke^="url(#map-route-"]')).toHaveLength(2);
        expect(container.querySelectorAll("animateMotion")).toHaveLength(0);
        expect(container.querySelectorAll('path[id^="map-arc-"]')).toHaveLength(0);
    });
});

describe("Server map status filter", () => {
    const dot = (container, id) => container.querySelector(`g[data-node="${id}"]`);

    test("servers in dimIds are faded, the rest stay as they are", () => {
        const { container } = showMap({ dimIds: ["paris", "tokyo"] });

        expect(dot(container, "paris").getAttribute("opacity")).toBe("0.2");
        expect(dot(container, "tokyo").getAttribute("opacity")).toBe("0.2");
        expect(dot(container, "main").getAttribute("opacity")).toBeNull();
        expect(dot(container, "db").getAttribute("opacity")).toBeNull();
    });

    test("the selected server is never faded", () => {
        const { container } = showMap({ dimIds: ["paris"], selectedId: "paris" });

        expect(dot(container, "paris").getAttribute("opacity")).toBeNull();
    });

    test("routes and packets to faded servers are faded", () => {
        const { container } = showMap({ dimIds: ["paris"] });

        // The packet group takes the route's strength
        const packets = [...container.querySelectorAll("circle")].filter(circle => circle.querySelector("animateMotion"));
        expect(packets.map(circle => circle.parentNode.getAttribute("opacity"))).toEqual(["0.2", "0.85"]);
        expect(container.querySelector('path[id="map-arc-0"]').getAttribute("stroke-opacity")).toBe("0.2");
    });

    test("a faded critical server stops pulsing", () => {
        const { container } = showMap({ dimIds: ["db"] });

        expect(dot(container, "db").querySelector("animate")).toBeNull();
    });
});

describe("Server map countries", () => {
    test("tints each country by its worst server", async () => {
        const { container } = showMap();

        await waitFor(() => expect(container.querySelectorAll('path[class*="var(--critical)"]')).toHaveLength(1));
        // Germany has a critical server, France only a healthy one, Spain none
        const [germany, france, spain] = container.querySelectorAll('path[class*="stroke-surface-strong"]');
        expect(germany.getAttribute("class")).toContain("var(--critical)");
        expect(france.getAttribute("class")).toContain("fill-accent-soft");
        expect(spain.getAttribute("class")).toContain("fill-line");
    });

    test("hovering a country shows how many servers it has", async () => {
        const { container } = showMap();

        await waitFor(() => expect(container.querySelector('path[class*="var(--critical)"]')).toBeTruthy());
        fireEvent.pointerEnter(container.querySelector('path[class*="var(--critical)"]'));

        expect(screen.getByText("Germany")).toBeTruthy();
        expect(screen.getByText("2 servers · 1 critical")).toBeTruthy();
    });

    test("the country summary uses real plurals", () => {
        expect(countrySummary({ servers: 1, critical: 0, attention: 0 })).toBe("1 server · healthy");
        expect(countrySummary({ servers: 3, critical: 0, attention: 0 })).toBe("3 servers · all healthy");
        expect(countrySummary({ servers: 3, critical: 2, attention: 1 })).toBe("3 servers · 2 critical · 1 needs attention");
        expect(countrySummary({ servers: 2, critical: 0, attention: 2 })).toBe("2 servers · 2 need attention");
    });
});
