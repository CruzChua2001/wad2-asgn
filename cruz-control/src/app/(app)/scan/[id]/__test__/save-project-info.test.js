import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import SaveProjectInfo from "../save-project-info";

afterEach(() => vi.restoreAllMocks());

test("save information is hidden until explicitly opened, portalled outside its container, and dismissible", () => {
    const { container } = render(<header><SaveProjectInfo /></header>);
    const trigger = screen.getByRole("button", { name: "About saving to a project" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("dialog")).toBeNull();
    trigger.focus();
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "About saving to a project" });
    expect(container.contains(dialog)).toBe(false);
    expect(dialog.parentElement).toBe(document.body);
    expect(dialog.textContent).toContain("Creates a new project. To scan an existing project again, go to Projects → Re-scan.");
    expect(trigger.getAttribute("aria-controls")).toBe(dialog.id);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close save information" }));
    fireEvent.keyDown(document.activeElement, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("false");
});

test("mouse, tap and keyboard focus have usable dismissal paths", () => {
    render(<><SaveProjectInfo /><button>Outside</button></>);
    const trigger = screen.getByRole("button", { name: "About saving to a project" });
    fireEvent.pointerDown(trigger, { pointerType: "touch" });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole("button", { name: "Close save information" }));
    expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger);
    fireEvent.pointerDown(screen.getByRole("button", { name: "Outside" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(trigger);
    act(() => screen.getByRole("button", { name: "Outside" }).focus());
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.mouseEnter(trigger);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(trigger);
    fireEvent.keyDown(document.activeElement, { key: "Tab" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(trigger);
});

test("viewport placement clamps both edges when there is not enough room below", () => {
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(320);
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(200);
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function () {
        return this.getAttribute("role") === "dialog"
            ? { width: 288, height: 150 }
            : { left: 280, right: 324, top: 5, bottom: 49, width: 44, height: 44 };
    });
    render(<SaveProjectInfo />);
    fireEvent.click(screen.getByRole("button", { name: "About saving to a project" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog.style.left).toBe("16px");
    expect(dialog.style.top).toBe("16px");
    fireEvent(window, new Event("resize"));
    expect(screen.queryByRole("dialog")).toBeNull();
});
