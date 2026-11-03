import { beforeEach, expect, test, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { useScan } from "../../../scan-context";
import ChecklistPage from "../page";

vi.mock("../../../scan-context", () => ({ useScan: vi.fn() }));
vi.mock("next/navigation", () => ({ useParams: () => ({ id: "scan-1" }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a> }));
const check = (id, category, status = "ok") => ({ id, category, status });
const row = title => within(screen.getByText(title).closest("li"));
const cspTitle = "A Content-Security-Policy header is set";
const envTitle = ".env is in .gitignore";
beforeEach(() => { useScan.mockReturnValue({ result: { findings: [], checks: [] } }); });

test("loading, manual ticks and bulk controls show honest progress without changing scanner failures", () => {
    useScan.mockReturnValue({ result: null });
    const view = render(<ChecklistPage />);
    expect(screen.getByText("Loading...")).toBeTruthy();
    useScan.mockReturnValue({ result: {
        checks: [check("cert-validity", "certificate"), check("web-headers", "web-settings")],
        findings: [{ id: "web-csp", category: "web-settings", kind: "issue", title: "Missing CSP" }],
    } });
    view.rerender(<ChecklistPage />);
    expect(screen.getByText("1 of 13 done")).toBeTruthy();
    expect(row("The site has a valid HTTPS certificate").getByRole("img", { name: "Passed" })).toBeTruthy();
    expect(row(cspTitle).getByRole("img", { name: "Not passing" })).toBeTruthy();
    expect(row(cspTitle).queryByRole("checkbox")).toBeNull();
    expect(row(cspTitle).getByRole("link").getAttribute("href")).toBe("/scan/scan-1/fix-guide");
    const manual = screen.getByRole("checkbox", { name: 'Mark "Database rules require a login" as done' });
    fireEvent.click(manual);
    expect(manual.getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText("2 of 13 done")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Select all" }));
    expect(screen.getByText("12 of 13 done")).toBeTruthy();
    expect(row(cspTitle).getByRole("img", { name: "Not passing" })).toBeTruthy();
    expect(row(envTitle).getByText("NOT SCANNED")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Deselect all" }));
    expect(screen.getByText("1 of 13 done")).toBeTruthy();
});

test.each(["unavailable", "not_checked", undefined])("a completed HTTPS check cannot prove the separate CSP check passed: %s", status => {
    useScan.mockReturnValue({ result: { findings: [], checks: [check("web-https-hsts", "web-settings"), ...(status ? [check("web-headers", "web-settings", status)] : [])] } });
    render(<ChecklistPage />);
    expect(row(cspTitle).queryByRole("img", { name: "Passed" })).toBeNull();
    expect(row(cspTitle).getByText("NOT SCANNED")).toBeTruthy();
    expect(row("Visitors who type http:// are sent to https://").getByRole("img", { name: "Passed" })).toBeTruthy();
});

test("the .env item stays unknown until both relevant checks succeed", () => {
    useScan.mockReturnValue({ result: { findings: [], checks: [check("secrets-files", "secrets")] } });
    render(<ChecklistPage />);
    expect(row(envTitle).getByText("NOT SCANNED")).toBeTruthy();
    expect(row(envTitle).queryByRole("img", { name: "Passed" })).toBeNull();
});

test("aggregated finding details cannot become a false pass when all relevant checks succeeded", () => {
    useScan.mockReturnValue({ result: {
        checks: [check("secrets-files", "secrets"), check("ignore-rules", "ignore-rules")],
        findings: [{ id: "repo-gitignore", category: "ignore-rules", checkId: "ignore-rules", kind: "issue", title: "Your .gitignore misses some risky files", details: { missing: [".env", "node_modules"] } }],
    } });
    render(<ChecklistPage />);
    expect(row(envTitle).queryByRole("img", { name: "Passed" })).toBeNull();
    expect(row(envTitle).getByRole("img", { name: "Not passing" })).toBeTruthy();
    expect(row("node_modules is in .gitignore").getByRole("img", { name: "Not passing" })).toBeTruthy();
});

test("lockfile recommendations count as failures; a successful sibling check is not lockfile coverage", () => {
    useScan.mockReturnValue({ result: { findings: [], checks: [check("basics-dependabot", "repo-basics")] } });
    const view = render(<ChecklistPage />);
    const title = "A lockfile (package-lock.json) is committed";
    expect(row(title).getByText("NOT SCANNED")).toBeTruthy();
    useScan.mockReturnValue({ result: { findings: [{ id: "repo-lockfile", category: "repo-basics", kind: "recommendation", title: "No lockfile is committed" }], checks: [check("basics-lockfile", "repo-basics")] } });
    view.rerender(<ChecklistPage />);
    expect(row(title).getByRole("img", { name: "Not passing" })).toBeTruthy();
});
