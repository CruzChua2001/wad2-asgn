const { test } = require("node:test");
const assert = require("node:assert/strict");

// Replace dependencies before loading the controller: no credentials or network.
const dbPath = require.resolve("../lib/supabase");
const findingsPath = require.resolve("../lib/findings");
let answer;
const calls = [];
const query = {
    select(fields) { calls.push(["select", fields]); return this; },
    eq(...args) { calls.push(["eq", ...args]); return this; },
    order(...args) { calls.push(["order", ...args]); return Promise.resolve(answer); },
};
require.cache[dbPath] = { exports: { supabase: { from(table) { calls.push(["from", table]); return query; } } } };
require.cache[findingsPath] = { exports: { buildFindings: () => ({ score: 0, grade: null }) } };
const { getScansByProjectId } = require("../controllers/projectController");

test("history preserves summary fields and adds saved targets/capture dates without returning raw results", async () => {
    calls.length = 0;
    answer = { data: [
        { id: "new", created_at: "2026-10-30", domain_scans: { domain: "example.com", created_at: "2026-10-29", result: {} }, repo_scans: null },
        { id: "old", created_at: "2026-10-28", domain_scans: null, repo_scans: { github_repo: "owner/repo", result: {} } },
        { id: "both", created_at: "2026-10-27", domain_scans: { domain: "example.org", created_at: "2026-10-26", result: {} }, repo_scans: { github_repo: "owner/both", created_at: "2026-10-25", result: {} } },
    ] };
    let body;
    await getScansByProjectId({ params: { id: "project-1" } }, { json: data => { body = data; } });
    assert.deepEqual(body, [
        { id: "new", created_at: "2026-10-30", score: 0, grade: null, domain: "example.com", github_repo: null, domain_captured_at: "2026-10-29", repo_captured_at: null },
        { id: "old", created_at: "2026-10-28", score: 0, grade: null, domain: null, github_repo: "owner/repo", domain_captured_at: null, repo_captured_at: null },
        { id: "both", created_at: "2026-10-27", score: 0, grade: null, domain: "example.org", github_repo: "owner/both", domain_captured_at: "2026-10-26", repo_captured_at: "2026-10-25" },
    ]);
    assert.deepEqual(calls, [
        ["from", "scans"],
        ["select", "id, created_at, domain_scans(domain, result, created_at), repo_scans(github_repo, result, created_at)"],
        ["eq", "project_id", "project-1"], ["order", "created_at", { ascending: false }],
    ]);
});

test("history with no records still returns an empty array", async () => {
    answer = { data: [] };
    let body;
    await getScansByProjectId({ params: { id: "empty" } }, { json: data => { body = data; } });
    assert.deepEqual(body, []);
});
