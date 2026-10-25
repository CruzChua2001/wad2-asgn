import { createRef } from "react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import api from "@/lib/api";
import DeleteModal from "../delete-modal";

vi.mock("@/lib/api", () => ({ default: { delete: vi.fn() } }));

const PROJECT = { id: "p1", name: "SMU website" };

// Renders the dialog already open, with close() faked so we can check it was called
const renderModal = (project = PROJECT) => {
    const modalRef = createRef();
    const onDeleted = vi.fn();
    render(<DeleteModal project={project} modalRef={modalRef} onDeleted={onDeleted} />);

    const dialog = modalRef.current;
    dialog.setAttribute("open", "");
    dialog.close = vi.fn();
    return { dialog, onDeleted };
}

const deleteButton = _ => screen.getByRole("button", { name: /Delete project|Deleting/ });

beforeEach(() => {
    vi.clearAllMocks();
});

describe("DeleteModal", () => {
    test("names the project and warns it can't be undone", () => {
        renderModal();

        expect(screen.getByRole("dialog", { name: "Delete SMU website?" })).toBeTruthy();
        expect(screen.getByText(/You can't undo this/)).toBeTruthy();
    });

    test("renders before a project is picked", () => {
        renderModal(null);

        expect(screen.getByRole("heading").textContent).toBe("Delete ?");
    });

    test("deletes the project, tells the page and closes", async () => {
        api.delete.mockResolvedValue({ data: { message: "Deleted" } });
        const { dialog, onDeleted } = renderModal();
        fireEvent.click(deleteButton());

        await waitFor(() => expect(onDeleted).toHaveBeenCalledWith(PROJECT));
        expect(api.delete).toHaveBeenCalledWith("/api/project/p1");
        expect(dialog.close).toHaveBeenCalled();
    });

    test("shows Deleting... and can't be clicked twice while it waits", async () => {
        let finish;
        api.delete.mockReturnValue(new Promise(resolve => { finish = resolve; }));
        renderModal();
        fireEvent.click(deleteButton());

        expect(deleteButton().textContent).toBe("Deleting...");
        expect(deleteButton().disabled).toBe(true);

        finish({ data: {} });
        await waitFor(() => expect(deleteButton().textContent).toBe("Delete project"));
        expect(api.delete).toHaveBeenCalledTimes(1);
    });

    test("shows the API's error and stays open", async () => {
        api.delete.mockRejectedValue({ response: { data: { error: "Only the project creator can delete it." } } });
        const { dialog, onDeleted } = renderModal();
        fireEvent.click(deleteButton());

        expect((await screen.findByRole("alert")).textContent).toBe("Only the project creator can delete it.");
        expect(onDeleted).not.toHaveBeenCalled();
        expect(dialog.close).not.toHaveBeenCalled();
        expect(deleteButton().disabled).toBe(false);
    });

    test("shows a friendly message when the request fails without an answer", async () => {
        api.delete.mockRejectedValue(new Error("Network Error"));
        renderModal();
        fireEvent.click(deleteButton());

        expect((await screen.findByRole("alert")).textContent).toBe("Could not delete the project. Please try again.");
    });

    test("trying again clears the old error", async () => {
        api.delete.mockRejectedValueOnce(new Error("Network Error"));
        api.delete.mockReturnValueOnce(new Promise(() => {}));
        renderModal();

        fireEvent.click(deleteButton());
        await screen.findByRole("alert");
        fireEvent.click(deleteButton());

        expect(screen.queryByRole("alert")).toBeNull();
    });

    test("closing the dialog clears the old error", async () => {
        api.delete.mockRejectedValue(new Error("Network Error"));
        const { dialog } = renderModal();
        fireEvent.click(deleteButton());
        await screen.findByRole("alert");

        fireEvent(dialog, new Event("close"));

        expect(screen.queryByRole("alert")).toBeNull();
    });

    test("Cancel closes without deleting", () => {
        const { dialog, onDeleted } = renderModal();
        fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

        expect(dialog.close).toHaveBeenCalled();
        expect(api.delete).not.toHaveBeenCalled();
        expect(onDeleted).not.toHaveBeenCalled();
    });
});
