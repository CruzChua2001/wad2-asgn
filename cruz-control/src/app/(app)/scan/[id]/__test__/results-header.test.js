import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { useScan } from "../../scan-context";
import ScanResultsLayout from "../layout";

const nav = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => nav, useParams: () => ({ id: "scan-1" }), usePathname: () => "/scan/scan-1/compare" }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/components/auth/auth-provider", () => ({ useAuth: () => ({ status: "authenticated" }) }));
vi.mock("../../scan-context", () => ({ useScan: vi.fn() }));
vi.mock("motion/react", async original => ({ ...await original(), useReducedMotion: () => true }));

beforeEach(() => {
    vi.clearAllMocks();
    useScan.mockReturnValue({
        result: { title: "example.com", domain: "example.com", linkedRepository: "owner/repo", findings: [], scannedAgo: "2 hours ago", projectId: null },
        loadResult: vi.fn(), saveToProject: vi.fn(), startScan: vi.fn(), resetScan: vi.fn(),
    });
});

test("header has no persistent save paragraph, exposes help beside Save and preserves save/re-scan", () => {
    render(<ScanResultsLayout><p>Compare content</p></ScanResultsLayout>);
    expect(screen.queryByText(/Save to project creates a new project/)).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "About saving to a project" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Save to project" }));
    expect(useScan.mock.results[0].value.saveToProject).toHaveBeenCalledWith("scan-1");
    fireEvent.click(screen.getByRole("button", { name: "Re-scan" }));
    expect(useScan.mock.results[0].value.startScan).toHaveBeenCalledWith({ domain: "example.com", githubRepo: "owner/repo", projectId: null, force: true });
    expect(nav.push).toHaveBeenCalledWith("/scan");
    expect(screen.getByRole("navigation", { name: "Scan result sections" }).querySelectorAll("a")).toHaveLength(5);
});

test("project scans and already saved scans do not offer unnecessary save help", () => {
    const state = useScan.getMockImplementation()();
    useScan.mockReturnValue({ ...state, result: { ...state.result, projectId: "p1", role: "viewer" } });
    const view = render(<ScanResultsLayout>Content</ScanResultsLayout>);
    expect(screen.queryByRole("button", { name: "About saving to a project" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Re-scan" })).toBeNull();
    useScan.mockReturnValue({ ...state, savedScanId: "scan-1" });
    view.rerender(<ScanResultsLayout>Content</ScanResultsLayout>);
    expect(screen.getByRole("link", { name: /Saved/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "About saving to a project" })).toBeNull();
});
