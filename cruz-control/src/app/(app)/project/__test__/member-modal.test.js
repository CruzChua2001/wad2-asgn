import { createRef } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import api from "@/lib/api";
import MemberModal from "../member-modal";

vi.mock("@/lib/api", () => ({ default: { get: vi.fn() } }));
vi.mock("@/components/auth/auth-provider", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));

// u1 created the project, so u1 is the Owner
const members = [
    { user_id: "u1", email: "owner@example.com", role: "admin" },
    { user_id: "u2", email: "viewer@example.com", role: "viewer" },
];
const invites = [{ id: "i1", email: "new@example.com", role: "viewer" }];

describe("MemberModal", () => {
    it("shows the members and pending invites", async () => {
        api.get.mockResolvedValue({ data: { members: members, invites: invites } });
        render(<MemberModal project={{ id: "p1", role: "admin", created_by: "u1" }} modalRef={createRef()} />);

        expect(await screen.findByText("viewer@example.com")).toBeTruthy();
        expect(screen.getByText("new@example.com")).toBeTruthy();
    });

    it("labels the project creator as Owner", async () => {
        api.get.mockResolvedValue({ data: { members: members, invites: invites } });
        render(<MemberModal project={{ id: "p1", role: "viewer", created_by: "u1" }} modalRef={createRef()} />);

        expect(await screen.findByText("Owner")).toBeTruthy();
    });

    it("hides the invite form from viewers", async () => {
        api.get.mockResolvedValue({ data: { members: members, invites: invites } });
        render(<MemberModal project={{ id: "p1", role: "viewer", created_by: "u1" }} modalRef={createRef()} />);

        await screen.findByText("viewer@example.com");
        expect(screen.queryByLabelText("Email to invite")).toBeNull();
    });

    it("never shows a remove button for the Owner", async () => {
        api.get.mockResolvedValue({ data: { members: members, invites: invites } });
        render(<MemberModal project={{ id: "p1", role: "admin", created_by: "u1" }} modalRef={createRef()} />);

        await screen.findByText("viewer@example.com");
        expect(screen.getByLabelText("Remove viewer@example.com")).toBeTruthy();
        expect(screen.queryByLabelText("Remove owner@example.com")).toBeNull();
    });
});
