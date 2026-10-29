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
    node("web"),
    node("cdn", { isCdn: true, lat: 35.7, lng: 139.7 }),
    node("mail", { status: "attention" }),
    node("lost", { located: false, lat: null, lng: null }),
];

const showGlobe = (props = {}) => render(<ExposureGlobe nodes={nodes} arcs={[]} onSelect={vi.fn()} {...props} />);
const point = id => globe.props.pointsData.find(item => item.id === id);

beforeEach(() => {
    vi.clearAllMocks();
    globe.props = null;
});

describe("Exposure globe points", () => {
    test("only passes located servers as points", () => {
        showGlobe();

        expect(globe.props.pointsData.map(item => item.id)).toEqual(["web", "cdn", "mail"]);
    });

    test("the selected and highlighted servers are bigger and higher", () => {
        showGlobe({ selectedId: "web", highlightIds: ["mail"] });

        for (const id of ["web", "mail"]) {
            expect(globe.props.pointRadius(point(id))).toBe(0.75);
            expect(globe.props.pointAltitude(point(id))).toBe(0.12);
        }
        expect(globe.props.pointRadius(point("cdn"))).toBe(0.55);
        expect(globe.props.pointAltitude(point("cdn"))).toBe(0.06);
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

describe("Exposure globe tooltip", () => {
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
