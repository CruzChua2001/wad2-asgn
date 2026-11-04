import { beforeEach, expect, test, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import api from "@/lib/api";
import { useAuth } from "@/components/auth/auth-provider";
import AskCruzPanel from "../ask-cruz-panel";

const route = vi.hoisted(() => ({ id: "scan-1" }));
vi.mock("next/navigation", () => ({ useParams: () => route }));
vi.mock("@/lib/api", () => ({ default: { post: vi.fn() } }));
vi.mock("@/components/auth/auth-provider", () => ({ useAuth: vi.fn() }));
vi.mock("@/components/small-loader", () => ({ default: ({ text }) => <span role="status">{text}</span> }));
beforeEach(() => {
    vi.resetAllMocks();
    route.id = "scan-1";
    useAuth.mockReturnValue({ status: "authenticated", openAuth: vi.fn() });
});

test("closed and guest states avoid requests and expose login and close controls", () => {
    const openAuth = vi.fn();
    const onClose = vi.fn();
    useAuth.mockReturnValue({ status: "guest", openAuth });
    const view = render(<AskCruzPanel open={false} onClose={onClose} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    view.rerender(<AskCruzPanel open onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(openAuth).toHaveBeenCalledWith("login");
    expect(screen.queryByRole("textbox")).toBeNull();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Close Ask Cruz" }));
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(api.post).not.toHaveBeenCalled();
});

test("clicks outside the panel close it, but clicks inside it or on the Ask Cruz button do not", () => {
    const onClose = vi.fn();
    render(
        <>
            <button type="button" aria-controls="ask-cruz-panel">Ask Cruz</button>
            <p>Page behind</p>
            <AskCruzPanel open onClose={onClose} />
        </>
    );
    fireEvent.pointerDown(screen.getByRole("textbox"));
    fireEvent.pointerDown(screen.getByRole("button", { name: "Ask Cruz" }));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.pointerDown(screen.getByText("Page behind"));
    expect(onClose).toHaveBeenCalledTimes(1);
});

test("trims questions, blocks empty and pending submissions, then displays the real reply", async () => {
    let finish;
    api.post.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    render(<AskCruzPanel open onClose={vi.fn()} />);
    const input = screen.getByRole("textbox", { name: "Ask Cruz a question" });
    const send = screen.getByRole("button", { name: "Send" });
    expect(document.activeElement).toBe(input);
    fireEvent.change(input, { target: { value: "   " } });
    expect(send.disabled).toBe(true);
    fireEvent.submit(input.closest("form"));
    expect(api.post).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: "  Explain this score  " } });
    fireEvent.submit(input.closest("form"));
    expect(api.post).toHaveBeenCalledExactlyOnceWith("/api/chat", { scanId: "scan-1", messages: [{ role: "user", text: "Explain this score" }] });
    expect(input.value).toBe("");
    expect(send.disabled).toBe(true);
    expect(screen.getByRole("status").textContent).toBe("Cruz is thinking...");
    fireEvent.change(input, { target: { value: "Another question" } });
    fireEvent.submit(input.closest("form"));
    expect(api.post).toHaveBeenCalledTimes(1);
    await act(async () => finish({ data: { reply: "**Higher** scores mean less detected exposure. Use `HTTPS`." } }));
    const log = within(screen.getByRole("log"));
    expect(log.getByText("Explain this score")).toBeTruthy();
    expect(log.getByText("Higher").tagName).toBe("STRONG");
    expect(log.getByText("HTTPS").tagName).toBe("CODE");
    expect(send.disabled).toBe(false);
    expect(screen.queryByRole("status")).toBeNull();
});

test.each(["api", "network"])("request errors remain recoverable with a subsequent question: %s", async type => {
    api.post.mockRejectedValueOnce(type === "api" ? { response: { data: { error: "Please try again shortly." } } } : new Error("offline"))
        .mockResolvedValueOnce({ data: { reply: "Start with the highest priority finding." } });
    render(<AskCruzPanel open onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "What should I fix first?" }));
    expect((await screen.findByRole("alert")).textContent).toBe(type === "api" ? "Please try again shortly." : "Cruz couldn't answer just now. Please try again.");
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Try that question again" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText("Start with the highest priority finding.")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(api.post).toHaveBeenCalledTimes(2);
});

test("follow-up context includes previous replies, excludes the local greeting and keeps only ten messages", async () => {
    route.id = undefined;
    const reply = "A public signal needs a closer look.";
    api.post.mockResolvedValue({ data: { reply } });
    render(<AskCruzPanel open onClose={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Explain my score" })).toBeNull();
    const input = screen.getByRole("textbox");
    for (let index = 0; index < 6; index++) {
        fireEvent.change(input, { target: { value: `Question ${index}` } });
        fireEvent.submit(input.closest("form"));
        await waitFor(() => expect(within(screen.getByRole("log")).getAllByText(reply)).toHaveLength(index + 1));
    }
    expect(api.post).toHaveBeenCalledTimes(6);
    const body = api.post.mock.calls.at(-1)[1];
    expect(body.scanId).toBeUndefined();
    expect(body.messages).toEqual([
        { role: "assistant", text: reply },
        ...[1, 2, 3, 4].flatMap(index => [{ role: "user", text: `Question ${index}` }, { role: "assistant", text: reply }]),
        { role: "user", text: "Question 5" },
    ]);
});
