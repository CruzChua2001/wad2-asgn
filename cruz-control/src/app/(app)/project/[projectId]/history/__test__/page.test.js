import { beforeEach, describe, expect, test, vi } from "vitest";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import api from "@/lib/api";
import { useAuth } from "@/components/auth/auth-provider";
import HistoryPage from "../page";

const route = vi.hoisted(() => ({ projectId: "p1" }));
vi.mock("next/navigation", () => ({ useParams: () => route }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/lib/api", () => ({ default: { get: vi.fn() } }));
vi.mock("@/components/auth/auth-provider", () => ({ useAuth: vi.fn() }));

const row = (id, day, extra = {}) => ({ id, created_at: `2026-10-${day}T12:00:00Z`, domain: "example.com", github_repo: null, score: 0, grade: null, domain_captured_at: "2026-10-25T12:00:00Z", repo_captured_at: null, ...extra });
beforeEach(() => {
    vi.resetAllMocks();
    route.projectId = "p1";
    useAuth.mockReturnValue({ status: "authenticated", user: { id: "user-1" } });
});

describe("project history", () => {
    test("loads only the member history endpoint and shows loading", () => {
        api.get.mockReturnValue(new Promise(() => {}));
        render(<HistoryPage />);
        expect(screen.getByRole("status").textContent).toMatch(/Loading/);
        expect(api.get).toHaveBeenCalledWith("/api/project/p1/scan");
    });
    test("sorts newest first, keeps zero/incomplete, links scans and skips mismatched targets for comparison", async () => {
        api.get.mockResolvedValue({ data: [row("old", 26), row("different", 29, { github_repo: "a/b" }), row("new", 30)] });
        render(<HistoryPage />);
        const items = await screen.findAllByRole("listitem");
        expect(items[0].textContent).toContain("30 Oct 2026");
        expect(items[0].textContent).toContain("0/100 · Incomplete");
        expect(items[0].textContent).toContain("25 Oct 2026");
        expect(within(items[0]).getByRole("link", { name: /View scan/i }).getAttribute("href")).toBe("/scan/new");
        expect(within(items[0]).getByRole("heading", { name: "Scan #3" })).toBeTruthy();
        const newest = new URL(within(items[0]).getByRole("link", { name: "Compare scans for Scan #3" }).getAttribute("href"), "http://localhost");
        expect(newest.pathname).toBe("/scan/new/compare");
        expect(Object.fromEntries(newest.searchParams)).toEqual({ first: "new", fromHistory: "new", against: "old" });
        const oldest = new URL(within(items[2]).getByRole("link", { name: "Compare scans for Scan #1" }).getAttribute("href"), "http://localhost");
        expect(Object.fromEntries(oldest.searchParams)).toEqual({ first: "old", fromHistory: "old", against: "new" });
        const unmatched = new URL(within(items[1]).getByRole("link", { name: /Compare scans/ }).getAttribute("href"), "http://localhost");
        expect(unmatched.searchParams.get("against")).toBeNull();
    });
    test("empty history explains the owner action", async () => {
        api.get.mockResolvedValue({ data: [] });
        render(<HistoryPage />);
        expect(await screen.findByText(/No scans yet/)).toBeTruthy();
    });
    test("a single scan still offers Compare scans and an identifying View scan link", async () => {
        api.get.mockResolvedValue({ data: [row("only", 30)] });
        render(<HistoryPage />);
        const item = within(await screen.findByRole("listitem"));
        expect(item.getByRole("link", { name: "Compare scans for Scan #1" }).getAttribute("href")).toBe("/scan/only/compare?first=only&fromHistory=only");
        expect(item.getByRole("link", { name: "View Scan #1" }).getAttribute("href")).toBe("/scan/only");
    });
    test("a missing capture date differs from a repository that was not included", async () => {
        api.get.mockResolvedValue({ data: [row("new", 30, { domain_captured_at: null })] });
        render(<HistoryPage />);
        await screen.findByRole("listitem");
        expect(screen.getByText(/Website captured: Capture date unknown/)).toBeTruthy();
        expect(screen.getByText(/Repository not included/)).toBeTruthy();
        expect(screen.queryByText(/Repository captured: Date unknown/)).toBeNull();
    });
    test("friendly error can be retried", async () => {
        api.get.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ data: [] });
        render(<HistoryPage />);
        expect((await screen.findByRole("alert")).textContent).toMatch(/Could not load scan history/);
        fireEvent.click(screen.getByRole("button", { name: "Try again" }));
        await screen.findByText(/No scans yet/);
        expect(api.get).toHaveBeenCalledTimes(2);
    });
    test("shows the API membership error", async () => {
        api.get.mockRejectedValue({ response: { data: { error: "You don't have access to this project." } } });
        render(<HistoryPage />);
        expect((await screen.findByRole("alert")).textContent).toContain("don't have access");
    });
    test("guests are asked to log in without making requests", () => {
        useAuth.mockReturnValue({ status: "guest", openAuth: vi.fn() });
        render(<HistoryPage />);
        expect(screen.getByText("History needs an account")).toBeTruthy();
        expect(api.get).not.toHaveBeenCalled();
    });
    test("slow old project response cannot replace the new project's history", async () => {
        let finish;
        api.get.mockReturnValueOnce(new Promise(resolve => { finish = resolve; })).mockResolvedValueOnce({ data: [row("new-project", 30)] });
        const { rerender } = render(<HistoryPage />);
        route.projectId = "p2";
        rerender(<HistoryPage />);
        await screen.findByRole("link", { name: /View scan/i });
        await act(async () => finish({ data: [row("stale", 26)] }));
        expect(screen.getByRole("link", { name: /View scan/i }).getAttribute("href")).toBe("/scan/new-project");
    });
    test("logging out hides already loaded member history", async () => {
        api.get.mockResolvedValue({ data: [row("private", 30)] });
        const { rerender } = render(<HistoryPage />);
        await screen.findByRole("listitem");
        useAuth.mockReturnValue({ status: "guest" });
        rerender(<HistoryPage />);
        expect(screen.queryByRole("listitem")).toBeNull();
    });
});
