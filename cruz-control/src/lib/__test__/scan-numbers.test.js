import { expect, test } from "vitest";
import { scanNumbers } from "../scan-numbers";

const row = (id, date) => ({ id, created_at: date });
test("numbers complete history oldest first without mutating the input", () => {
    const history = [row("new", "2026-10-30"), row("old", "2026-10-28")];
    expect([...scanNumbers(history)]).toEqual([["old", 1], ["new", 2]]);
    expect(history.map(scan => scan.id)).toEqual(["new", "old"]);
});
test("equal timestamps use deterministic UUID order regardless of API ordering", () => {
    const a = row("aaa", "2026-10-30T10:00:00Z");
    const b = row("bbb", "2026-10-30T10:00:00Z");
    expect([...scanNumbers([b, a])]).toEqual([...scanNumbers([a, b])]);
    expect(scanNumbers([b, a]).get("aaa")).toBe(1);
});
test("a chronologically appended scan preserves every existing display number", () => {
    const history = [row("b", "2026-10-28"), row("a", "2026-10-28"), row("c", "2026-10-29")];
    const before = scanNumbers(history);
    const after = scanNumbers([row("0-new", "2026-10-30"), ...history]);
    for (const [id, number] of before) expect(after.get(id)).toBe(number);
    expect(after.get("0-new")).toBe(4);
});
test("filtered scans retain their complete-history labels and deletion is not immutable", () => {
    const history = [row("a", "2026-10-28"), row("b", "2026-10-29"), row("c", "2026-10-30")];
    const numbers = scanNumbers(history);
    expect(history.filter(scan => scan.id !== "b").map(scan => numbers.get(scan.id))).toEqual([1, 3]);
    expect(scanNumbers(history.slice(1)).get("b")).toBe(1);
});
