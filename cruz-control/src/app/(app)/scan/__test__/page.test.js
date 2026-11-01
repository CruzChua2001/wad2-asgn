import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ScanPage from "../page";

const startScan = vi.fn();

vi.mock("../scan-context", () => ({ useScan: () => ({ phase: "idle", startScan: startScan }) }));
vi.mock("@/lib/theme-store", () => ({ useTheme: () => ["light"] }));

// jsdom can't scroll, so replace it with a fake
window.scrollTo = vi.fn();

describe("Scan page", () => {
    it("switches to repository mode", () => {
        render(<ScanPage />);

        fireEvent.click(screen.getByText("GitHub repository"));

        expect(screen.getByLabelText("Public repository")).toBeTruthy();
    });

    it("starts a scan with the entered domain", () => {
        render(<ScanPage />);

        fireEvent.change(screen.getByLabelText("Website or domain"), { target: { value: "example.com" } });
        fireEvent.click(screen.getByText("Start scan"));

        expect(startScan).toHaveBeenCalledWith({ domain: "example.com", githubRepo: null, force: false });
    });

    it("sends force when Run a fresh scan is ticked", () => {
        render(<ScanPage />);

        fireEvent.change(screen.getByLabelText("Website or domain"), { target: { value: "example.com" } });
        fireEvent.click(screen.getByText(/Run a fresh scan/));
        fireEvent.click(screen.getByText("Start scan"));

        expect(startScan).toHaveBeenCalledWith({ domain: "example.com", githubRepo: null, force: true });
    });
});
