import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { AuthProvider, useAuth } from "../auth-provider";

// The session Supabase pretends to have. Each test changes it
let fakeSession = null;

vi.mock("@/lib/client", () => ({
    createClient: () => ({
        auth: {
            onAuthStateChange: callback => {
                callback("INITIAL_SESSION", fakeSession);
                return { data: { subscription: { unsubscribe: vi.fn() } } };
            },
        },
    }),
}));

const ShowUser = _ => {
    const { status, user } = useAuth();
    return <p>{status} {user?.initials}</p>;
}

describe("AuthProvider", _ => {
    it("is a guest when there is no session", () => {
        fakeSession = null;
        render(
            <AuthProvider>
                <ShowUser />
            </AuthProvider>
        );

        expect(screen.getByText(/guest/)).toBeTruthy();
    });

    it("gets the initials from the user's name", () => {
        fakeSession = { user: { id: "u1", email: "jane@example.com", user_metadata: { full_name: "Jane Tan" } } };
        render(
            <AuthProvider>
                <ShowUser />
            </AuthProvider>
        );

        expect(screen.getByText(/JT/)).toBeTruthy();
    });
});
