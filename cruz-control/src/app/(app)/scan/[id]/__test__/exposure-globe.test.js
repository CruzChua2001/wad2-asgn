import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ExposureGlobe from "../exposure-globe";

// What the fake globe was last given, and the ref methods the component calls
const globe = vi.hoisted(() => ({
    props: null,
    controls: {},
    pointOfView: vi.fn(() => ({ lat: 0, lng: 0, altitude: 2 })),
}));

// jsdom has no WebGL, so the globe only records its props
vi.mock("react-globe.gl", async () => {
    const { forwardRef, useImperativeHandle } = await import("react");
    return {
        default: forwardRef(function FakeGlobe(props, ref) {
            useImperativeHandle(ref, () => ({
                controls: () => globe.controls,
                pointOfView: globe.pointOfView,
            }));
            globe.props = props;
            return <div data-testid="globe" />;
        }),
    };
});

// The globe only renders once its container has a size
vi.stubGlobal("ResizeObserver", class {
    constructor(callback) {
        this.callback = callback;
    }
    observe() {
        this.callback([{ contentRect: { width: 400, height: 300 } }]);
    }
    disconnect() {}
});

// The country outlines never arrive, so nothing updates after the test
vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));

const node = (id, overrides = {}) => ({
    id,
    host: `${id}.example.com`,
    city: "Singapore",
    country: "Singapore",
    lat: 1.3,
    lng: 103.8,
    located: true,
    status: "healthy",
    isCdn: false,
    ...overrides,
});

const nodes = [
    node("web", { service: "80, 443" }),
    node("cdn", { isCdn: true, lat: 35.7, lng: 139.7, service: "443" }),
    node("mail", { status: "attention", service: "None found" }),
    node("lost", { located: false, lat: null, lng: null }),
];

const showGlobe = (props = {}) => render(<ExposureGlobe nodes={nodes} arcs={[]} onSelect={vi.fn()} {...props} />);
// Each server is a column plus a faint halo under it
const point = id => globe.props.pointsData.find(item => item.id === id && !item.halo);
const halo = id => globe.props.pointsData.find(item => item.id === id && item.halo);

beforeEach(() => {
    vi.clearAllMocks();
    globe.props = null;
});

describe("Exposure globe points", () => {
    test("only passes located servers as points", () => {
        showGlobe();

        const columns = globe.props.pointsData.filter(item => !item.halo);
        const halos = globe.props.pointsData.filter(item => item.halo);

        expect(columns.map(item => item.id)).toEqual(["web", "cdn", "mail"]);
        expect(halos.map(item => item.id)).toEqual(["web", "cdn", "mail"]);
    });

    test("the selected and highlighted servers are thicker", () => {
        showGlobe({ selectedId: "web", highlightIds: ["mail"] });

        for (const id of ["web", "mail"]) {
            expect(globe.props.pointRadius(point(id))).toBe(0.8);
            expect(globe.props.pointRadius(halo(id))).toBe(2.1);
        }
        expect(globe.props.pointRadius(point("cdn"))).toBe(0.5);
        expect(globe.props.pointRadius(halo("cdn"))).toBe(1.5);
    });

    test("columns get taller with more open ports", () => {
        showGlobe({
            nodes: [
                node("none", { service: "None found" }),
                node("one", { service: "22" }),
                node("three", { service: "22, 80, 443" }),
                node("list", { ports: [21, 22, 25, 53, 80, 110, 143, 443, 3306, 8080] }),
            ],
        });

        const height = id => globe.props.pointAltitude(point(id));

        expect(height("none")).toBeCloseTo(0.03);
        expect(height("one")).toBeCloseTo(0.06);
        expect(height("three")).toBeGreaterThan(height("one"));
        // 8 or more ports is as tall as it gets
        expect(height("list")).toBeCloseTo(0.27);
    });

    test("the halo sits flat on the ground", () => {
        showGlobe();

        expect(globe.props.pointAltitude(halo("web"))).toBe(0.004);
    });

    test("columns are coloured by status, halos are see-through", () => {
        showGlobe({ nodes: [node("ok"), node("warn", { status: "attention" }), node("bad", { status: "critical" })] });

        expect(globe.props.pointColor(point("ok"))).toBe("#24917a");
        expect(globe.props.pointColor(point("warn"))).toBe("#d9822b");
        expect(globe.props.pointColor(point("bad"))).toBe("#de4655");
        expect(globe.props.pointColor(halo("bad"))).toBe("rgba(222, 70, 85, 0.25)");
    });

    test("uses the dark colours in dark mode", () => {
        showGlobe({ theme: "dark", nodes: [node("bad", { status: "critical" })] });

        expect(globe.props.pointColor(point("bad"))).toBe("#ff6b7a");
    });

    test("servers in dimIds are faded, the rest keep their colour", () => {
        showGlobe({ nodes: [node("ok"), node("bad", { status: "critical" })], dimIds: ["bad"] });

        expect(globe.props.pointColor(point("bad"))).toBe("rgba(222, 70, 85, 0.18)");
        expect(globe.props.pointColor(halo("bad"))).toBe("rgba(222, 70, 85, 0.06)");
        expect(globe.props.pointColor(point("ok"))).toBe("#24917a");
        // Faded columns keep their height
        expect(globe.props.pointAltitude(point("bad"))).toBe(globe.props.pointAltitude(point("ok")));
        // A faded critical server stops pulsing
        expect(globe.props.ringsData.map(item => item.id)).toEqual([]);
    });

    test("the selected server is never faded", () => {
        showGlobe({ nodes: [node("bad", { status: "critical" })], dimIds: ["bad"], selectedId: "bad" });

        expect(globe.props.pointColor(point("bad"))).toBe("#de4655");
    });

    test("arcs to faded servers are faded too", () => {
        const main = node("main");
        const bad = node("bad", { status: "critical", lat: 35.7, lng: 139.7 });
        const ok = node("ok", { lat: 51, lng: 0 });
        const arcs = [
            { id: "bad", from: main, to: bad, status: "critical" },
            { id: "ok", from: main, to: ok, status: "healthy" },
        ];
        showGlobe({ nodes: [main, bad, ok], arcs, dimIds: ["bad"] });

        expect(globe.props.arcColor(arcs[0])).toEqual(["rgba(36, 145, 122, 0.09)", "rgba(222, 70, 85, 0.18)"]);
        expect(globe.props.arcColor(arcs[1])).toEqual(["rgba(36, 145, 122, 0.55)", "rgba(36, 145, 122, 0.9)"]);
    });

    test("columns grow in, unless motion is reduced", () => {
        const { unmount } = showGlobe();
        expect(globe.props.pointsTransitionDuration).toBe(1200);
        unmount();

        showGlobe({ reduceMotion: true });
        expect(globe.props.pointsTransitionDuration).toBe(0);
    });

    test("clicking a point selects that server", () => {
        const onSelect = vi.fn();
        showGlobe({ onSelect });

        globe.props.onPointClick(point("cdn"));

        expect(onSelect).toHaveBeenCalledWith("cdn");
    });

    test("selecting a server flies to it", () => {
        // The globe mounts after the first render, so select once it's there
        const { rerender } = showGlobe();
        rerender(<ExposureGlobe nodes={nodes} arcs={[]} onSelect={vi.fn()} selectedId="cdn" />);

        expect(globe.pointOfView).toHaveBeenCalledWith({ lat: 35.7, lng: 139.7, altitude: 1.9 }, 1100);
    });
});

describe("Exposure globe glow and land", () => {
    test("the glow follows the grade", () => {
        const glow = grade => {
            showGlobe({ grade });
            return globe.props.atmosphereColor;
        };

        expect(glow("A")).toBe("#7fae9d");
        expect(glow("B")).toBe("#7fae9d");
        expect(glow("C")).toBe("#d9a066");
        expect(glow("D")).toBe("#d9a066");
        expect(glow("F")).toBe("#d9707a");
        // An incomplete scan has no grade
        expect(glow(null)).toBe("#b5ad9f");
    });

    test("the glow uses the dark colours in dark mode", () => {
        showGlobe({ grade: "F", theme: "dark" });

        expect(globe.props.atmosphereColor).toBe("#a3434e");
    });

    test("countries with a server take the colour of their worst server", () => {
        showGlobe({
            nodes: [
                node("a", { country: "Singapore" }),
                node("b", { country: "Singapore", status: "critical" }),
                node("c", { country: "The Netherlands", status: "attention" }),
                node("d", { country: "United States" }),
            ],
        });

        const land = (ADMIN, NAME_LONG = ADMIN) => globe.props.hexPolygonColor({ properties: { ADMIN, NAME_LONG } });

        expect(land("Singapore")).toBe("rgba(222, 70, 85, 0.9)");
        expect(land("Netherlands")).toBe("rgba(217, 130, 43, 0.9)");
        expect(land("United States of America", "United States")).toBe("rgba(36, 145, 122, 0.9)");
        expect(land("France")).toBe("rgba(42, 110, 96, 0.55)");
    });
});

describe("Exposure globe tooltip", () => {
    test("says how many ports are open", () => {
        showGlobe({
            nodes: [
                node("none", { service: "None found" }),
                node("one", { service: "22" }),
                node("two", { service: "80, 443" }),
                node("many", { service: "21, 22, 25, 53, 80, 110..." }),
            ],
        });

        expect(globe.props.pointLabel(point("none"))).toContain("0 open ports");
        expect(globe.props.pointLabel(point("one"))).toContain("1 open port<");
        expect(globe.props.pointLabel(point("two"))).toContain("2 open ports");
        // The list is cut at 6, so there are at least 7
        expect(globe.props.pointLabel(point("many"))).toContain("7+ open ports");
    });

    test("tags a CDN server", () => {
        showGlobe();

        expect(globe.props.pointLabel(point("cdn"))).toContain("CDN");
        expect(globe.props.pointLabel(point("web"))).not.toContain("CDN");
    });

    test("escapes the host name", () => {
        showGlobe({ nodes: [node("bad", { host: "<img>" })] });

        const label = globe.props.pointLabel(point("bad"));

        expect(label).toContain("&lt;img&gt;");
        expect(label).not.toContain("<img>");
    });
});

describe("Exposure globe zoom", () => {
    test("has zoom in and zoom out buttons", () => {
        showGlobe();

        expect(screen.getByRole("button", { name: "Zoom in" })).toBeTruthy();
        expect(screen.getByRole("button", { name: "Zoom out" })).toBeTruthy();
    });

    test("zoom in moves the camera closer", () => {
        showGlobe();

        fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));

        expect(globe.pointOfView).toHaveBeenLastCalledWith({ lat: 0, lng: 0, altitude: 1.5 }, 450);
    });
});
