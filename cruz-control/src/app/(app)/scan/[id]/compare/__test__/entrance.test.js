import { expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ComparePage from "../page";

const nav = vi.hoisted(() => ({ query: "first=new&against=old", replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useParams: () => ({ id: "new" }), useSearchParams: () => new URLSearchParams(nav.query), useRouter: () => ({ replace: nav.replace }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/components/auth/auth-provider", () => ({ useAuth: () => ({ status: "authenticated", user: { id: "u" } }) }));
vi.mock("../../../scan-context", () => ({ useScan: () => ({ result: { projectId: "p", role: "viewer" } }) }));
vi.mock("@/components/scan-entrance", () => ({ default: ({ as: Tag = "div", enabled = true, delay: _delay, children, ...props }) => <Tag data-entrance={String(enabled)} {...props}>{children}</Tag> }));
vi.mock("@/lib/api", () => {
    const scans = ["new", "old", "oldest"].map((id, index) => ({ id, project_id: "p", created_at: `2026-10-${30 - index}T06:00:00Z`, domain: "example.com", github_repo: null, score: 80 + index, grade: "B", findings: [], checks: [], domain_scans: { domain: "example.com" }, repo_scans: null }));
    return { default: { get: vi.fn(url => Promise.resolve({ data: url.includes("/project/") ? scans : scans.find(scan => scan.id === url.split("/").at(-1)) })) } };
});

test("dropdown changes retain card controls and do not replay results entrance after loading", async () => {
    nav.replace.mockImplementation(url => { nav.query = url.split("?")[1]; });
    const { rerender } = render(<ComparePage />);
    expect((await screen.findByRole("region", { name: "Comparison summary" })).dataset.entrance).toBe("true");
    const card = screen.getByRole("region", { name: "Scan A" });
    const select = screen.getByRole("combobox", { name: "Select scan A" });
    select.focus();
    fireEvent.change(select, { target: { value: "oldest" } });
    rerender(<ComparePage />);
    expect(screen.getByRole("region", { name: "Scan A" })).toBe(card);
    expect(screen.getByRole("combobox", { name: "Select scan A" })).toBe(select);
    expect(document.activeElement).toBe(select);
    expect((await screen.findByRole("region", { name: "Comparison summary" })).dataset.entrance).toBe("false");
    expect(screen.getByRole("region", { name: "Issues" }).dataset.entrance).toBe("false");
    expect(screen.getByRole("region", { name: "Good-practice recommendations" }).dataset.entrance).toBe("false");
});
