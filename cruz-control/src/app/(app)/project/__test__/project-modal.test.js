import { createRef } from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ProjectModal from "../project-modal";

describe("ProjectModal", () => {
    it("submits the form", () => {
        const onSubmit = vi.fn(event => event.preventDefault());
        const form = { name: "WAD2", domain: "example.com", githubRepo: "" };
        render(<ProjectModal modalRef={createRef()} form={form} updateField={vi.fn()} onSubmit={onSubmit} />);

        fireEvent.click(screen.getByText("Create & scan"));

        expect(onSubmit).toHaveBeenCalled();
    });

    it("shows the repo field after clicking its button", () => {
        const form = { name: "", domain: "", githubRepo: "" };
        render(<ProjectModal modalRef={createRef()} form={form} updateField={vi.fn()} onSubmit={vi.fn()} />);

        expect(screen.queryByLabelText("GitHub repository")).toBeNull();

        fireEvent.click(screen.getByText("GitHub repository"));

        expect(screen.getByLabelText("GitHub repository")).toBeTruthy();
    });

    it("fills in the fields when editing a project", () => {
        const form = { name: "SMU website", domain: "smu.edu.sg", githubRepo: "" };
        render(<ProjectModal editing={true} modalRef={createRef()} form={form} updateField={vi.fn()} onSubmit={vi.fn()} />);

        expect(screen.getByText("Update your project")).toBeTruthy();
        expect(screen.getByLabelText("Project name").value).toBe("SMU website");
    });
});
