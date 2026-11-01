import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTheme } from "../theme-store";

describe("useTheme", () => {
    it("starts as light", () => {
        localStorage.clear();
        const { result } = renderHook(() => useTheme());

        expect(result.current[0]).toBe("light");
    });

    it("changes to dark", () => {
        const { result } = renderHook(() => useTheme());

        act(() => result.current[1]("dark"));

        expect(result.current[0]).toBe("dark");
        expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    });
});
