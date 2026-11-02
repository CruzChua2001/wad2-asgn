import { beforeEach, expect, test, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import api from "@/lib/api";
import { useScan } from "../../../scan-context";
import FixGuidePage from "../page";

vi.mock("../../../scan-context", () => ({ useScan: vi.fn() }));
vi.mock("next/navigation", () => ({ useParams: () => ({ id: "scan-1" }) }));
vi.mock("@/components/auth/auth-provider", () => ({ useAuth: () => ({ status: "authenticated" }) }));
vi.mock("@/lib/api", () => ({ default: { post: vi.fn() } }));
vi.mock("@/components/small-loader", () => ({ default: ({ text }) => <span role="status">{text}</span> }));

const finding = (id, severity, kind = "issue") => ({ id, severity, kind, title: `Finding ${id}`, why: `Why ${id} matters`, fix: `Fix ${id}` });
beforeEach(() => {
    vi.clearAllMocks();
    useScan.mockReturnValue({ result: { findings: [finding("low", "low"), finding("tip", "high", "recommendation"), finding("critical", "critical")] } });
});

test("loading and empty scans have useful states without requesting AI", () => {
    useScan.mockReturnValue({ result: null });
    const view = render(<FixGuidePage />);
    expect(screen.getByText("Loading...")).toBeTruthy();
    useScan.mockReturnValue({ result: { findings: [] } });
    view.rerender(<FixGuidePage />);
    expect(screen.getByText("No problems to fix. Nice work!")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Fixed all" })).toBeNull();
    expect(api.post).not.toHaveBeenCalled();
});

test("orders issues by severity, keeps recommendations separate, expands and collapses real items", () => {
    render(<FixGuidePage />);
    const problems = within(screen.getByRole("region", { name: "Problems to fix" }));
    expect(problems.getAllByRole("checkbox").map(box => box.getAttribute("aria-label"))).toEqual(['Mark "Finding critical" as fixed', 'Mark "Finding low" as fixed']);
    expect(within(screen.getByRole("region", { name: "Good practice (optional)" })).getByText("Finding tip")).toBeTruthy();
    const toggle = problems.getByRole("button", { name: /^Finding critical\s*Critical$/ });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("Why critical matters")).toBeTruthy();
    expect(screen.getByText("Fix critical")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));
    expect(screen.queryByText("Why critical matters")).toBeNull();
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
});

test("manual issue ticks and bulk actions update progress; optional tips do not count as fixed issues", () => {
    render(<FixGuidePage />);
    fireEvent.click(screen.getByRole("checkbox", { name: 'Mark "Finding tip" as fixed' }));
    expect(screen.getByText("0 of 2 fixed")).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: 'Mark "Finding critical" as fixed' }));
    expect(screen.getByText("1 of 2 fixed")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Fixed all" }));
    expect(screen.getByText("2 of 2 fixed")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Fixed all" }).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Deselect all" }));
    expect(screen.getByText("0 of 2 fixed")).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: 'Mark "Finding tip" as fixed' }).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText(/run a new scan to check your fixes/)).toBeTruthy();
});
