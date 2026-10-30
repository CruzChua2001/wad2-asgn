import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { useState } from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import ServerTour, { TOUR_STEP_MS, tourOrder } from "../server-tour";

const node = (id, overrides = {}) => ({
    id,
    host: `${id}.example.com`,
    city: "Berlin",
    country: "Germany",
    org: "Hetzner",
    located: true,
    status: "healthy",
    ...overrides,
});

const nodes = [
    node("www", { host: "example.com" }),
    node("mail", { status: "attention", city: "Paris", country: "France", org: "OVH" }),
    node("db", { status: "critical", city: "Frankfurt" }),
    node("lost", { located: false, status: "critical" }),
    node("api"),
];

const findings = [
    { id: "port-22", severity: "high", title: "Remote login is open", hosts: ["db"] },
    { id: "cve-exploited", severity: "critical", title: "Software with a known attack", hosts: ["db"] },
    { id: "dns-dmarc", severity: "medium", title: "No DMARC record" },
    { id: "port-25", severity: "low", title: "Mail port is open", hosts: ["mail"] },
];

// Keeps the tour state like the page does
const Tour = ({ onSelect, list = nodes, reduceMotion = false }) => {
    const [tour, setTour] = useState("off");
    return (
        <>
            <ServerTour nodes={list} findings={findings} mainHost="example.com" onSelect={onSelect} reduceMotion={reduceMotion} tour={tour} onTourChange={setTour} />
            <p data-testid="state">{tour}</p>
        </>
    );
}

const showTour = (props = {}) => {
    const onSelect = vi.fn();
    render(<Tour onSelect={onSelect} {...props} />);
    return onSelect;
}

const startTour = _ => fireEvent.click(screen.getByRole("button", { name: "Tour my servers" }));
const caption = _ => screen.queryByRole("group", { name: "Server tour" });
const waitStep = _ => act(() => vi.advanceTimersByTime(TOUR_STEP_MS));
const selected = onSelect => onSelect.mock.calls.map(call => call[0]);

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
});

describe("tourOrder", () => {
    test("puts the worst servers first and the main site first among equals", () => {
        expect(tourOrder(nodes, "example.com").map(item => item.id)).toEqual(["db", "mail", "www", "api"]);
    });

    test("leaves out servers with no location", () => {
        expect(tourOrder(nodes).map(item => item.id)).not.toContain("lost");
    });
});

describe("ServerTour", () => {
    test("hides the button with fewer than 2 located servers", () => {
        showTour({ list: [nodes[0], nodes[3]] });

        expect(screen.queryByRole("button", { name: "Tour my servers" })).toBeNull();
    });

    test("starts on the worst server and shows its caption", () => {
        const onSelect = showTour();
        startTour();

        expect(selected(onSelect)).toEqual(["db"]);
        expect(caption().textContent).toContain("1 of 4");
        expect(caption().textContent).toContain("db.example.com");
        expect(caption().textContent).toContain("Frankfurt, Germany · Hetzner");
        expect(caption().textContent).toContain("Critical");
        // The worst finding on the server, not the first one
        expect(caption().textContent).toContain("Software with a known attack");
        expect(screen.queryByRole("button", { name: "Tour my servers" })).toBeNull();
    });

    test("says when a server has no findings", () => {
        showTour();
        startTour();
        waitStep();
        waitStep();

        expect(caption().textContent).toContain("3 of 4");
        expect(caption().textContent).toContain("example.com");
        expect(caption().textContent).toContain("No issues found on this server");
    });

    test("moves to the next server every step", () => {
        const onSelect = showTour();
        startTour();

        act(() => vi.advanceTimersByTime(TOUR_STEP_MS - 1));
        expect(selected(onSelect)).toEqual(["db"]);

        act(() => vi.advanceTimersByTime(1));
        expect(selected(onSelect)).toEqual(["db", "mail"]);
        expect(caption().textContent).toContain("2 of 4");
        expect(caption().textContent).toContain("Mail port is open");

        waitStep();
        expect(selected(onSelect)).toEqual(["db", "mail", "www"]);
    });

    test("Pause stops it moving and Resume starts it again", () => {
        const onSelect = showTour();
        startTour();

        fireEvent.click(screen.getByRole("button", { name: "Pause tour" }));
        waitStep();
        waitStep();
        expect(selected(onSelect)).toEqual(["db"]);

        fireEvent.click(screen.getByRole("button", { name: "Resume tour" }));
        waitStep();
        expect(selected(onSelect)).toEqual(["db", "mail"]);
    });

    test("Next skips to the next server and restarts the step", () => {
        const onSelect = showTour();
        startTour();

        act(() => vi.advanceTimersByTime(TOUR_STEP_MS / 2));
        fireEvent.click(screen.getByRole("button", { name: "Next server" }));
        expect(selected(onSelect)).toEqual(["db", "mail"]);

        act(() => vi.advanceTimersByTime(TOUR_STEP_MS / 2));
        expect(selected(onSelect)).toEqual(["db", "mail"]);
    });

    test("Stop hides the caption and brings the button back", () => {
        showTour();
        startTour();

        fireEvent.click(screen.getByRole("button", { name: "Stop tour" }));

        expect(caption()).toBeNull();
        expect(screen.getByTestId("state").textContent).toBe("off");
        expect(screen.getByRole("button", { name: "Tour my servers" })).toBeTruthy();
    });

    test("ends by itself after the last server", () => {
        const onSelect = showTour();
        startTour();

        for (let i = 0; i < 4; i++) waitStep();

        expect(selected(onSelect)).toEqual(["db", "mail", "www", "api"]);
        expect(caption()).toBeNull();
        expect(screen.getByTestId("state").textContent).toBe("off");
    });

    test("restarts from the worst server", () => {
        const onSelect = showTour();
        startTour();
        waitStep();
        fireEvent.click(screen.getByRole("button", { name: "Stop tour" }));
        startTour();

        expect(selected(onSelect)).toEqual(["db", "mail", "db"]);
        expect(caption().textContent).toContain("1 of 4");
    });

    test("shows a progress bar while playing", () => {
        showTour();
        startTour();

        expect(screen.getByTestId("tour-progress")).toBeTruthy();

        fireEvent.click(screen.getByRole("button", { name: "Pause tour" }));
        expect(screen.queryByTestId("tour-progress")).toBeNull();
    });

    test("with reduced motion it doesn't move by itself", () => {
        const onSelect = showTour({ reduceMotion: true });
        startTour();

        waitStep();
        waitStep();
        expect(selected(onSelect)).toEqual(["db"]);
        expect(screen.queryByRole("button", { name: "Pause tour" })).toBeNull();
        expect(screen.queryByTestId("tour-progress")).toBeNull();

        fireEvent.click(screen.getByRole("button", { name: "Next server" }));
        expect(selected(onSelect)).toEqual(["db", "mail"]);
        expect(caption().textContent).toContain("2 of 4");
    });

    test("the caption is a polite live region and gets focus", () => {
        showTour();
        startTour();

        expect(caption().querySelector("[aria-live='polite']").textContent).toContain("db.example.com");
        expect(document.activeElement).toBe(caption());
    });
});
