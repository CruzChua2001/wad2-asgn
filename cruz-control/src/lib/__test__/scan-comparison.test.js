import { describe, test, expect } from "vitest";
import { compareScans, sameTargets, targetKey, newestFirst } from "../scan-comparison";

const finding = (id = "web-csp", extra = {}) => ({ id, title: id, kind: "issue", severity: "high", checkId: "csp", details: {}, ...extra });
const scan = (id, extra = {}) => ({
    id, created_at: id === "old" ? "2026-10-28T12:00:00Z" : "2026-10-30T12:00:00Z",
    domain_scans: { domain: "example.com", created_at: "2026-10-28T11:00:00Z" }, repo_scans: null,
    score: 0, grade: null, findings: [], checks: [{ id: "csp", status: "ok" }], ...extra,
});

describe("target matching", () => {
    test("normalizes case, whitespace and a DNS trailing dot; supports raw and summary shapes", () => {
        expect(sameTargets(scan("old"), { domain: " EXAMPLE.COM. ", github_repo: null })).toBe(true);
        expect(sameTargets({ domain: null, github_repo: "Owner/Repo" }, { domain: null, github_repo: "owner/repo" })).toBe(true);
    });
    test("requires the complete target combination and scope, preserving subdomains", () => {
        const a = scan("old");
        for (const b of [{ domain: "www.example.com", github_repo: null }, { domain: "example.com", github_repo: "owner/repo" }, { domain: null, github_repo: "owner/repo" }, { domain: "example.com" }]) {
            expect(sameTargets(a, b)).toBe(false);
        }
        expect(targetKey({ domain: null, github_repo: null })).toBeNull();
        expect(targetKey({ domain_scans: {}, repo_scans: { github_repo: "a/b" } })).toBeNull();
    });
    test("matches repo-only and combined full results to their history metadata", () => {
        expect(sameTargets({ domain_scans: null, repo_scans: { github_repo: "Owner/Repo" } }, { domain: null, github_repo: "owner/repo" })).toBe(true);
        expect(sameTargets({ domain_scans: { domain: "example.com" }, repo_scans: { github_repo: "Owner/Repo" } }, { domain: "example.com", github_repo: "owner/repo" })).toBe(true);
    });
});

describe("comparison rules", () => {
    test("orders dates, preserves zero scores/null grades and does not mutate input", () => {
        const old = scan("old");
        const newer = scan("new", { score: 25 });
        const result = compareScans(newer, old);
        expect(result.older).toBe(old);
        expect(result.newer).toBe(newer);
        expect(result.delta).toBe(25);
        expect(result.older.grade).toBeNull();
        expect(newestFirst([old, newer])).toEqual([newer, old]);
    });
    test("rejects same ID, different targets and invalid dates", () => {
        expect(compareScans(scan("old"), scan("old")).error).toMatch(/different scans/);
        expect(compareScans(scan("old"), scan("new", { repo_scans: { github_repo: "a/b" } })).error).toMatch(/targets/);
        expect(compareScans(scan("old"), scan("new", { created_at: null })).error).toMatch(/date/);
    });
    test("matches stable IDs regardless of order or wording and groups arrivals/departures", () => {
        const result = compareScans(scan("old", { findings: [finding("gone"), finding("same")] }), scan("new", { findings: [finding("same", { title: "Renamed" }), finding("new", { kind: "recommendation" })] }));
        expect(Object.fromEntries(result.rows.map(row => [row.id, row.status]))).toEqual({ gone: "gone", same: "present", new: "new" });
        expect(result.rows.find(row => row.id === "new").finding.kind).toBe("recommendation");
    });
    test.each(["unavailable", "not_checked", undefined])("%s coverage cannot prove either an arrival or resolution", status => {
        const checks = status ? [{ id: "csp", status }] : [];
        for (const [oldFindings, newFindings] of [[[finding()], []], [[], [finding()]]]) {
            for (const missingSide of ["old", "new"]) {
                const result = compareScans(scan("old", { findings: oldFindings, ...(missingSide === "old" ? { checks } : {}) }), scan("new", { findings: newFindings, ...(missingSide === "new" ? { checks } : {}) }));
                expect(result.rows[0].status).toBe("uncertain");
            }
        }
    });
    test("null checkId recommendations stay uncertain", () => {
        const result = compareScans(scan("old", { findings: [finding("archived", { checkId: null, kind: "recommendation" })] }), scan("new"));
        expect(result.rows[0].status).toBe("uncertain");
    });
    test("evidence ignores array/object order and incidental timestamps", () => {
        const a = finding("cve", { hosts: ["2", "1"], details: { cves: [{ id: "B" }, { id: "A" }], fetched_at: "yesterday" } });
        const b = finding("cve", { hosts: ["1", "2"], details: { fetched_at: "today", cves: [{ id: "A" }, { id: "B" }] } });
        expect(compareScans(scan("old", { findings: [a] }), scan("new", { findings: [b] })).rows[0].status).toBe("present");
    });
    test.each([{ severity: "critical" }, { hosts: ["new-ip"] }, { details: { cves: ["new-CVE"] } }])("detects meaningful evidence change %j even under the same ID", change => {
        expect(compareScans(scan("old", { findings: [finding()] }), scan("new", { findings: [finding("web-csp", change)] })).rows[0].status).toBe("changed");
    });
    test("flags shared captures, handles empty findings and missing score", () => {
        const result = compareScans(scan("old"), scan("new", { score: null }));
        expect(result.reusedSources).toEqual(["domain"]);
        expect(result.rows).toEqual([]);
        expect(result.delta).toBeNull();
    });
    test("a lower newer score produces a negative delta, and fresh captures are not marked shared", () => {
        const result = compareScans(scan("old", { score: 50 }), scan("new", { score: 0, domain_scans: { domain: "example.com", created_at: "2026-10-30T11:00:00Z" } }));
        expect(result.delta).toBe(-50);
        expect(result.reusedSources).toEqual([]);
    });
});
