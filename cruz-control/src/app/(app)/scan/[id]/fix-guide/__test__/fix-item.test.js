import { beforeEach, expect, test, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import api from "@/lib/api";
import { useAuth } from "@/components/auth/auth-provider";
import FixItem from "../fix-item";

vi.mock("@/lib/api", () => ({ default: { post: vi.fn() } }));
vi.mock("@/components/auth/auth-provider", () => ({ useAuth: vi.fn() }));
vi.mock("@/components/small-loader", () => ({ default: ({ text }) => <span role="status">{text}</span> }));
const finding = { id: "web-csp", title: "Missing CSP", kind: "issue", severity: "medium", why: "Limits injected scripts", fix: "Set a CSP header", learnMore: { url: "https://developer.mozilla.org/" } };
const item = () => <ul><FixItem scanId="scan-1" finding={finding} open done={false} onToggleDone={vi.fn()} onToggleOpen={vi.fn()} /></ul>;
beforeEach(() => {
    vi.resetAllMocks();
    useAuth.mockReturnValue({ status: "authenticated", openAuth: vi.fn() });
});

test("guests are sent to login without making a guide request", () => {
    const openAuth = vi.fn();
    useAuth.mockReturnValue({ status: "guest", openAuth });
    render(item());
    fireEvent.click(screen.getByRole("button", { name: "Get step-by-step guide" }));
    expect(openAuth).toHaveBeenCalledWith("login");
    expect(api.post).not.toHaveBeenCalled();
});

test("pending requests cannot repeat and a successful guide uses the exact scan and finding IDs", async () => {
    let finish;
    api.post.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    render(item());
    const button = screen.getByRole("button", { name: "Get step-by-step guide" });
    fireEvent.click(button);
    expect(button.disabled).toBe(true);
    expect(screen.getByRole("status").textContent).toBe("Writing your guide...");
    fireEvent.click(button);
    expect(api.post).toHaveBeenCalledExactlyOnceWith("/api/scan/scan-1/finding/web-csp/guide");
    await act(async () => finish({ data: { guide: "1. Set the response header.\n2. Re-scan." } }));
    expect(screen.getByText(/Set the response header/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Get step-by-step guide" })).toBeNull();
    expect(screen.getByText(/AI-generated. Double-check/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Learn more" }).getAttribute("href")).toBe(finding.learnMore.url);
});

test.each(["api", "network"])("failed guide requests show a useful error and can be retried: %s", async type => {
    api.post.mockRejectedValueOnce(type === "api" ? { response: { data: { error: "Guide is temporarily unavailable." } } } : new Error("offline"))
        .mockResolvedValueOnce({ data: { guide: "Review your server configuration." } });
    render(item());
    fireEvent.click(screen.getByRole("button", { name: "Get step-by-step guide" }));
    expect((await screen.findByRole("alert")).textContent).toBe(type === "api" ? "Guide is temporarily unavailable." : "Couldn't create the guide. Please try again.");
    const retry = screen.getByRole("button", { name: "Get step-by-step guide" });
    expect(retry.disabled).toBe(false);
    fireEvent.click(retry);
    expect(await screen.findByText("Review your server configuration.")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(api.post).toHaveBeenCalledTimes(2);
});
