import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import { clearProjectCache, getProjectCache, setProjectCache } from "@/lib/project-cache";
import { loadProjectData } from "@/lib/load-projects";
import ProfileMenu from "../profile-menu";

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }) }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/lib/load-projects", () => ({ loadProjectData: vi.fn() }));
vi.mock("@/components/auth/auth-provider", () => ({
    useAuth: () => ({ status: "authenticated", user: { id: "u1", name: "Jeffers Ng", initials: "JN", email: "j@example.com" }, signOut: vi.fn(), openAuth: vi.fn() }),
}));

const project = (id, name, latestScan) => ({ id, name, latestScan });
const scan = (id, score, grade, created_at) => ({ id, score, grade, created_at });
const data = (projects, invites = []) => ({ projects, invites });

// Lets a test decide when the load finishes
const pendingLoad = () => {
    let finish, fail;
    loadProjectData.mockReturnValue(new Promise((resolve, reject) => { finish = resolve; fail = reject; }));
    return { finish: value => act(async () => finish(value)), fail: error => act(async () => fail(error)) };
};

const openMenu = () => fireEvent.click(screen.getByRole("button", { name: /Open profile menu/ }));

beforeEach(() => {
    clearProjectCache();
    loadProjectData.mockReset();
});

test("loads the projects itself when the Projects page was never opened", async () => {
    loadProjectData.mockResolvedValue(data([project("p1", "Fresh site", scan("s1", 88, "B", "2026-11-03"))], [{ id: "i1" }]));
    render(<ProfileMenu />);
    openMenu();

    const strip = await screen.findByRole("link", { name: /Fresh site/ });
    expect(strip.getAttribute("href")).toBe("/scan/s1");
    expect(strip.textContent).toContain("88/100");
    const row = screen.getByRole("link", { name: /My projects/ });
    expect(row.textContent).toContain("1 invite");
    expect(row.textContent).toContain("1 project");
});

test("shows a loading placeholder, then removes it when there is nothing to show", async () => {
    const load = pendingLoad();
    render(<ProfileMenu />);
    openMenu();

    expect(screen.getByRole("status").textContent).toBe("Loading your projects");
    await load.finish(data([project("p1", "Never scanned", null)]));
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByText(/Latest scan/)).toBeNull();
});

test("shows the cached summary at once, then swaps in the newer scan", async () => {
    setProjectCache({ userId: "u1", projects: [project("p1", "Old name", scan("s-old", 50, "F", "2026-10-01"))], invites: [] });
    const load = pendingLoad();
    render(<ProfileMenu />);
    openMenu();

    expect(screen.getByRole("link", { name: /Old name/ }).textContent).toContain("50/100");
    expect(screen.queryByRole("status")).toBeNull();

    await load.finish(data([project("p1", "Old name", scan("s-new", 95, "A", "2026-11-03"))]));
    const strip = screen.getByRole("link", { name: /Old name/ });
    expect(strip.getAttribute("href")).toBe("/scan/s-new");
    expect(strip.textContent).toContain("95/100");
});

test("keeps the cache current for the Projects page", async () => {
    loadProjectData.mockResolvedValue(data([project("p1", "Cached", null)], [{ id: "i1" }]));
    render(<ProfileMenu />);
    openMenu();
    await screen.findByText("1 invite");

    expect(getProjectCache()).toEqual({ userId: "u1", projects: [project("p1", "Cached", null)], invites: [{ id: "i1" }] });
});

test("if loading fails the menu still works and shows nothing extra", async () => {
    const load = pendingLoad();
    render(<ProfileMenu />);
    openMenu();
    await load.fail(new Error("offline"));

    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByText(/Latest scan/)).toBeNull();
    expect(screen.getByRole("link", { name: "My projects" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeTruthy();
    expect(getProjectCache()).toBeNull();
});

test("if loading fails the cached summary stays", async () => {
    setProjectCache({ userId: "u1", projects: [project("p1", "Still here", scan("s1", 70, "C", "2026-11-01"))], invites: [] });
    const load = pendingLoad();
    render(<ProfileMenu />);
    openMenu();
    await load.fail(new Error("offline"));

    expect(screen.getByRole("link", { name: /Still here/ })).toBeTruthy();
});

test("an answer that arrives after the menu was closed is dropped", async () => {
    const load = pendingLoad();
    render(<ProfileMenu />);
    openMenu();
    openMenu();
    await load.finish(data([project("p1", "Too late", scan("s1", 90, "A", "2026-11-03"))]));

    expect(getProjectCache()).toBeNull();
});

test("loads again each time the menu opens", async () => {
    loadProjectData.mockResolvedValue(data([]));
    render(<ProfileMenu />);
    openMenu();
    await waitFor(() => expect(loadProjectData).toHaveBeenCalledTimes(1));
    openMenu();
    openMenu();
    await waitFor(() => expect(loadProjectData).toHaveBeenCalledTimes(2));
});

test("another user's cache is never shown", async () => {
    setProjectCache({ userId: "someone-else", projects: [project("p1", "Other", scan("s1", 90, "A", "2026-11-01"))], invites: [] });
    const load = pendingLoad();
    render(<ProfileMenu />);
    openMenu();

    expect(screen.queryByText(/Other/)).toBeNull();
    expect(screen.getByRole("status")).toBeTruthy();
    await load.finish(data([]));
});

test("counts projects and links the most recently scanned one", async () => {
    loadProjectData.mockResolvedValue(data([
        project("p1", "Older site", scan("s-old", 55, "F", "2026-10-02")),
        project("p2", "Never scanned", null),
        project("p3", "Newest site", scan("s-new", 91, "A", "2026-11-03")),
    ]));
    render(<ProfileMenu />);
    openMenu();

    const strip = await screen.findByRole("link", { name: /Newest site/ });
    expect(strip.getAttribute("href")).toBe("/scan/s-new");
    expect(strip.textContent).toContain("Good");
    expect(strip.textContent).toContain("Latest scan · 3 Nov");
    const row = screen.getByRole("link", { name: /My projects/ });
    expect(row.textContent).toContain("3 projects");
    expect(row.textContent).not.toContain("invite");
});

test("a user with no projects sees no counts", async () => {
    loadProjectData.mockResolvedValue(data([]));
    render(<ProfileMenu />);
    openMenu();
    await waitFor(() => expect(screen.queryByRole("status")).toBeNull());

    expect(screen.getByRole("link", { name: "My projects" }).textContent).toBe("My projects");
});

test("a scan with no grade is labelled incomplete, not given a rating", async () => {
    loadProjectData.mockResolvedValue(data([project("p1", "Partial", scan("s1", 72, null, "2026-11-02"))]));
    render(<ProfileMenu />);
    openMenu();

    const strip = await screen.findByRole("link", { name: /Partial/ });
    expect(strip.textContent).toContain("Incomplete");
    expect(strip.textContent).not.toContain("Needs work");
});
