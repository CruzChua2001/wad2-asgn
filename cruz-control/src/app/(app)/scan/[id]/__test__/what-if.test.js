import { describe, test, expect } from "vitest";
import { projectScore } from "../what-if";

const WEIGHTS = { critical: 10, high: 7.5, medium: 5, low: 2.5 };

const check = (id, risk, score, status = "ok") => ({
    id,
    category: "ports",
    label: `Label ${id}`,
    risk,
    weight: WEIGHTS[risk],
    score: status === "ok" ? score : null,
    status,
    gain: 0,
});

// Ran: 10 x 0, 7.5 x 5, 5 x 0, 7.5 x 10, 10 x 10 = 212.5 out of 400, so 53, capped at 50
const checks = [
    check("ports-database-telnet", "critical", 0),
    check("ports-remote-access", "high", 5),
    check("email-spoofing", "medium", 0),
    check("cert-validity", "high", 10),
    check("software-kev", "critical", 10),
    check("web-headers", "medium", null, "unavailable"),
    check("email-caa", "low", null, "not_checked"),
];

const findings = [
    { id: "port-27017", checkId: "ports-database-telnet" },
    { id: "port-22", checkId: "ports-remote-access" },
    { id: "port-3389", checkId: "ports-remote-access" },
    { id: "dns-dmarc", checkId: "email-spoofing" },
    { id: "web-csp", checkId: "web-headers" },
    { id: "dns-caa", checkId: "email-caa" },
    { id: "repo-archived", checkId: null },
];

const plan = ids => projectScore(checks, findings, ids);

describe("projectScore", () => {
    test("nothing planned keeps the current score", () => {
        expect(plan([])).toEqual({
            score: 50,
            uncappedScore: 53,
            capped: true,
            grade: "F",
            gain: 0,
            fixedCheckIds: [],
            partialCheckIds: [],
        });
    });

    test("fixing the only critical problem lifts the cap", () => {
        // 312.5 out of 400 is 78.1
        expect(plan(["port-27017"])).toEqual({
            score: 78,
            uncappedScore: 78,
            capped: false,
            grade: "C",
            gain: 28,
            fixedCheckIds: ["ports-database-telnet"],
            partialCheckIds: [],
        });
    });

    test("a fix that isn't the critical one stays capped at 50", () => {
        const result = plan(["dns-dmarc"]);

        expect(result.score).toBe(50);
        expect(result.uncappedScore).toBe(66);
        expect(result.capped).toBe(true);
        expect(result.gain).toBe(0);
        expect(result.fixedCheckIds).toEqual(["email-spoofing"]);
    });

    test("a shared check only counts once every finding on it is planned", () => {
        const one = plan(["port-22"]);

        expect(one.partialCheckIds).toEqual(["ports-remote-access"]);
        expect(one.fixedCheckIds).toEqual([]);
        expect(one.uncappedScore).toBe(53);

        // 250 out of 400 is 62.5, which rounds up like the backend
        const both = plan(["port-22", "port-3389"]);

        expect(both.partialCheckIds).toEqual([]);
        expect(both.fixedCheckIds).toEqual(["ports-remote-access"]);
        expect(both.uncappedScore).toBe(63);
        expect(both.score).toBe(50);
    });

    test("findings with no check, or an unknown id, change nothing", () => {
        expect(plan(["repo-archived", "not-a-finding"])).toEqual(plan([]));
    });

    test("checks that didn't run are left out", () => {
        const result = plan(["web-csp", "dns-caa"]);

        expect(result.fixedCheckIds).toEqual([]);
        expect(result.partialCheckIds).toEqual([]);
        expect(result.uncappedScore).toBe(53);
    });

    test("fixing everything that ran gives 100", () => {
        const result = plan(["port-27017", "port-22", "port-3389", "dns-dmarc"]);

        expect(result.score).toBe(100);
        expect(result.grade).toBe("A");
        expect(result.gain).toBe(50);
    });

    test("with two critical problems, fixing one stays capped while the uncapped score rises", () => {
        const twoCritical = checks.map(item => (item.id === "software-kev" ? { ...item, score: 0 } : item));
        const withKev = [...findings, { id: "cve-exploited", checkId: "software-kev" }];

        // 112.5 out of 400 is 28, under the cap already
        expect(projectScore(twoCritical, withKev, []).score).toBe(28);

        const one = projectScore(twoCritical, withKev, ["port-27017"]);

        expect(one.uncappedScore).toBe(53);
        expect(one.score).toBe(50);
        expect(one.capped).toBe(true);
        expect(one.gain).toBe(22);

        const both = projectScore(twoCritical, withKev, ["port-27017", "cve-exploited"]);

        expect(both.score).toBe(78);
        expect(both.capped).toBe(false);
    });

    test("takes a Set or an array", () => {
        const ids = ["port-27017", "port-22"];

        expect(projectScore(checks, findings, new Set(ids))).toEqual(plan(ids));
    });

    test("doesn't change the checks it was given", () => {
        plan(["port-27017"]);

        expect(checks[0].score).toBe(0);
    });

    test("no checks that ran gives 0", () => {
        expect(projectScore([], [], [])).toEqual({
            score: 0,
            uncappedScore: 0,
            capped: false,
            grade: "F",
            gain: 0,
            fixedCheckIds: [],
            partialCheckIds: [],
        });

        expect(projectScore([checks[5], checks[6]], findings, ["web-csp"]).score).toBe(0);
    });

    test("grade changes at 90, 80 and 60", () => {
        const gradeAt = score => projectScore([check("cert-validity", "high", score)], [], []);

        expect(gradeAt(8.9)).toMatchObject({ score: 89, grade: "B" });
        expect(gradeAt(9)).toMatchObject({ score: 90, grade: "A" });
        expect(gradeAt(7.9)).toMatchObject({ score: 79, grade: "C" });
        expect(gradeAt(8)).toMatchObject({ score: 80, grade: "B" });
        expect(gradeAt(5.9)).toMatchObject({ score: 59, grade: "F" });
        expect(gradeAt(6)).toMatchObject({ score: 60, grade: "D" });
    });
});
