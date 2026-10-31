import { beforeEach, expect, test, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import api from "@/lib/api";
import { useAuth } from "@/components/auth/auth-provider";
import { useScan } from "../../../scan-context";
import ComparePage from "../page";
import HistoryPage from "@/app/(app)/project/[projectId]/history/page";

const nav = vi.hoisted(() => ({ query: "", replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useParams: () => ({ id: "new", projectId: "p1" }), useSearchParams: () => new URLSearchParams(nav.query), useRouter: () => ({ replace: nav.replace, push: nav.push }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/lib/api", () => ({ default: { get: vi.fn() } }));
vi.mock("@/components/auth/auth-provider", () => ({ useAuth: vi.fn() }));
vi.mock("../../../scan-context", () => ({ useScan: vi.fn() }));

const summary = (id, day, extra = {}) => ({ id, created_at: `2026-10-${day}T12:00:00Z`, domain: "example.com", github_repo: null, score: 0, grade: null, ...extra });
const histories = [summary("new", 30), summary("old", 28), summary("third", 27)];
const finding = (id, extra = {}) => ({ id, title: id, kind: "issue", severity: "high", checkId: "csp", details: {}, ...extra });
const full = (id, extra = {}) => ({ ...histories.find(scan => scan.id === id), project_id: "p1", domain_scans: { domain: "example.com", created_at: "2026-10-25T12:00:00Z" }, repo_scans: null, checks: [{ id: "csp", status: "ok" }], findings: [], ...extra });
const serve = (scans = histories, overrides = {}) => api.get.mockImplementation(url => {
    if (url === "/api/project/p1/scan") return Promise.resolve({ data: scans });
    const id = url.split("/").at(-1);
    return Promise.resolve({ data: full(id, overrides[id]) });
});
beforeEach(() => {
    vi.resetAllMocks();
    nav.query = "";
    nav.replace.mockImplementation(url => { nav.query = url.split("?")[1]; });
    useAuth.mockReturnValue({ status: "authenticated", user: { id: "u1" } });
    useScan.mockReturnValue({ result: { projectId: "p1", role: "viewer" }, saveToProject: vi.fn() });
});

test("loads history then only selected details, shows ordered scores and cache warning for viewers", async () => {
    serve(histories, { new: { score: 25, grade: "F" } });
    render(<ComparePage />);
    expect(screen.getByRole("status")).toBeTruthy();
    expect(await screen.findByText("+25 points")).toBeTruthy();
    expect(screen.getByRole("region", { name: "Scan B" }).textContent).toContain("Incomplete · No grade");
    expect(screen.getByText(/Shared capture dates for/)).toBeTruthy();
    expect(api.get.mock.calls.map(([url]) => url).sort()).toEqual(["/api/project/p1/scan", "/api/scan/new", "/api/scan/old"].sort());
    expect(screen.queryByRole("button", { name: /Re-scan/ })).toBeNull();
});

test("renders issue statuses separately from recommendations and evidence changes", async () => {
    serve(histories, {
        old: { findings: [finding("gone"), finding("changed"), finding("same")] },
        new: { findings: [finding("changed", { hosts: ["1.2.3.4"] }), finding("same"), finding("new"), finding("tip", { kind: "recommendation", checkId: null })] },
    });
    render(<ComparePage />);
    expect(await screen.findByRole("heading", { name: "Issues 4" })).toBeTruthy();
    for (const label of ["Newly detected (1)", "No longer detected (1)", "Still present (1)", "Still present, evidence changed (1)", "Good-practice recommendations (1)", "Cannot verify change (1)"]) expect(screen.getByRole("heading", { name: label.replace(/ \((\d+)\)/, " $1") })).toBeTruthy();
    expect(screen.getByRole("link", { name: "gone" }).getAttribute("href")).toBe("/scan/old?finding=gone");
    expect(screen.getByText("Compare evidence")).toBeTruthy();
});

test("unknown coverage does not show a resolution", async () => {
    serve(histories, { old: { findings: [finding("not-verified")] }, new: { checks: [{ id: "csp", status: "unavailable" }], incomplete: true } });
    render(<ComparePage />);
    expect(await screen.findByRole("heading", { name: "Cannot verify change 1" })).toBeTruthy();
    expect(screen.queryByText(/No longer detected \(/)).toBeNull();
    expect(screen.getByText(/One or both scans are incomplete/)).toBeTruthy();
});

test("same-scan URL selections are rejected without fetching details", async () => {
    nav.query = "first=new&against=new";
    serve();
    render(<ComparePage />);
    expect((await screen.findByRole("alert")).textContent).toBe("Choose two different scans.");
    expect(api.get).toHaveBeenCalledTimes(1);
});

test("newer A and older B keep their own details and URL positions on refresh", async () => {
    nav.query = "first=old&against=third";
    serve(histories, { third: { score: 11 }, old: { score: 22 } });
    const { unmount } = render(<ComparePage />);
    await screen.findByRole("region", { name: "Comparison summary" });
    expect(nav.replace).not.toHaveBeenCalled();
    const a = within(screen.getByRole("region", { name: "Scan A" }));
    const b = within(screen.getByRole("region", { name: "Scan B" }));
    expect(a.getByRole("combobox").value).toBe("old");
    expect(a.getByText("22")).toBeTruthy();
    expect(a.getByText(/Saved 28 Oct/)).toBeTruthy();
    expect(a.getByText("Later")).toBeTruthy();
    expect(a.getByRole("link").getAttribute("href")).toBe("/scan/old");
    expect(b.getByRole("combobox").value).toBe("third");
    expect(b.getByText("11")).toBeTruthy();
    expect(b.getByText("Earlier")).toBeTruthy();
    expect(b.getByRole("link").getAttribute("href")).toBe("/scan/third");
    unmount();
    render(<ComparePage />);
    await screen.findByRole("region", { name: "Comparison summary" });
    expect(screen.getByRole("combobox", { name: "Select scan A" }).value).toBe("old");
    expect(screen.getByRole("combobox", { name: "Select scan B" }).value).toBe("third");
});

test.each([{ scans: [] }, { scans: [histories[0]] }, { scans: [histories[0], summary("other", 28, { github_repo: "a/b" })] }])("fewer than two matching scans explains the next step: $scans", async ({ scans }) => {
    serve(scans);
    render(<ComparePage />);
    expect(await screen.findByText(scans.length === 1 ? /One scan so far/ : scans.length > 1 ? /No matching scan yet/ : /no longer in the project's history/)).toBeTruthy();
    expect(api.get).toHaveBeenCalledTimes(1);
});

test("a mismatched or deleted ID in the URL is rejected before fetching details", async () => {
    nav.query = "against=deleted";
    serve();
    render(<ComparePage />);
    expect((await screen.findByRole("alert")).textContent).toMatch(/unavailable or has different targets/);
    expect(api.get).toHaveBeenCalledTimes(1);
});

test("history failure supports retry", async () => {
    serve();
    api.get.mockRejectedValueOnce(new Error("offline"));
    render(<ComparePage />);
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("region", { name: "Comparison summary" })).toBeTruthy();
});

test("deleted/forbidden selected scan errors are friendly and retryable", async () => {
    serve();
    const normal = api.get.getMockImplementation();
    api.get.mockImplementation(url => url === "/api/scan/old" ? Promise.reject({ response: { data: { error: "Scan not found." } } }) : normal(url));
    render(<ComparePage />);
    expect((await screen.findByRole("alert")).textContent).toBe("Scan not found.");
    api.get.mockImplementation(normal);
    fireEvent.click(screen.getByRole("button", { name: "Retry comparison" }));
    expect(await screen.findByRole("region", { name: "Comparison summary" })).toBeTruthy();
});

test("full results are checked again for changed targets or project membership", async () => {
    serve(histories, { old: { project_id: "another-project" } });
    render(<ComparePage />);
    expect((await screen.findByRole("alert")).textContent).toMatch(/no longer available in this project/);
});

test("full target mismatch is rejected even if history metadata matched", async () => {
    serve(histories, { old: { domain_scans: { domain: "different.com" } } });
    render(<ComparePage />);
    expect((await screen.findByRole("alert")).textContent).toMatch(/same website and repository targets/);
    expect(screen.queryByRole("region", { name: "Comparison summary" })).toBeNull();
});

test("network failures without an API response use a friendly fallback", async () => {
    serve();
    const normal = api.get.getMockImplementation();
    api.get.mockImplementation(url => url.startsWith("/api/scan/") ? Promise.reject(new Error("offline")) : normal(url));
    render(<ComparePage />);
    expect((await screen.findByRole("alert")).textContent).toMatch(/Could not load the selected scans/);
});

test("different historical targets are excluded from both selectors", async () => {
    serve([...histories, summary("different", 29, { domain: "other.com" })]);
    render(<ComparePage />);
    await screen.findByRole("region", { name: "Comparison summary" });
    const selectors = screen.getAllByRole("combobox");
    expect([...selectors[0].options].map(option => option.value)).toEqual(["new", "old", "third"]);
    expect([...selectors[1].options].map(option => option.value)).toEqual(["new", "old", "third"]);
});

test("logging out clears displayed comparison evidence", async () => {
    serve(histories, { new: { findings: [finding("private-finding")] } });
    const { rerender } = render(<ComparePage />);
    await screen.findByRole("link", { name: "private-finding" });
    useAuth.mockReturnValue({ status: "guest" });
    rerender(<ComparePage />);
    expect(screen.queryByRole("link", { name: "private-finding" })).toBeNull();
});

test("slow previous selection cannot replace the latest pair", async () => {
    let finish;
    serve(histories, { third: { score: 5 }, new: { score: 25 } });
    const normal = api.get.getMockImplementation();
    api.get.mockImplementation(url => url === "/api/scan/old" ? new Promise(resolve => { finish = resolve; }) : normal(url));
    const { rerender } = render(<ComparePage />);
    await screen.findByRole("combobox", { name: "Select scan B" });
    await waitFor(() => expect(finish).toBeTypeOf("function"));
    fireEvent.change(screen.getByRole("combobox", { name: "Select scan B" }), { target: { value: "third" } });
    rerender(<ComparePage />);
    await screen.findByText("+20 points");
    await act(async () => finish({ data: full("old", { score: 24 }) }));
    expect(screen.getByText("+20 points")).toBeTruthy();
    expect(screen.queryByText(/\+1 points/)).toBeNull();
});

test("non-project scans reuse the save action without requests", () => {
    const saveToProject = vi.fn();
    useScan.mockReturnValue({ result: { projectId: null }, saveToProject });
    render(<ComparePage />);
    fireEvent.click(screen.getByRole("button", { name: "Save to project" }));
    expect(saveToProject).toHaveBeenCalledWith("new");
    expect(api.get).not.toHaveBeenCalled();
});

test("guests cannot request project comparison", () => {
    useAuth.mockReturnValue({ status: "guest" });
    render(<ComparePage />);
    expect(screen.getByText(/Log in as a project member/)).toBeTruthy();
    expect(api.get).not.toHaveBeenCalled();
});

test("History and filtered Compare share numbering and carry the exact source scan into A", async () => {
    const allScans = [...histories, summary("other-target", 29, { domain: "other.com" })];
    serve(allScans);
    const historyView = render(<HistoryPage />);
    const link = await screen.findByRole("link", { name: "Compare scans for Scan #2" });
    expect(screen.getByRole("link", { name: "View Scan #2" }).getAttribute("href")).toBe("/scan/old");
    nav.query = link.getAttribute("href").split("?")[1];
    historyView.unmount();
    render(<ComparePage />);
    await screen.findByRole("region", { name: "Comparison summary" });
    const a = within(screen.getByRole("region", { name: "Scan A" }));
    const b = within(screen.getByRole("region", { name: "Scan B" }));
    expect(a.getByText("Scan #2")).toBeTruthy();
    expect(a.getByRole("combobox").value).toBe("old");
    expect(b.getByText("Scan #4")).toBeTruthy();
    expect(b.getByRole("combobox").value).toBe("new");
    expect(a.getByRole("combobox").selectedOptions[0].textContent).toMatch(/^Scan #2/);
    expect([...a.getByRole("combobox").options].map(option => option.textContent.split(" · ")[0])).toEqual(["Scan #4", "Scan #2", "Scan #1"]);
    expect(screen.getByText("Scan #2 is selected as Scan A. Choose another scan to compare.")).toBeTruthy();
    expect(a.getByText("Selected from history")).toBeTruthy();
    expect(b.queryByText("Selected from history")).toBeNull();
});

test("History context survives changing B, clears on changing A, and stays cleared on returning A", async () => {
    nav.query = "first=old&against=new&fromHistory=old";
    serve();
    const { rerender } = render(<ComparePage />);
    await screen.findByRole("region", { name: "Comparison summary" });
    fireEvent.change(screen.getByRole("combobox", { name: "Select scan B" }), { target: { value: "third" } });
    rerender(<ComparePage />);
    await screen.findByRole("region", { name: "Comparison summary" });
    expect(new URLSearchParams(nav.query).get("fromHistory")).toBe("old");
    expect(screen.getByText("Selected from history")).toBeTruthy();
    fireEvent.change(screen.getByRole("combobox", { name: "Select scan A" }), { target: { value: "new" } });
    rerender(<ComparePage />);
    await screen.findByRole("region", { name: "Comparison summary" });
    expect(new URLSearchParams(nav.query).has("fromHistory")).toBe(false);
    expect(screen.queryByText("Selected from history")).toBeNull();
    expect(screen.queryByText(/is selected as Scan A/)).toBeNull();
    fireEvent.change(screen.getByRole("combobox", { name: "Select scan A" }), { target: { value: "old" } });
    rerender(<ComparePage />);
    await screen.findByRole("region", { name: "Comparison summary" });
    expect(screen.queryByText("Selected from history")).toBeNull();
});

test.each(["", "first=new&against=old", "first=new&against=old&fromHistory=third"])("direct visits do not infer a History source from the route scan: %s", async query => {
    nav.query = query;
    serve();
    render(<ComparePage />);
    await screen.findByRole("region", { name: "Comparison summary" });
    expect(screen.queryByText(/is selected as Scan A/)).toBeNull();
    expect(screen.queryByText("Selected from history")).toBeNull();
});

test("one saved scan gives viewers accurate guidance and no owner action", async () => {
    serve([histories[0]]);
    render(<ComparePage />);
    expect(await screen.findByText("You have one scan for this project. Ask a project owner to run another scan so you can compare the results.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Re-scan project" })).toBeNull();
    expect(screen.getByRole("link", { name: "View history" }).getAttribute("href")).toBe("/project/p1/history");
});

test("owners with one scan can re-scan current project settings once, preserving projectId and force", async () => {
    const startScan = vi.fn().mockResolvedValue();
    useScan.mockReturnValue({ result: { projectId: "p1", role: "owner" }, startScan });
    serve([histories[0]]);
    const normal = api.get.getMockImplementation();
    let finish;
    api.get.mockImplementation(url => url === "/api/project" ? new Promise(resolve => { finish = resolve; }) : normal(url));
    render(<ComparePage />);
    expect(await screen.findByText("Ready for your next scan?")).toBeTruthy();
    expect(screen.getByText("You have one scan for this project. Re-scan it to see what's changed.")).toBeTruthy();
    const button = screen.getByRole("button", { name: "Re-scan project" });
    act(() => { fireEvent.click(button); fireEvent.click(button); });
    expect(screen.getByRole("button", { name: "Starting scan..." }).disabled).toBe(true);
    expect(api.get.mock.calls.filter(([url]) => url === "/api/project")).toHaveLength(1);
    await act(async () => finish({ data: [{ id: "p1", role: "owner", domain: "current.example", github_repo: "a/b" }] }));
    expect(startScan).toHaveBeenCalledTimes(1);
    expect(startScan).toHaveBeenCalledWith({ domain: "current.example", githubRepo: "a/b", projectId: "p1", force: true });
    expect(nav.push).toHaveBeenCalledWith("/scan");
});

test("several saved scans with different targets do not claim the project has only one scan", async () => {
    serve([histories[0], summary("other", 29, { domain: "other.com" })]);
    render(<ComparePage />);
    expect(await screen.findByText("This project has 2 saved scans, but none of the others can be compared with this one.")).toBeTruthy();
    expect(screen.queryByText(/You have one scan/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Re-scan project" })).toBeNull();
});

test("missing target information has its own state instead of claiming only one scan", async () => {
    serve([{ ...histories[0], github_repo: undefined }, histories[1]]);
    render(<ComparePage />);
    expect(await screen.findByText("We need more scan information")).toBeTruthy();
    expect(screen.getByText(/missing website or repository information/)).toBeTruthy();
    expect(screen.queryByText(/You have one scan/)).toBeNull();
});

test.each(["network", "permission"])("failed project re-scan startup supports retry: %s", async failure => {
    const startScan = vi.fn().mockResolvedValue();
    useScan.mockReturnValue({ result: { projectId: "p1", role: "owner" }, startScan });
    serve([histories[0]]);
    const normal = api.get.getMockImplementation();
    let attempt = 0;
    api.get.mockImplementation(url => {
        if (url !== "/api/project") return normal(url);
        attempt += 1;
        if (attempt === 1) return failure === "network" ? Promise.reject(new Error("offline")) : Promise.resolve({ data: [{ id: "p1", role: "viewer" }] });
        return Promise.resolve({ data: [{ id: "p1", role: "owner", domain: "example.com", github_repo: null }] });
    });
    render(<ComparePage />);
    fireEvent.click(await screen.findByRole("button", { name: "Re-scan project" }));
    await screen.findByRole("alert");
    expect(startScan).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Re-scan project" }));
    await waitFor(() => expect(startScan).toHaveBeenCalledTimes(1));
});

test("no repository shows not included while a missing website capture date stays unknown", async () => {
    serve(histories, { old: { domain_scans: { domain: "example.com", created_at: null } } });
    render(<ComparePage />);
    await screen.findByRole("region", { name: "Comparison summary" });
    expect(screen.getAllByText(/Repository not included/)).toHaveLength(2);
    expect(screen.getByText(/Website captured: Capture date unknown/)).toBeTruthy();
    expect(screen.queryByText(/Repository captured: Date unknown/)).toBeNull();
    expect(screen.getByText(/Compare two scans to see/)).toBeTruthy();
});

test("both selectors list all compatible scans and disable only the opposite selection", async () => {
    serve();
    const { rerender } = render(<ComparePage />);
    await screen.findByRole("region", { name: "Comparison summary" });
    const a = () => screen.getByRole("combobox", { name: "Select scan A" });
    const b = () => screen.getByRole("combobox", { name: "Select scan B" });
    expect(a().value).toBe("new");
    expect(b().value).toBe("old");
    for (const select of [a(), b()]) expect([...select.options].map(option => option.value)).toEqual(["new", "old", "third"]);
    expect([...a().options].filter(option => option.disabled).map(option => option.value)).toEqual(["old"]);
    expect([...b().options].filter(option => option.disabled).map(option => option.value)).toEqual(["new"]);
    fireEvent.change(a(), { target: { value: "old" } });
    expect(nav.replace).not.toHaveBeenCalled();
    fireEvent.change(b(), { target: { value: "third" } });
    rerender(<ComparePage />);
    await screen.findByRole("region", { name: "Comparison summary" });
    expect(a().value).toBe("new");
    expect(b().value).toBe("third");
    fireEvent.change(a(), { target: { value: "old" } });
    rerender(<ComparePage />);
    await screen.findByRole("region", { name: "Comparison summary" });
    expect(b().value).toBe("third");
    expect(nav.query).toBe("first=old&against=third");
});

test("equal saved dates preserve the URL order and remain distinct selectable scans", async () => {
    nav.query = "first=old&against=new";
    const date = histories[0].created_at;
    serve([histories[0], { ...histories[1], created_at: date }], { old: { created_at: date } });
    render(<ComparePage />);
    await screen.findByRole("region", { name: "Comparison summary" });
    expect(screen.getByRole("combobox", { name: "Select scan A" }).value).toBe("old");
    expect(screen.getByRole("combobox", { name: "Select scan B" }).value).toBe("new");
    expect(nav.replace).not.toHaveBeenCalled();
    expect(screen.getAllByText("Same saved time")).toHaveLength(2);
    expect(screen.queryByText("Earlier")).toBeNull();
    expect(screen.queryByText("Later")).toBeNull();
});

test.each([false, true])("reversing A/B preserves the score and finding comparison (equal timestamps: %s)", async tied => {
    const date = histories[0].created_at;
    const scans = tied ? histories.map(scan => scan.id === "old" ? { ...scan, created_at: date } : scan) : histories;
    serve(scans, {
        old: { score: 10, ...(tied ? { created_at: date } : {}), findings: [finding("old-only")] },
        new: { score: 30, findings: [finding("new-only")] },
    });
    nav.query = "first=new&against=old";
    const { rerender } = render(<ComparePage />);
    const before = (await screen.findByRole("region", { name: "Comparison summary" })).textContent;
    const oldLink = screen.getByRole("link", { name: "old-only" }).getAttribute("href");
    const newLink = screen.getByRole("link", { name: "new-only" }).getAttribute("href");
    nav.query = "first=old&against=new";
    rerender(<ComparePage />);
    expect((await screen.findByRole("region", { name: "Comparison summary" })).textContent).toBe(before);
    expect(screen.getByRole("link", { name: "old-only" }).getAttribute("href")).toBe(oldLink);
    expect(screen.getByRole("link", { name: "new-only" }).getAttribute("href")).toBe(newLink);
    expect(screen.getByRole("combobox", { name: "Select scan A" }).value).toBe("old");
    expect(screen.getByRole("combobox", { name: "Select scan B" }).value).toBe("new");
});

test.each([
    { score: 0, title: "Score unchanged", points: "0 points" },
    { score: -1, title: "Score decreased", points: "-1 points" },
    { score: null, title: "Score change unavailable", points: "Unavailable" },
])("summary describes only the score, independently from finding changes: $title", async ({ score, title, points }) => {
    serve(histories, { new: { score, findings: [finding("new-issue")] } });
    render(<ComparePage />);
    const summary = within(await screen.findByRole("region", { name: "Comparison summary" }));
    expect(summary.getByRole("heading", { name: title })).toBeTruthy();
    expect(summary.getByRole("status").textContent).toBe(points);
    const count = summary.getByText("Newly detected").parentElement;
    expect(count.querySelector("dd").textContent).toBe("1");
    expect(screen.getByText(/unchanged score can still have changed findings/)).toBeTruthy();
    expect(screen.getByText("How comparison works").parentElement.tagName).toBe("DETAILS");
});
