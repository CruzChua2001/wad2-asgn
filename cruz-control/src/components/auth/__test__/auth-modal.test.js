import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import AuthModal from "../auth-modal";

const signIn = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn() }), usePathname: () => "/scan" }));
vi.mock("../auth-provider", () => ({ useAuth: () => ({ signIn: signIn }) }));

describe("AuthModal", () => {
    it("switches to the sign up tab", () => {
        render(<AuthModal initialTab="login" onClose={vi.fn()} />);

        fireEvent.click(screen.getByText("Sign Up"));

        expect(screen.getByText("Sign Up").getAttribute("aria-selected")).toBe("true");
    });

    it("calls signIn with the email and password", () => {
        render(<AuthModal initialTab="login" onClose={vi.fn()} />);

        // The login and sign up forms both have these fields, [0] is the login one
        fireEvent.change(screen.getAllByLabelText("Email")[0], { target: { value: "jane@example.com" } });
        fireEvent.change(screen.getAllByLabelText("Password")[0], { target: { value: "password123" } });
        fireEvent.click(screen.getByText("Sign in"));

        expect(signIn).toHaveBeenCalledWith({ email: "jane@example.com", password: "password123" });
    });

    it("shows an error when login fails", async () => {
        signIn.mockRejectedValue(new Error("Email or password is incorrect."));
        render(<AuthModal initialTab="login" onClose={vi.fn()} />);

        fireEvent.change(screen.getAllByLabelText("Email")[0], { target: { value: "jane@example.com" } });
        fireEvent.change(screen.getAllByLabelText("Password")[0], { target: { value: "wrong" } });
        fireEvent.click(screen.getByText("Sign in"));

        expect(await screen.findByText("Email or password is incorrect.")).toBeTruthy();
    });
});
