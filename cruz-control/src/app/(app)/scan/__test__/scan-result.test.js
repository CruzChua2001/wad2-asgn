import { describe, it, expect } from "vitest";
import { getRating, toResult } from "../scan-result";

describe("scan-result", () => {
    it("getRating gives the right rating for high, middle and low scores", () => {
        expect(getRating(85)).toBe("Good");
        expect(getRating(65)).toBe("Needs work");
        expect(getRating(30)).toBe("At risk");
    });

    it("toResult turns a domain scan into servers, findings and a score", () => {
        const data = {
            score: 55,
            grade: "F",
            checks: [{ id: "ports", gain: 10 }],
            findings: [
                { id: "port-3306", checkId: "ports", severity: "critical", source: "domain", hosts: ["1.1.1.1"] },
            ],
            domain_scans: {
                domain: "example.com",
                created_at: new Date().toISOString(),
                result: {
                    checks: { geo: "ok" },
                    records: {
                        a: ["1.1.1.1"],
                        subdomains: [],
                        ports: [{ ip: "1.1.1.1", ports: [3306] }],
                        geo: [{ ip: "1.1.1.1", status: "ok", city: "Singapore", country: "Singapore", lat: 1.3, lon: 103.8 }],
                    },
                },
            },
        };

        const result = toResult(data);

        expect(result.title).toBe("example.com");
        expect(result.nodes[0].status).toBe("critical");
        expect(result.findings[0].source).toBe("Website");
        expect(result.findings[0].gain).toBe(10);
        expect(result.rating).toBe("Grade F · At risk");
    });

    it("toResult handles a repo-only scan with no servers", () => {
        const data = {
            score: 90,
            grade: "A",
            findings: [],
            checks: [],
            repo_scans: {
                github_repo: "octocat/hello-world",
                created_at: new Date().toISOString(),
                result: { records: { dependencies: [], sensitiveFiles: [] } },
            },
        };

        const result = toResult(data);

        expect(result.title).toBe("octocat/hello-world");
        expect(result.nodes).toEqual([]);
        expect(result.rating).toBe("Grade A · Good");
    });
});
