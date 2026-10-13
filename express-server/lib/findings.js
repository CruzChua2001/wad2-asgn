const RISKY_PORTS = {
    21: { name: "FTP (file transfer)", severity: "high" },
    22: { name: "SSH (remote login)", severity: "medium" },
    23: { name: "Telnet (remote login)", severity: "critical" },
    3389: { name: "Remote Desktop", severity: "high" },
    3306: { name: "MySQL database", severity: "critical" },
    5432: { name: "PostgreSQL database", severity: "critical" },
    1433: { name: "SQL Server database", severity: "critical" },
    27017: { name: "MongoDB database", severity: "critical" },
    6379: { name: "Redis database", severity: "critical" },
    9200: { name: "Elasticsearch database", severity: "critical" },
};

const PENALTY = { critical: 25, high: 15, medium: 8, low: 3 };

const CATEGORY_LABELS = {
    software: "Server software",
    ports: "Open ports",
    "email-dns": "Email & DNS",
    secrets: "Secret files",
    packages: "Packages",
    "repo-basics": "Repo basics",
};

const DOMAIN_CATEGORIES = ["software", "ports", "email-dns"];
const REPO_CATEGORIES = ["secrets", "packages", "repo-basics"];

const getDomainFindings = result => {
    const { records, checks } = result;
    const findings = [];

    // Known vulnerabilities (CVE) in software on server
    let exploited = [];
    let serious = [];
    let other = []

    if (records.cves) {
        for (let cve of records.cves) {
            if (cve.kev) {
                exploited.push(cve.id);
            } else if (cve.cvss >= 7) {
                serious.push(cve.id);
            } else {
                other.push(cve.id);
            }
        }
    }

    if (exploited.length > 0) {
        findings.push({
            id: "cve-exploited",
            category: "software",
            checkId: "software-kev",
            kind: "issue",
            severity: "critical",
            title: `${exploited.length} known bug(s) attackers are already using`,
            explain: "Your servers run software with bugs that are being used in real attacks right now.",
            fix: "Update the software on these servers to the latest version as soon as possible.",
            source: "domain",
            cves: exploited,
        });
    }

    if (serious.length > 0) {
        findings.push({
            id: "cve-serious",
            category: "software",
            checkId: "software-serious",
            kind: "issue",
            severity: "high",
            title: `${serious.length} serious known bug(s) in server software`,
            explain: "Your servers run software versions with publicly known, high-risk bugs.",
            fix: "Update the software on these servers to the latest version.",
            source: "domain",
            cves: serious,
        });
    }

    if (other.length > 0) {
        findings.push({
            id: "cve-other",
            category: "software",
            checkId: "software-other",
            kind: "issue",
            severity: "medium",
            title: `${other.length} smaller known bug(s) in server software`,
            explain: "Your servers run software versions with publicly known bugs that are less likely to be used in attacks.",
            fix: "Plan to update the software on these servers.",
            source: "domain",
            cves: other,
        });
    }

    // Risky open ports, one finding per port (CDN edge IPs excluded)
    const cdn = new Set(records.cdnIps ?? []);
    for (let port in RISKY_PORTS) {
        const servers = (records.ports ?? []).filter(item => item.ports.includes(Number(port)) && !cdn.has(item.ip));

        if (servers.length === 0) {
            continue;
        }

        const { name, severity } = RISKY_PORTS[port];

        findings.push({
            id: `port-${port}`,
            category: "ports",
            checkId: severity === "critical" ? "ports-database-telnet" : "ports-remote-access",
            kind: "issue",
            severity,
            title: `${name} is open to the internet`,
            explain: `Port ${port} is reachable on ${servers.length} server(s), so anyone online can try to break in.`,
            fix: `Close port ${port} in your firewall, or only allow access through a VPN.`,
            source: "domain",
            hosts: servers.map(item => item.ip),
        })
    }

    // Email protection (stops people sending fake emails from the domain)
    if (!records.spf && checks.txt !== "unavailable") {
        findings.push({
            id: "dns-spf",
            category: "email-dns",
            checkId: "email-spoofing",
            kind: "issue",
            severity: "medium",
            title: "No SPF record",
            explain: "SPF tells email providers which servers may send email for your domain. Without it, scammers can fake your address more easily.",
            fix: "Add a TXT record starting with v=spf1 that lists your email provider.",
            source: "domain",
        });
    }

    if (!records.dmarc && checks.dmarc !== "unavailable") {
        findings.push({
            id: "dns-dmarc",
            category: "email-dns",
            checkId: "email-spoofing",
            kind: "issue",
            severity: "medium",
            title: "No DMARC record",
            explain: "DMARC tells email providers what to do with fake emails using your domain. Without it, they may still be delivered.",
            fix: "Add a TXT record at _dmarc.yourdomain starting with v=DMARC1; p=none, then tighten it to p=quarantine.",
            source: "domain",
        });
    } else if (/p=none/i.test(records.dmarc ?? "")) {
        findings.push({
            id: "dns-dmarc-weak",
            category: "email-dns",
            checkId: "email-spoofing",
            kind: "issue",
            severity: "low",
            title: "DMARC only monitors",
            explain: "Your DMARC policy is p=none, so fake emails are reported but still delivered.",
            fix: "Change your DMARC policy to p=quarantine or p=reject.",
            source: "domain",
        });
    }

    // CAA - limits who can issue HTTPS certificates for the domains
    if (checks.caa === "none") {
        findings.push({
            id: "dns-caa",
            category: "email-dns",
            checkId: "email-caa",
            kind: "recommendation",
            severity: "low",
            title: "No CAA record",
            explain: "Any certificate authority could issue an HTTPS certificate for your domain.",
            fix: "Add a CAA record that only allows the certificate authority you use (e.g. letsencrypt.org).",
            source: "domain",
        });
    }

    return findings;
}

const getRepoFindings = result => {
    const { records } = result;
    let findings = []

    // Secret files committed
    if (records.sensitiveFiles?.length > 0) {
        findings.push({
            id: "repo-secrets",
            category: "secrets",
            checkId: "secrets-files",
            kind: "issue",
            severity: "critical",
            title: "Secret files are committed to the repo",
            explain: `${records.sensitiveFiles.length} file(s) like .env or private keys are public. Anyone can download them and use the passwords or keys inside.`,
            fix: "Delete the files, add them to .gitignore, then change (rotate) every password or key inside. They stay in the git history, so deleting alone isn't enough.",
            source: "repo",
            files: records.sensitiveFiles,
        });
    }

    // Dependencies with known vulnerabilities
    for (let pkg of records.dependencies ?? []) {
        findings.push({
            id: `dep-${pkg.name}`,
            category: "packages",
            checkId: "packages-vulns",
            kind: "issue",
            severity: "high",
            title: `${pkg.name} ${pkg.version} has known vulnerabilities`,
            explain: `This package has ${pkg.vulns.length} known security bug(s): ${pkg.vulns.join(", ")}.`,
            fix: `Run npm install ${pkg.name}@latest (or npm audit fix), then check your app still works.`,
            source: "repo",
        });
    }

    // Basic security
    const basics = records.basics;
    if (basics && !basics.securityPolicy) {
        findings.push({
            id: "repo-security-policy",
            category: "repo-basics",
            checkId: "basics-security-policy",
            kind: "recommendation",
            severity: "low",
            title: "No security policy (SECURITY.md)",
            explain: "People who find a bug in your project don't know how to report it to you privately.",
            fix: "Add a SECURITY.md file that explains how to report security issues (e.g. an email address).",
            source: "repo",
        });
    }
    if (basics && !basics.dependabot) {
        findings.push({
            id: "repo-dependabot",
            category: "repo-basics",
            checkId: "basics-dependabot",
            kind: "recommendation",
            severity: "low",
            title: "Dependabot is not set up",
            explain: "Dependabot automatically opens pull requests when your packages have security fixes.",
            fix: "Add a .github/dependabot.yml file (GitHub > Insights > Dependency graph > Dependabot).",
            source: "repo",
        });
    }
    if (basics?.packageJson && !basics.lockfile) {
        findings.push({
            id: "repo-lockfile",
            category: "repo-basics",
            checkId: "basics-lockfile",
            kind: "recommendation",
            severity: "low",
            title: "No lockfile",
            explain: "Without package-lock.json, every install can pick different package versions, including vulnerable ones.",
            fix: "Run npm install and commit the package-lock.json file it creates.",
            source: "repo",
        });
    }

    return findings;
}

const getScore = (findings, categories) => {
    let lost = 0;
    let lostByCategory = {};

    for (let finding of findings) {
        lost += PENALTY[finding.severity];
        lostByCategory[finding.category] = (lostByCategory[finding.category] ?? 0) + PENALTY[finding.severity];
    }

    const score = Math.max(0, 100 - lost);

    const breakdown = categories
        .map(category => ({ category, label: CATEGORY_LABELS[category], lost: lostByCategory[category] ?? 0 }))
        .sort((a, b) => b.lost - a.lost);

    let grade = "F";
    if (score >= 90) grade = "A";
    else if (score >= 80) grade = "B";
    else if (score >= 70) grade = "C";
    else if (score >= 60) grade = "D";

    return { score, grade, breakdown };
}

const buildFindings = scan => {
    let findings = [];
    let categories = [];

    if (scan.domain_scans) {
        findings.push(...getDomainFindings(scan.domain_scans.result));
        categories.push(...DOMAIN_CATEGORIES);
    }

    if (scan.repo_scans) {
        findings.push(...getRepoFindings(scan.repo_scans.result));
        categories.push(...REPO_CATEGORIES);
    }

    return { findings, ...getScore(findings, categories) };
}

module.exports = { getDomainFindings, getRepoFindings, getScore, buildFindings };