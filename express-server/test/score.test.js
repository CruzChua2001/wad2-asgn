const test = require("node:test");
const assert = require("node:assert");
const { buildFindings } = require("../lib/findings");
const { getScore } = require("../lib/score");

// A clean website scan saved before the certificate and headers checks existed
const domainScan = ({ records = {}, checks = {} } = {}) => ({
    domain_scans: {
        result: {
            website: "example.com",
            records: {
                a: ["203.0.113.10"],
                spf: "v=spf1 include:_spf.example.net -all",
                dmarc: "v=DMARC1; p=reject",
                ports: [port(443)],
                cves: [],
                cdnIps: [],
                ...records,
            },
            checks: { ports: "ok", cves: "none", txt: "ok", dmarc: "ok", caa: "ok", ...checks },
        },
    },
});

// A clean repo scan saved before the .gitignore and README checks existed
const repoScan = ({ records = {}, checks = {}, basics = {} } = {}) => ({
    repo_scans: {
        result: {
            repo: "student/app",
            records: {
                repo: { name: "student/app", archived: false },
                sensitiveFiles: [],
                dependencies: [],
                basics: { securityPolicy: true, dependabot: true, lockfile: true, packageJson: true, ...basics },
                ...records,
            },
            checks: { repo: "ok", files: "ok", dependencies: "none", ...checks },
        },
    },
});

const port = (number, vulns = []) => ({ ip: "203.0.113.10", ports: [number], vulns, tags: [] });
const cve = (id, cvss, kev = false) => ({ status: "ok", id, cvss, epss: 0.1, kev, summary: "" });

// Worked examples from the manifest's "Our formula" section

test("repo: clean, but no SECURITY.md scores 86, B", () => {
    const result = buildFindings(repoScan({ basics: { securityPolicy: false } }));
    assert.strictEqual(result.score, 86);
    assert.strictEqual(result.grade, "B");
});

test("repo: 3 vulnerabilities and no Dependabot scores 72, C", () => {
    const dependencies = [{ name: "lodash", version: "4.17.0", vulns: ["GHSA-1", "GHSA-2", "GHSA-3"] }];
    const result = buildFindings(repoScan({ records: { dependencies }, checks: { dependencies: "ok" }, basics: { dependabot: false } }));
    assert.strictEqual(result.score, 72);
    assert.strictEqual(result.grade, "C");
});

test("repo: a committed .env is capped at 50, F", () => {
    const result = buildFindings(repoScan({ records: { sensitiveFiles: [".env"] } }));
    assert.strictEqual(result.uncappedScore, 71);
    assert.strictEqual(result.score, 50);
    assert.strictEqual(result.grade, "F");
    assert.deepStrictEqual(result.cap, { applied: true, checkIds: ["secrets-files"] });
});

test("repo: typical student repo scores 75, C", () => {
    const result = buildFindings(repoScan({ basics: { dependabot: false, securityPolicy: false } }));
    assert.strictEqual(result.score, 75);
    assert.strictEqual(result.grade, "C");
});

test("website: clean scores 100, A", () => {
    const result = buildFindings(domainScan());
    assert.strictEqual(result.score, 100);
    assert.strictEqual(result.grade, "A");
});

test("website: DMARC set to monitor only scores 95, A", () => {
    const result = buildFindings(domainScan({ records: { dmarc: "v=DMARC1; p=none" } }));
    assert.strictEqual(result.score, 95);
});

test("website: no SPF and no DMARC scores 89, B", () => {
    const result = buildFindings(domainScan({ records: { spf: null, dmarc: null } }));
    assert.strictEqual(result.score, 89);
    assert.strictEqual(result.grade, "B");
});

test("website: SSH open scores 92, A", () => {
    const result = buildFindings(domainScan({ records: { ports: [port(22)] } }));
    assert.strictEqual(result.score, 92);
});

test("website: 3 serious CVEs score 84, B", () => {
    const ids = ["CVE-2024-0001", "CVE-2024-0002", "CVE-2024-0003"];
    const result = buildFindings(domainScan({
        records: { ports: [port(443, ids)], cves: ids.map(id => cve(id, 9.8)) },
        checks: { cves: "ok" },
    }));
    assert.strictEqual(result.score, 84);
    assert.strictEqual(result.grade, "B");
});

test("website: an open MongoDB port is capped at 50, F", () => {
    const result = buildFindings(domainScan({ records: { ports: [port(27017)] } }));
    assert.strictEqual(result.uncappedScore, 79);
    assert.strictEqual(result.score, 50);
    assert.strictEqual(result.grade, "F");
    assert.deepStrictEqual(result.breakdown[0], { category: "ports", label: "Open ports", earned: 16, lost: 21, worth: 37, status: "ok" });
});

test("website: Shodan unreachable is incomplete, with no grade", () => {
    const unreachable = { status: "unavailable", ip: "203.0.113.10", ports: [], vulns: [], tags: [] };
    const result = buildFindings(domainScan({ records: { ports: [unreachable] }, checks: { ports: "unavailable" } }));
    assert.strictEqual(result.incomplete, true);
    assert.strictEqual(result.grade, null);
    assert.strictEqual(result.breakdown.find(item => item.category === "software").status, "unavailable");
});

test("website: expired certificate, redirect without HSTS and no headers scores 76, C", () => {
    const result = buildFindings(domainScan({
        records: {
            certificate: { issuer: "Let's Encrypt", validTo: "2026-01-01T00:00:00.000Z", daysLeft: -30, trusted: false, error: "CERT_HAS_EXPIRED", selfSigned: false, keyBits: 2048, keyType: "RSA", tlsVersion: "TLSv1.3" },
            headers: { url: "https://example.com/", https: true, httpRedirect: true, hsts: null, csp: null, frameOptions: null, contentType: null },
        },
        checks: { certificate: "ok", headers: "ok" },
    }));
    assert.strictEqual(result.score, 76);
    assert.strictEqual(result.grade, "C");
});

// Certificate and website settings

const goodCert = { issuer: "Let's Encrypt", validTo: "2027-01-01T00:00:00.000Z", daysLeft: 90, trusted: true, error: null, selfSigned: false, keyBits: 2048, keyType: "RSA", tlsVersion: "TLSv1.3" };
const goodHeaders = { url: "https://example.com/", https: true, httpRedirect: true, hsts: "max-age=31536000", csp: "default-src 'self'", frameOptions: "DENY", contentType: "nosniff" };

test("website: good certificate and headers score 100", () => {
    const result = buildFindings(domainScan({
        records: { certificate: goodCert, headers: goodHeaders },
        checks: { certificate: "ok", headers: "ok" },
    }));
    assert.strictEqual(result.findings.length, 0);
    assert.strictEqual(result.score, 100);
});

test("website: a certificate expiring soon scores 5", () => {
    const result = buildFindings(domainScan({
        records: { certificate: { ...goodCert, daysLeft: 12 } },
        checks: { certificate: "ok" },
    }));
    assert.ok(result.findings.some(finding => finding.id === "cert-expiring"));
    assert.strictEqual(result.checks.find(check => check.id === "cert-validity").score, 5);
});

test("website: an old TLS version scores 5", () => {
    const result = buildFindings(domainScan({
        records: { certificate: { ...goodCert, tlsVersion: "TLSv1" } },
        checks: { certificate: "ok" },
    }));
    assert.ok(result.findings.some(finding => finding.id === "cert-weak"));
    assert.strictEqual(result.checks.find(check => check.id === "cert-validity").score, 5);
});

test("website: an http-only site scores 0 on redirect and HSTS", () => {
    const headers = { ...goodHeaders, url: "http://example.com/", https: false, httpRedirect: false, hsts: null };
    const result = buildFindings(domainScan({
        records: { certificate: null, headers },
        checks: { certificate: "none", headers: "ok" },
    }));
    assert.strictEqual(result.checks.find(check => check.id === "web-https-hsts").score, 0);
    assert.strictEqual(result.checks.find(check => check.id === "cert-validity").status, "not_checked");
});

test("website: frame-ancestors in the CSP counts as clickjacking protection", () => {
    const headers = { ...goodHeaders, frameOptions: null, csp: "default-src 'self'; frame-ancestors 'none'" };
    const result = buildFindings(domainScan({ records: { headers }, checks: { headers: "ok" } }));
    assert.ok(!result.findings.some(finding => finding.id === "web-frame-options"));
});

// Other rules

test("breakdown always adds up to the uncapped score and 100", () => {
    // Every mix of 9 website problems, with and without a repo
    for (let mask = 0; mask < 512; mask++) {
        const on = bit => (mask & (1 << bit)) !== 0;
        const ports = [port(443)];
        if (on(0)) ports.push(port(22));
        if (on(1)) ports.push(port(3306));
        const cves = on(2) ? [cve("CVE-2024-0009", 5)] : [];

        const scan = domainScan({
            records: {
                spf: on(3) ? null : "v=spf1 -all",
                dmarc: on(4) ? "v=DMARC1; p=none" : "v=DMARC1; p=reject",
                ports,
                cves,
                certificate: { ...goodCert, daysLeft: on(5) ? 10 : 90 },
                headers: { ...goodHeaders, hsts: on(6) ? null : goodHeaders.hsts, csp: on(7) ? null : goodHeaders.csp },
            },
            checks: { caa: on(8) ? "none" : "ok", cves: cves.length > 0 ? "ok" : "none", certificate: "ok", headers: "ok" },
        });

        for (const withRepo of [false, true]) {
            const result = buildFindings(withRepo ? { ...scan, ...repoScan({ basics: { dependabot: false } }) } : scan);
            const total = key => result.breakdown.reduce((sum, item) => sum + item[key], 0);
            assert.strictEqual(total("lost"), 100 - result.uncappedScore, `mask ${mask}, repo ${withRepo}`);
            assert.strictEqual(total("earned"), result.uncappedScore, `mask ${mask}, repo ${withRepo}`);
            assert.strictEqual(total("worth"), 100, `mask ${mask}, repo ${withRepo}`);

            // A category that scored 0 earns nothing, and a perfect one loses nothing
            for (const item of result.breakdown) {
                const ran = result.checks.filter(check => check.category === item.category && check.status === "ok");
                if (ran.every(check => check.score === 0)) assert.strictEqual(item.earned, 0, `mask ${mask}, ${item.category}`);
                if (ran.every(check => check.score === 10)) assert.strictEqual(item.lost, 0, `mask ${mask}, ${item.category}`);
            }
        }
    }
});

test("breakdown: each category earns points out of what it's worth", () => {
    // smu.edu.sg on 27 Oct: exploited and serious CVEs, FTP open, no CAA, a certificate expiring soon and no CSP
    const ok = (id, score) => ({ id, status: "ok", score });
    const result = getScore([
        ok("software-kev", 0), ok("software-serious", 0), ok("software-other", 0),
        ok("ports-database-telnet", 10), ok("ports-remote-access", 0),
        ok("email-spoofing", 10), ok("email-caa", 0),
        ok("cert-validity", 5), ok("web-https-hsts", 10), ok("web-headers", 5),
    ]);

    assert.strictEqual(result.uncappedScore, 43);
    assert.deepStrictEqual(result.breakdown.map(item => [item.category, item.earned, item.worth, item.lost]), [
        ["software", 0, 33, 33],
        ["ports", 15, 26, 11],
        ["certificate", 6, 11, 5],
        ["email-dns", 7, 11, 4],
        ["web-settings", 15, 19, 4],
    ]);
});

test("a domain with no servers skips the port and software checks", () => {
    const result = buildFindings(domainScan({ records: { ports: [] }, checks: { ports: "unavailable" } }));
    assert.strictEqual(result.incomplete, false);
    assert.strictEqual(result.breakdown.find(item => item.category === "ports").status, "not_checked");
    assert.strictEqual(result.breakdown.find(item => item.category === "software").status, "not_checked");
});

test("a failed DNS lookup makes the scan incomplete instead of skipping the servers", () => {
    const result = buildFindings(domainScan({ records: { a: null, ports: [] }, checks: { a: "unavailable", aaaa: "none" } }));
    assert.strictEqual(result.incomplete, true);
    assert.strictEqual(result.grade, null);
    assert.strictEqual(result.breakdown.find(item => item.category === "ports").status, "unavailable");
});

test("a failed file lookup doesn't count packages as passed", () => {
    const result = buildFindings(repoScan({
        records: { basics: null, gitignore: null, readme: null },
        checks: { files: "unavailable", gitignore: "unavailable", readme: "unavailable", dependencies: "none" },
    }));
    assert.strictEqual(result.checks.find(check => check.id === "packages-vulns").status, "not_checked");
    assert.strictEqual(result.incomplete, true);
    assert.strictEqual(result.grade, null);
});

test("a quoted HSTS max-age is read", () => {
    const headers = { ...goodHeaders, hsts: "max-age=\"31536000\"; includeSubDomains" };
    const result = buildFindings(domainScan({ records: { headers }, checks: { headers: "ok" } }));
    assert.ok(!result.findings.some(finding => finding.id === "web-hsts"));
});

test("a site with a certificate isn't told it has no HTTPS", () => {
    const headers = { ...goodHeaders, url: "http://example.com/", https: false, httpRedirect: false, hsts: null };
    const certificate = { ...goodCert, trusted: false, error: "DEPTH_ZERO_SELF_SIGNED_CERT", selfSigned: true };
    const result = buildFindings(domainScan({ records: { certificate, headers }, checks: { certificate: "ok", headers: "ok" } }));
    assert.strictEqual(result.findings.find(finding => finding.id === "web-https-redirect").title, "HTTP doesn't redirect to HTTPS");
});

test("an archived repo doesn't change the score", () => {
    const result = buildFindings(repoScan({ records: { repo: { name: "student/app", archived: true } } }));
    assert.ok(result.findings.some(finding => finding.id === "repo-archived"));
    assert.strictEqual(result.score, 100);
});

test("older website scans skip the certificate and website settings checks", () => {
    const result = buildFindings(domainScan());
    const statuses = result.breakdown.filter(item => ["certificate", "web-settings"].includes(item.category)).map(item => item.status);
    assert.deepStrictEqual(statuses, ["not_checked", "not_checked"]);
});

test("older repo scans skip the .gitignore and README checks", () => {
    const result = buildFindings(repoScan());
    const statuses = result.checks.filter(check => ["ignore-rules", "readme"].includes(check.id)).map(check => check.status);
    assert.deepStrictEqual(statuses, ["not_checked", "not_checked"]);
});

test("a missing .gitignore and README score 0 on both checks", () => {
    const result = buildFindings(repoScan({
        records: { gitignore: null, readme: null },
        checks: { gitignore: "none", readme: "none" },
    }));
    assert.strictEqual(result.checks.find(check => check.id === "ignore-rules").score, 0);
    assert.strictEqual(result.checks.find(check => check.id === "readme").score, 0);
    assert.strictEqual(result.score, 82);
});

test("a repo without a package.json doesn't need a node_modules rule", () => {
    const result = buildFindings(repoScan({
        records: { gitignore: { env: true, nodeModules: false, keys: true } },
        checks: { gitignore: "ok" },
        basics: { dependabot: false, lockfile: false, packageJson: false },
    }));
    assert.strictEqual(result.findings.some(finding => finding.id === "repo-gitignore"), false);
    assert.strictEqual(result.checks.find(check => check.id === "ignore-rules").score, 10);
});

test("without a package.json, a .gitignore missing .env and key files still scores 0", () => {
    const result = buildFindings(repoScan({
        records: { gitignore: { env: false, nodeModules: false, keys: false } },
        checks: { gitignore: "ok" },
        basics: { dependabot: false, lockfile: false, packageJson: false },
    }));
    assert.deepStrictEqual(result.findings.find(finding => finding.id === "repo-gitignore").details.missing, [".env", "key files"]);
    assert.strictEqual(result.checks.find(check => check.id === "ignore-rules").score, 0);
});

test("Dependabot is skipped without a package.json", () => {
    const result = buildFindings(repoScan({ basics: { dependabot: false, lockfile: false, packageJson: false } }));
    assert.strictEqual(result.checks.find(check => check.id === "basics-dependabot").status, "not_checked");
    assert.strictEqual(result.score, 100);
});

// Fixing gain (T18)

const gainOf = (result, id) => result.checks.find(check => check.id === id).gain;

test("gain: fixing an open MongoDB port also lifts the cap", () => {
    const result = buildFindings(domainScan({ records: { ports: [port(27017)] } }));
    assert.strictEqual(gainOf(result, "ports-database-telnet"), 50);
});

test("gain: other checks are worth 0 while the cap holds", () => {
    const result = buildFindings(domainScan({ records: { ports: [{ ...port(22), ports: [22, 27017] }] } }));
    assert.strictEqual(result.score, 50);
    assert.strictEqual(gainOf(result, "ports-database-telnet"), 42);
    assert.strictEqual(gainOf(result, "ports-remote-access"), 0);
});

test("gain: typical student repo", () => {
    const result = buildFindings(repoScan({ basics: { dependabot: false, securityPolicy: false } }));
    assert.strictEqual(gainOf(result, "basics-dependabot"), 11);
    assert.strictEqual(gainOf(result, "basics-security-policy"), 14);
});

test("gain is 0 for checks that passed or didn't run", () => {
    const result = buildFindings(repoScan({ basics: { securityPolicy: false } }));
    assert.strictEqual(gainOf(result, "secrets-files"), 0);
    assert.strictEqual(gainOf(result, "readme"), 0);
});

// CI workflows (C11)

const workflows = (overrides = {}) => ({ files: ["ci.yml", "deploy.yml"], noPermissions: [], unpinned: [], thirdPartyCount: 0, dangerous: [], ...overrides });
const workflowChecks = result => result.checks.filter(check => check.category === "workflows");

test("workflows: older scans and repos without workflows skip the three checks", () => {
    const scans = [repoScan(), repoScan({ records: { workflows: null }, checks: { workflows: "not_applicable" } })];
    for (const scan of scans) {
        const result = buildFindings(scan);
        assert.deepStrictEqual(workflowChecks(result).map(check => check.status), ["not_checked", "not_checked", "not_checked"]);
        assert.strictEqual(result.score, 100);
    }
});

test("workflows: safe workflows score 10 on all three checks", () => {
    const result = buildFindings(repoScan({ records: { workflows: workflows() }, checks: { workflows: "ok" } }));
    assert.deepStrictEqual(workflowChecks(result).map(check => check.score), [10, 10, 10]);
    assert.strictEqual(result.score, 100);
});

test("workflows: scores are shares of the files and actions, with no cap", () => {
    const result = buildFindings(repoScan({
        records: {
            workflows: workflows({
                noPermissions: ["deploy.yml"],
                unpinned: [{ file: "ci.yml", uses: "owner/action@v1" }],
                thirdPartyCount: 3,
                dangerous: [{ file: "ci.yml", line: 12, text: "run: echo ${{ github.event.issue.title }}" }],
            }),
        },
        checks: { workflows: "ok" },
    }));
    assert.deepStrictEqual(workflowChecks(result).map(check => check.score), [0, 5, 7]);
    assert.strictEqual(result.score, 77);
    assert.strictEqual(result.cap.applied, false);
});

test("workflows: a failed lookup isn't counted and doesn't make the scan incomplete", () => {
    const result = buildFindings(repoScan({ records: { workflows: null }, checks: { workflows: "unavailable" } }));
    assert.deepStrictEqual(workflowChecks(result).map(check => check.status), ["unavailable", "unavailable", "unavailable"]);
    assert.strictEqual(result.incomplete, false);
    assert.strictEqual(result.score, 100);
});
