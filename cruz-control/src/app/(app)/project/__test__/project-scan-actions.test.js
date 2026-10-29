import { useImperativeHandle } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import api from "@/lib/api";
import { useScan } from "../../scan/scan-context";
import ProjectPage from "../page";

const nav = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => nav }));
vi.mock("next/link", () => ({ default: ({ href, children, ...props }) => <a href={href} {...props}>{children}</a> }));
vi.mock("@/lib/api", () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock("@/components/auth/auth-provider", () => ({ useAuth: () => ({ status: "authenticated", user: { id: "u1" } }) }));
vi.mock("../../scan/scan-context", () => ({ useScan: vi.fn() }));
vi.mock("../member-modal", () => ({ default: () => null }));
vi.mock("../delete-modal", () => ({ default: () => null }));
vi.mock("../project-modal", () => ({ default: function MockProjectModal({ modalRef, onSubmit }) {
    useImperativeHandle(modalRef, () => ({ showModal: vi.fn(), close: vi.fn() }));
    return <form aria-label="Project form" onSubmit={onSubmit}><button type="submit">Create test project</button></form>;
} }));
vi.mock("motion/react", async original => ({ ...await original(), useReducedMotion: () => true }));

const project = id => ({ id, name: "General", domain: "example.com", github_repo: null, role: "owner", latestScan: { id: `scan-${id}`, score: 80, grade: "B", created_at: "2026-10-30" }, scores: [] });
beforeEach(() => {
    vi.resetAllMocks();
    useScan.mockReturnValue({ startScan: vi.fn(), phase: "idle" });
    api.get.mockImplementation(url => Promise.resolve({ data: url === "/api/project" ? [project("p1")] : [] }));
});

test("a returned project is rendered once and Re-scan retains its ID without creating a project", async () => {
    render(<ProjectPage />);
    await screen.findByRole("heading", { name: "General" });
    expect(screen.getAllByRole("heading", { name: "General" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Re-scan General" }));
    expect(useScan.mock.results[0].value.startScan).toHaveBeenCalledWith({ domain: "example.com", githubRepo: null, projectId: "p1", force: true });
    expect(nav.push).toHaveBeenCalledWith("/scan");
    expect(api.post).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: /View results.*General/ }).getAttribute("href")).toBe("/scan/scan-p1");
});

test("two different IDs with the same name and target remain separate cards", async () => {
    api.get.mockImplementation(url => Promise.resolve({ data: url === "/api/project" ? [project("p1"), project("p2")] : [] }));
    render(<ProjectPage />);
    expect(await screen.findAllByRole("heading", { name: "General" })).toHaveLength(2);
    expect(screen.getAllByRole("link", { name: "View history for General" }).map(link => link.getAttribute("href"))).toEqual(["/project/p1/history", "/project/p2/history"]);
});

test("repeat form submissions issue only one create request and scan the returned project ID", async () => {
    let finish;
    api.post.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    render(<ProjectPage />);
    await screen.findByRole("heading", { name: "General" });
    const form = screen.getByRole("form", { name: "Project form" });
    act(() => { fireEvent.submit(form); fireEvent.submit(form); });
    expect(api.post).toHaveBeenCalledTimes(1);
    await act(async () => finish({ data: project("new-project") }));
    expect(useScan.mock.results[0].value.startScan).toHaveBeenCalledWith(expect.objectContaining({ projectId: "new-project", force: true }));
    expect(screen.getAllByRole("heading", { name: "General" })).toHaveLength(2);
});

test("a project already scanning has a disabled Re-scan action", async () => {
    useScan.mockReturnValue({ startScan: vi.fn(), phase: "scanning", scan: { projectId: "p1" } });
    render(<ProjectPage />);
    const button = await screen.findByRole("button", { name: "Scanning... General" });
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(useScan.mock.results[0].value.startScan).not.toHaveBeenCalled();
});
