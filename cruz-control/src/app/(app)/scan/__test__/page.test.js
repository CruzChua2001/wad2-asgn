import { beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ScanPage from "../page";

const startScan = vi.fn();

vi.mock("../scan-context", () => ({ useScan: () => ({ phase: "idle", startScan: startScan }) }));
vi.mock("@/lib/theme-store", () => ({ useTheme: () => ["light"] }));

// jsdom can't scroll, so replace it with a fake
window.scrollTo = vi.fn();
beforeEach(() => vi.clearAllMocks());

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

        const fresh = screen.getByRole("checkbox", { name: "Run a fresh scan" });
        expect(document.getElementById(fresh.getAttribute("aria-describedby")).textContent).toBe("Bypasses cached results from the last 12 hours and checks your targets again.");
        fireEvent.change(screen.getByLabelText("Website or domain"), { target: { value: "example.com" } });
        fireEvent.click(screen.getByText(/Run a fresh scan/));
        fireEvent.click(screen.getByText("Start scan"));

        expect(startScan).toHaveBeenCalledWith({ domain: "example.com", githubRepo: null, force: true });
    });

    it("describes linked checks and requires a valid repository without enabling a fresh scan", () => {
        render(<ScanPage />);
        const start = screen.getByRole("button", { name: "Start scan" });
        expect(start.disabled).toBe(true);
        fireEvent.change(screen.getByLabelText("Website or domain"), { target: { value: "example.com" } });
        expect(start.disabled).toBe(false);

        const link = screen.getByRole("checkbox", { name: "Link a public GitHub repository" });
        expect(document.getElementById(link.getAttribute("aria-describedby")).textContent).toBe("Adds checks for packages, secret file names and project basics.");
        fireEvent.click(link);
        expect(start.disabled).toBe(true);
        fireEvent.click(start);
        expect(startScan).not.toHaveBeenCalled();

        const repository = screen.getByLabelText("GitHub repository");
        fireEvent.change(repository, { target: { value: "https://github.com/owner/repository" } });
        expect(document.getElementById(repository.getAttribute("aria-describedby")).textContent).toContain("Ready to inspect the public repository owner/repository.");
        expect(screen.getByRole("checkbox", { name: "Run a fresh scan" }).checked).toBe(false);
        expect(start.disabled).toBe(false);
        fireEvent.click(start);
        expect(startScan).toHaveBeenCalledExactlyOnceWith({ domain: "example.com", githubRepo: "github.com/owner/repository", force: false });
        expect(screen.getByText("Non-destructive by design")).toBeTruthy();
    });

    it.each([
        ["website", "smu.edu.sg", "Website or domain", "smu.edu.sg", { domain: "smu.edu.sg", githubRepo: null, force: false }],
        ["repository", "juice-shop/juice-shop", "Public repository", "github.com/juice-shop/juice-shop", { githubRepo: "github.com/juice-shop/juice-shop", force: false }],
    ])("the %s example fills the correct field and waits for Start scan", (mode, name, field, value, payload) => {
        render(<ScanPage />);
        if (mode === "repository") fireEvent.click(screen.getByRole("button", { name: /GitHub repository/ }));
        fireEvent.click(screen.getByRole("button", { name: `Use example ${name}` }));
        expect(screen.getByLabelText(field).value).toBe(value);
        expect(startScan).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "Start scan" }));
        expect(startScan).toHaveBeenCalledExactlyOnceWith(payload);
    });
});
