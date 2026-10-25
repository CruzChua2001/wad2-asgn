import { useState } from "react";
import { describe, test, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import RoleSelect from "../role-select";

// Reduced motion so the list opens and closes without waiting for animations
vi.mock("motion/react", async importOriginal => ({
    ...await importOriginal(),
    useReducedMotion: () => true,
}));

// Same roles as the members dialog
const ROLES = [
    { value: "viewer", text: "Viewer", hint: "Can see the results" },
    { value: "owner", text: "Owner", hint: "Can edit, re-scan and invite" },
];

const renderSelect = (value = "viewer") => {
    const onChange = vi.fn();
    render(<RoleSelect roles={ROLES} value={value} onChange={onChange} />);
    return { onChange, box: screen.getByRole("combobox") };
}

const optionId = name => screen.getByRole("option", { name: new RegExp(name) }).id;

afterEach(() => {
    vi.restoreAllMocks();
});

describe("RoleSelect", () => {
    test("shows the chosen role and starts closed", () => {
        const { box } = renderSelect();

        expect(box.textContent).toBe("Viewer");
        expect(box.getAttribute("aria-expanded")).toBe("false");
        expect(screen.queryByRole("listbox")).toBeNull();
    });

    test("clicking opens the list with every role and its hint", () => {
        const { box } = renderSelect();
        fireEvent.click(box);

        expect(box.getAttribute("aria-expanded")).toBe("true");
        expect(screen.getAllByRole("option")).toHaveLength(2);
        expect(screen.getByText("Can see the results")).toBeTruthy();
        expect(screen.getByText("Can edit, re-scan and invite")).toBeTruthy();
    });

    test("marks the chosen role as selected", () => {
        const { box } = renderSelect("owner");
        fireEvent.click(box);

        expect(screen.getByRole("option", { name: /Owner/ }).getAttribute("aria-selected")).toBe("true");
        expect(screen.getByRole("option", { name: /Viewer/ }).getAttribute("aria-selected")).toBe("false");
    });

    test("clicking a role picks it and closes the list", async () => {
        const { box, onChange } = renderSelect();
        fireEvent.click(box);
        fireEvent.click(screen.getByRole("option", { name: /Owner/ }));

        expect(onChange).toHaveBeenCalledWith("owner");
        expect(box.getAttribute("aria-expanded")).toBe("false");
        await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    });

    test("clicking the box again closes the list without picking", async () => {
        const { box, onChange } = renderSelect();
        fireEvent.click(box);
        fireEvent.click(box);

        expect(onChange).not.toHaveBeenCalled();
        await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    });

    test("the box shows the new role once the parent updates it", () => {
        const Wrapper = () => {
            const [role, setRole] = useState("viewer");
            return <RoleSelect roles={ROLES} value={role} onChange={setRole} />;
        }
        render(<Wrapper />);
        const box = screen.getByRole("combobox");

        fireEvent.click(box);
        fireEvent.click(screen.getByRole("option", { name: /Owner/ }));

        expect(box.textContent).toBe("Owner");
    });

    test("opening highlights the role that's already chosen", () => {
        const { box } = renderSelect("owner");
        fireEvent.click(box);

        expect(box.getAttribute("aria-activedescendant")).toBe(optionId("Owner"));
    });

    test("ArrowDown opens the list, then moves down and wraps to the top", () => {
        const { box } = renderSelect();

        fireEvent.keyDown(box, { key: "ArrowDown" });
        expect(box.getAttribute("aria-expanded")).toBe("true");
        expect(box.getAttribute("aria-activedescendant")).toBe(optionId("Viewer"));

        fireEvent.keyDown(box, { key: "ArrowDown" });
        expect(box.getAttribute("aria-activedescendant")).toBe(optionId("Owner"));

        fireEvent.keyDown(box, { key: "ArrowDown" });
        expect(box.getAttribute("aria-activedescendant")).toBe(optionId("Viewer"));
    });

    test("ArrowUp from the first role wraps to the last", () => {
        const { box } = renderSelect();
        fireEvent.keyDown(box, { key: "ArrowUp" });
        fireEvent.keyDown(box, { key: "ArrowUp" });

        expect(box.getAttribute("aria-activedescendant")).toBe(optionId("Owner"));
    });

    test("Enter picks the highlighted role", () => {
        const { box, onChange } = renderSelect();
        fireEvent.keyDown(box, { key: "Enter" });
        fireEvent.keyDown(box, { key: "ArrowDown" });
        fireEvent.keyDown(box, { key: "Enter" });

        expect(onChange).toHaveBeenCalledWith("owner");
        expect(box.getAttribute("aria-expanded")).toBe("false");
    });

    test("Space opens the list and picks a role like Enter", () => {
        const { box, onChange } = renderSelect();
        fireEvent.keyDown(box, { key: " " });
        expect(box.getAttribute("aria-expanded")).toBe("true");

        fireEvent.keyDown(box, { key: " " });
        expect(onChange).toHaveBeenCalledWith("viewer");
    });

    test("Escape closes the list without picking", async () => {
        const { box, onChange } = renderSelect();
        fireEvent.click(box);
        fireEvent.keyDown(box, { key: "Escape" });

        expect(onChange).not.toHaveBeenCalled();
        expect(box.getAttribute("aria-expanded")).toBe("false");
        await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    });

    test("Escape on a closed list does nothing, so the dialog can close", () => {
        const { box } = renderSelect();
        const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
        box.dispatchEvent(event);

        expect(event.defaultPrevented).toBe(false);
    });

    test("other keys are ignored", () => {
        const { box, onChange } = renderSelect();
        fireEvent.keyDown(box, { key: "a" });
        fireEvent.keyDown(box, { key: "Tab" });

        expect(box.getAttribute("aria-expanded")).toBe("false");
        expect(onChange).not.toHaveBeenCalled();
    });

    test("tabbing away closes the list", async () => {
        render(
            <div>
                <RoleSelect roles={ROLES} value="viewer" onChange={vi.fn()} />
                <button type="button">Invite</button>
            </div>
        );
        const box = screen.getByRole("combobox");
        fireEvent.click(box);
        fireEvent.blur(box, { relatedTarget: screen.getByRole("button", { name: "Invite" }) });

        expect(box.getAttribute("aria-expanded")).toBe("false");
        await waitFor(() => expect(screen.queryByRole("listbox")).toBeNull());
    });

    test("moving focus inside the dropdown keeps it open", () => {
        const { box } = renderSelect();
        fireEvent.click(box);
        fireEvent.blur(box, { relatedTarget: screen.getByRole("listbox") });

        expect(box.getAttribute("aria-expanded")).toBe("true");
    });

    test("opens below when there's room", () => {
        vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ bottom: 100 });
        const { box } = renderSelect();
        fireEvent.click(box);

        expect(screen.getByRole("listbox").className).toContain("top-full");
    });

    test("opens above when there isn't room below", () => {
        vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({ bottom: window.innerHeight - 50 });
        const { box } = renderSelect();
        fireEvent.click(box);

        expect(screen.getByRole("listbox").className).toContain("bottom-full");
    });
});
