const RISK_WEIGHTS = { critical: 10, high: 7.5, medium: 5, low: 2.5 };

const CATEGORY_LABELS = {
    software: "Server software",
    ports: "Open ports",
    "email-dns": "Email & DNS",
    certificate: "Certificate (HTTPS)",
    "web-settings": "Website security settings",
    secrets: "Secret files",
    packages: "Packages",
    "repo-basics": "Repo basics",
    "ignore-rules": "Ignore rules",
    readme: "README",
    workflows: "CI workflows",
};

// Every scored check, from the check tables in the manifest
const CHECKS = {
    "software-kev": { category: "software", label: "Actively exploited bugs", risk: "critical" },
    "software-serious": { category: "software", label: "Serious known bugs (CVSS 7+)", risk: "high" },
    "software-other": { category: "software", label: "Other known bugs", risk: "medium" },
    "ports-database-telnet": { category: "ports", label: "Database or Telnet port open", risk: "critical" },
    "ports-remote-access": { category: "ports", label: "Remote access ports", risk: "high" },
    "email-spoofing": { category: "email-dns", label: "Email spoofing protection", risk: "medium" },
    "email-caa": { category: "email-dns", label: "CAA record", risk: "low" },
    "cert-validity": { category: "certificate", label: "HTTPS certificate", risk: "high" },
    "web-https-hsts": { category: "web-settings", label: "HTTPS redirect and HSTS", risk: "high" },
    "web-headers": { category: "web-settings", label: "Security headers", risk: "medium" },
    "secrets-files": { category: "secrets", label: "Secret files", risk: "critical" },
    "packages-vulns": { category: "packages", label: "Vulnerable packages", risk: "high" },
    "basics-dependabot": { category: "repo-basics", label: "Dependabot or Renovate", risk: "high" },
    "basics-security-policy": { category: "repo-basics", label: "Security policy (SECURITY.md)", risk: "medium" },
    "basics-lockfile": { category: "repo-basics", label: "Lockfile", risk: "medium" },
    "ignore-rules": { category: "ignore-rules", label: ".gitignore rules", risk: "medium" },
    readme: { category: "readme", label: "README", risk: "low" },
    "workflow-dangerous": { category: "workflows", label: "Workflows running text anyone can write", risk: "high" },
    "workflow-permissions": { category: "workflows", label: "Workflow token permissions", risk: "high" },
    "workflow-pinned": { category: "workflows", label: "Actions pinned to a commit", risk: "medium" },
};

// A missing status means an older scan that never ran the check, and not_applicable means there was nothing to check
const statusOf = status => {
    if (status === undefined || status === "not_applicable") return "not_checked";
    if (status === "unavailable") return "unavailable";
    return "ok";
}

// Each check is scored from its findings, so the score moves the way the findings say
const getDomainChecks = (result, findings) => {
    const { checks } = result;
    const has = id => findings.some(finding => finding.id === id);
    const count = checkId => findings.filter(finding => finding.checkId === checkId).length;

    // No servers means there was nothing for Shodan to check, unless the DNS lookup itself failed
    let ports = statusOf(checks.ports);
    if ((result.records.ports ?? []).length === 0) {
        ports = checks.a === "unavailable" || checks.aaaa === "unavailable" ? "unavailable" : "not_checked";
    }

    // Without Shodan's ports there are no cve ids to look up, so the software checks didn't run either
    let software = ports;
    if (ports === "ok" && checks.cves === "unavailable") {
        software = "unavailable";
    }
    const email = checks.txt === "unavailable" || checks.dmarc === "unavailable" ? "unavailable" : "ok";

    // No HTTPS at all is scored by the redirect check instead
    const certificate = checks.certificate === "none" ? "not_checked" : statusOf(checks.certificate);
    const headers = checks.headers === "none" ? "not_checked" : statusOf(checks.headers);

    const otherCves = findings.find(finding => finding.id === "cve-other")?.details.cves.length ?? 0;

    let remoteAccess = 10;
    if (has("port-21") || has("port-3389")) {
        remoteAccess = 0;
    } else if (has("port-22")) {
        remoteAccess = 5;
    }

    let cert = 10;
    if (has("cert-invalid")) {
        cert = 0;
    } else if (has("cert-expiring") || has("cert-weak")) {
        cert = 5;
    }

    const missingHeaders = count("web-headers");

    return [
        { id: "software-kev", status: software, score: has("cve-exploited") ? 0 : 10 },
        { id: "software-serious", status: software, score: has("cve-serious") ? 0 : 10 },
        { id: "software-other", status: software, score: Math.max(0, 10 - otherCves) },
        { id: "ports-database-telnet", status: ports, score: count("ports-database-telnet") > 0 ? 0 : 10 },
        { id: "ports-remote-access", status: ports, score: remoteAccess },
        { id: "email-spoofing", status: email, score: [10, 5, 0][count("email-spoofing")] },
        { id: "email-caa", status: statusOf(checks.caa), score: has("dns-caa") ? 0 : 10 },
        { id: "cert-validity", status: certificate, score: cert },
        { id: "web-https-hsts", status: headers, score: [10, 5, 0][count("web-https-hsts")] },
        { id: "web-headers", status: headers, score: missingHeaders === 0 ? 10 : missingHeaders === 3 ? 0 : 5 },
    ];
}

const getRepoChecks = (result, findings) => {
    const { records, checks } = result;
    const has = id => findings.some(finding => finding.id === id);
    const missing = id => findings.find(finding => finding.id === id)?.details.missing.length ?? 0;

    const files = statusOf(checks.files);

    // Dependabot and the lockfile only matter when there is a package.json
    const noPackageJson = records.basics?.packageJson === false;
    const npmFiles = files === "ok" && noPackageJson ? "not_checked" : files;

    // Packages only count when there's a package.json (deps also says "none" when it's missing)
    let packages = statusOf(checks.dependencies);
    if (checks.dependencies === "none" && !records.basics?.packageJson) {
        packages = "not_checked";
    }

    const vulns = findings
        .filter(finding => finding.checkId === "packages-vulns")
        .reduce((sum, finding) => sum + finding.details.vulns.length, 0);

    // Partial credit: a missing Dependabot costs less while there are no known vulnerabilities
    let dependabot = 10;
    if (has("repo-dependabot")) {
        dependabot = vulns > 0 ? 0 : 5;
    }

    const missingIgnores = missing("repo-gitignore");
    const missingReadme = missing("repo-readme");

    // CI workflows are scored from the raw results, since the scores are shares of all files and actions
    const workflows = records.workflows;
    let dangerous = 10;
    let permissions = 10;
    let pinned = 10;

    if (workflows) {
        dangerous = workflows.dangerous.length > 0 ? 0 : 10;
        if (workflows.files.length > 0) {
            permissions = Math.round(10 * (workflows.files.length - workflows.noPermissions.length) / workflows.files.length);
        }
        if (workflows.thirdPartyCount > 0) {
            pinned = Math.round(10 * (workflows.thirdPartyCount - workflows.unpinned.length) / workflows.thirdPartyCount);
        }
    }

    return [
        { id: "secrets-files", status: files, score: has("repo-secrets") ? 0 : 10 },
        { id: "packages-vulns", status: packages, score: Math.max(0, 10 - vulns) },
        { id: "basics-dependabot", status: npmFiles, score: dependabot },
        { id: "basics-security-policy", status: files, score: has("repo-security-policy") ? 0 : 10 },
        { id: "basics-lockfile", status: npmFiles, score: has("repo-lockfile") ? 0 : 10 },
        { id: "ignore-rules", status: statusOf(checks.gitignore), score: missingIgnores === 0 ? 10 : missingIgnores === 3 ? 0 : 5 },
        { id: "readme", status: statusOf(checks.readme), score: [10, 5, 0][missingReadme] },
        { id: "workflow-dangerous", status: statusOf(checks.workflows), score: dangerous },
        { id: "workflow-permissions", status: statusOf(checks.workflows), score: permissions },
        { id: "workflow-pinned", status: statusOf(checks.workflows), score: pinned },
    ];
}

const getGrade = score => {
    if (score >= 90) return "A";
    if (score >= 80) return "B";
    if (score >= 70) return "C";
    if (score >= 60) return "D";
    return "F";
}

/**
 * Weighted average of the checks that ran (OpenSSF Scorecard's method), capped at 50 while a critical check scores 0
 */
const scoreOf = checks => {
    const ran = checks.filter(check => check.status === "ok");
    const totalWeight = ran.reduce((sum, check) => sum + check.weight, 0);
    const earned = ran.reduce((sum, check) => sum + check.weight * check.score, 0);

    const uncappedScore = totalWeight > 0 ? Math.round(10 * earned / totalWeight) : 0;

    const capIds = ran.filter(check => check.risk === "critical" && check.score === 0).map(check => check.id);
    const score = capIds.length > 0 ? Math.min(50, uncappedScore) : uncappedScore;

    return { score, uncappedScore, capIds };
}

const getScore = checkResults => {
    const checks = checkResults.map(item => {
        const check = CHECKS[item.id];

        return {
            id: item.id,
            category: check.category,
            label: check.label,
            risk: check.risk,
            weight: RISK_WEIGHTS[check.risk],
            score: item.status === "ok" ? item.score : null,
            status: item.status,
        };
    });

    const { score, uncappedScore, capIds } = scoreOf(checks);

    // Points the score would rise if this check scored 10, cap included
    for (const check of checks) {
        check.gain = 0;
        if (check.status === "ok" && check.score < 10) {
            const fixed = checks.map(other => (other.id === check.id ? { ...other, score: 10 } : other));
            check.gain = scoreOf(fixed).score - score;
        }
    }

    const totalWeight = checks.filter(check => check.status === "ok").reduce((sum, check) => sum + check.weight, 0);

    // A critical check that couldn't run means we can't give a fair grade
    const incomplete = checks.some(check => check.risk === "critical" && check.status === "unavailable");

    // Points lost per category, which add up to 100 minus the uncapped score
    const categories = [...new Set(checks.map(check => check.category))];

    const breakdown = categories.map(category => {
        const inCategory = checks.filter(check => check.category === category);
        const lost = inCategory
            .filter(check => check.status === "ok")
            .reduce((sum, check) => sum + check.weight * (10 - check.score), 0);

        let status = "not_checked";
        if (inCategory.some(check => check.status === "ok")) {
            status = "ok";
        } else if (inCategory.some(check => check.status === "unavailable")) {
            status = "unavailable";
        }

        return {
            category,
            label: CATEGORY_LABELS[category],
            lost: totalWeight > 0 ? 10 * lost / totalWeight : 0,
            status,
        };
    });

    // Round down, then give the points left over to the biggest remainders, so the total still matches
    let left = totalWeight > 0 ? 100 - uncappedScore - breakdown.reduce((sum, item) => sum + Math.floor(item.lost), 0) : 0;

    for (const item of [...breakdown].sort((a, b) => b.lost % 1 - a.lost % 1)) {
        item.lost = Math.floor(item.lost) + (left > 0 ? 1 : 0);
        left--;
    }

    breakdown.sort((a, b) => b.lost - a.lost);

    return {
        score,
        grade: incomplete ? null : getGrade(score),
        uncappedScore,
        cap: { applied: capIds.length > 0, checkIds: capIds },
        incomplete,
        breakdown,
        checks,
    };
}

module.exports = { getDomainChecks, getRepoChecks, getScore };
