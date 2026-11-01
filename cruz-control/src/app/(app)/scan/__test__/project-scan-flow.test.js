import { act, renderHook } from "@testing-library/react";
import { beforeEach, expect, test, vi } from "vitest";
import api from "@/lib/api";
import { createClient } from "@/lib/client";
import { ScanProvider, useScan } from "../scan-context";

const mocks = vi.hoisted(() => ({ push: vi.fn(), getSession: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: mocks.push }) }));
vi.mock("@/lib/api", () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock("@/lib/client", () => ({ createClient: vi.fn() }));
vi.mock("@/components/auth/auth-provider", () => ({ useAuth: () => ({ status: "authenticated" }) }));
vi.mock("../scan-result", () => ({ toResult: data => data }));

const response = id => {
    let sent = false;
    return { ok: true, body: { getReader: () => ({ read: async () => {
        if (sent) return { done: true };
        sent = true;
        return { done: false, value: new TextEncoder().encode(JSON.stringify({ type: "done", id }) + "\n") };
    } }) } };
};
const session = { data: { session: { access_token: "mock-token" } } };
beforeEach(() => {
    vi.resetAllMocks();
    createClient.mockReturnValue({ auth: { getSession: mocks.getSession } });
    mocks.getSession.mockResolvedValue(session);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response("scan-2")));
});
afterEach(() => vi.unstubAllGlobals());

test("re-scan posts the same projectId and force, preserves it in terminal state and never creates a project", async () => {
    const { result } = renderHook(() => useScan(), { wrapper: ScanProvider });
    await act(async () => result.current.startScan({ domain: "example.com", githubRepo: null, projectId: "p1", force: true }));
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ domain: "example.com", githubRepo: null, projectId: "p1", force: true });
    expect(result.current.scan.projectId).toBe("p1");
    expect(mocks.push).toHaveBeenCalledWith("/scan/scan-2");
    expect(api.post).not.toHaveBeenCalled();
});

test("two calls for the same project while authentication is pending issue only one request", async () => {
    let finish;
    mocks.getSession.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    const { result } = renderHook(() => useScan(), { wrapper: ScanProvider });
    let first, second;
    act(() => {
        first = result.current.startScan({ domain: "example.com", projectId: "p1", force: true });
        second = result.current.startScan({ domain: "example.com", projectId: "p1", force: true });
    });
    expect(mocks.getSession).toHaveBeenCalledTimes(1);
    await act(async () => { finish(session); await Promise.all([first, second]); });
    expect(fetch).toHaveBeenCalledTimes(1);
});

test("after a scan finishes, the same project can receive another scan without creating a project", async () => {
    fetch.mockResolvedValueOnce(response("first-scan")).mockResolvedValueOnce(response("second-scan"));
    const { result } = renderHook(() => useScan(), { wrapper: ScanProvider });
    const options = { domain: "example.com", projectId: "p1", force: true };
    await act(async () => result.current.startScan(options));
    await act(async () => result.current.startScan(options));
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls.map(([, config]) => JSON.parse(config.body).projectId)).toEqual(["p1", "p1"]);
    expect(result.current.scan.id).toBe("second-scan");
    expect(result.current.scan.projectId).toBe("p1");
    expect(api.post).not.toHaveBeenCalled();
});

test("a superseded session lookup cannot send a scan using the newer request's signal", async () => {
    let finishOld;
    mocks.getSession.mockReturnValueOnce(new Promise(resolve => { finishOld = resolve; })).mockResolvedValueOnce(session);
    const { result } = renderHook(() => useScan(), { wrapper: ScanProvider });
    let old;
    act(() => { old = result.current.startScan({ domain: "old.com", projectId: "p1" }); });
    await act(async () => result.current.startScan({ domain: "new.com", projectId: "p2" }));
    await act(async () => { finishOld(session); await old; });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetch.mock.calls[0][1].body).projectId).toBe("p2");
});

test("standalone Save creates one new project even when called twice before render, and cannot repeat after success", async () => {
    let finish;
    api.post.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    api.get.mockResolvedValue({ data: { title: "General", domain: "example.com", linkedRepository: null, projectId: null } });
    const { result } = renderHook(() => useScan(), { wrapper: ScanProvider });
    await act(async () => result.current.loadResult("standalone"));
    let first, second;
    act(() => {
        first = result.current.saveToProject("standalone");
        second = result.current.saveToProject("standalone");
    });
    expect(api.post).toHaveBeenCalledTimes(1);
    expect(api.post).toHaveBeenCalledWith("/api/project", { name: "General", domain: "example.com", githubRepo: null, scanId: "standalone" });
    await act(async () => { finish({ data: { id: "new-project" } }); await Promise.all([first, second]); });
    await act(async () => result.current.saveToProject("standalone"));
    expect(api.post).toHaveBeenCalledTimes(1);
});

test("project results cannot be saved again as another project, and failed saves can be retried", async () => {
    api.get.mockResolvedValueOnce({ data: { projectId: "p1" } }).mockResolvedValueOnce({ data: { title: "Standalone", domain: "example.com", projectId: null } });
    const { result } = renderHook(() => useScan(), { wrapper: ScanProvider });
    await act(async () => result.current.loadResult("project-scan"));
    await act(async () => result.current.saveToProject("project-scan"));
    expect(api.post).not.toHaveBeenCalled();
    await act(async () => result.current.loadResult("standalone"));
    api.post.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ data: {} });
    await act(async () => result.current.saveToProject("standalone"));
    expect(result.current.saveError).toMatch(/Could not save/);
    await act(async () => result.current.saveToProject("standalone"));
    expect(api.post).toHaveBeenCalledTimes(2);
    expect(result.current.savedScanId).toBe("standalone");
});
