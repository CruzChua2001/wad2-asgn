const { checkWebsite } = require("./domain");

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

// Shodan matches cves from the version number a server reports, without confirming them
const VERSION_GUESS = "This is based on the version number your server reports, so check whether your version already includes the fix.";

const CATEGORY_LABELS = {
    software: "Server software",
    ports: "Open ports",
    "email-dns": "Email & DNS",
    secrets: "Secret files",
    packages: "Packages",
    "repo-basics": "Repo basics",
    "ignore-rules": "Ignore rules",
    readme: "README",
};

// Name the user's own servers or files, keeping the fix short: at most 3, then a count
const nameList = (items = []) => {
    const named = items.slice(0, 3).join(", ");

    if (items.length > 3) {
        return `${named} and ${items.length - 3} more`;
    }

    return named;
}

const DOMAIN_CATEGORIES = ["software", "ports", "email-dns"];
const REPO_CATEGORIES = ["secrets", "packages", "repo-basics", "ignore-rules", "readme"];

const getDomainFindings = result => {
    const { records, checks, website } = result;
    const findings = [];
    const cdn = new Set(records.cdnIps ?? []);

    // DNS records live on the registrable domain: www.example.com uses _dmarc.example.com
    const site = checkWebsite(website ?? "");
    const domain = site.isValid ? site.domain : null;

    // Servers running each cve, from Shodan's vulns (CDN edge IPs excluded, as above)
    const cveHosts = id => (records.ports ?? [])
        .filter(item => (item.vulns ?? []).includes(id) && !cdn.has(item.ip))
        .map(item => item.ip);

    // Known vulnerabilities (CVE) in software on server
    let exploited = [];
    let serious = [];
    let other = []

    if (records.cves) {
        for (let cve of records.cves) {
            const entry = {
                id: cve.id,
                cvss: cve.cvss,
                epss: cve.epss,
                kev: cve.kev,
                summary: cve.summary,
                hosts: cveHosts(cve.id),
            };

            if (cve.kev) {
                exploited.push(entry);
            } else if (cve.cvss >= 7) {
                serious.push(entry);
            } else {
                other.push(entry);
            }
        }
    }

    // Every server affected by at least one cve in the group
    const groupHosts = group => [...new Set(group.flatMap(cve => cve.hosts))];

    if (exploited.length > 0) {
        findings.push({
            id: "cve-exploited",
            category: "software",
            checkId: "software-kev",
            kind: "issue",
            severity: "critical",
            title: `Server software may have ${exploited.length} bug(s) attackers are already using`,
            explain: `Your servers report software versions that are listed as affected by bugs being used in real attacks right now. ${VERSION_GUESS}`,
            fix: `Update the software on ${nameList(groupHosts(exploited)) || "these servers"} to the latest version as soon as possible.`,
            source: "domain",
            cves: exploited.map(cve => cve.id),
            hosts: groupHosts(exploited),
            details: { cves: exploited },
        });
    }

    if (serious.length > 0) {
        findings.push({
            id: "cve-serious",
            category: "software",
            checkId: "software-serious",
            kind: "issue",
            severity: "high",
            title: `Server software may have ${serious.length} serious known bug(s)`,
            explain: `Your servers report software versions that are listed as affected by publicly known, high-risk bugs. ${VERSION_GUESS}`,
            fix: `Update the software on ${nameList(groupHosts(serious)) || "these servers"} to the latest version.`,
            source: "domain",
            cves: serious.map(cve => cve.id),
            hosts: groupHosts(serious),
            details: { cves: serious },
        });
    }

    if (other.length > 0) {
        findings.push({
            id: "cve-other",
            category: "software",
            checkId: "software-other",
            kind: "issue",
            severity: "medium",
            title: `Server software may have ${other.length} smaller known bug(s)`,
            explain: `Your servers report software versions that are listed as affected by publicly known bugs that are less likely to be used in attacks. ${VERSION_GUESS}`,
            fix: `Plan to update the software on ${nameList(groupHosts(other)) || "these servers"}.`,
            source: "domain",
            cves: other.map(cve => cve.id),
            hosts: groupHosts(other),
            details: { cves: other },
        });
    }

    // Risky open ports, one finding per port (CDN edge IPs excluded)
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
            fix: `Close port ${port} on ${nameList(servers.map(item => item.ip))} in your firewall, or only allow access through a VPN.`,
            source: "domain",
            hosts: servers.map(item => item.ip),
            details: { port: Number(port), service: name },
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
            fix: `Add a TXT record on ${domain ?? "your domain"} starting with v=spf1 that lists your email provider.`,
            source: "domain",
            details: { domain: domain ?? website ?? null, record: records.spf ?? null },
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
            fix: `Add a TXT record at _dmarc.${domain ?? "yourdomain"} starting with v=DMARC1; p=none, then tighten it to p=quarantine.`,
            source: "domain",
            details: { domain: domain ?? website ?? null, record: records.dmarc ?? null },
        });
    // Match the p= tag only at a tag boundary, so the sp= subdomain policy isn't mistaken for it
    } else if (/(^|;)\s*p\s*=\s*none/i.test(records.dmarc ?? "")) {
        findings.push({
            id: "dns-dmarc-weak",
            category: "email-dns",
            checkId: "email-spoofing",
            kind: "issue",
            severity: "low",
            title: "DMARC only monitors",
            explain: "Your DMARC policy is p=none, so fake emails are reported but still delivered.",
            fix: `Change the DMARC policy at _dmarc.${domain ?? "yourdomain"} to p=quarantine or p=reject.`,
            source: "domain",
            details: { domain: domain ?? website ?? null, record: records.dmarc ?? null },
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
            fix: `Add a CAA record on ${domain ?? "your domain"} that only allows the certificate authority you use (e.g. letsencrypt.org).`,
            source: "domain",
            details: { domain: domain ?? website ?? null, record: null },
        });
    }

    return findings;
}

const getRepoFindings = result => {
    const { records, checks } = result;
    let findings = []

    // The user's own repo as owner/repo, for the fix steps
    const repo = result.repo ?? records.repo?.name ?? null;
    const inRepo = repo ? ` in ${repo}` : "";
    const repoName = repo ?? "your repo";

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
            fix: `Delete ${nameList(records.sensitiveFiles)} from ${repoName}, add them to .gitignore, then change (rotate) every password or key inside. They stay in the git history, so deleting alone isn't enough.`,
            source: "repo",
            files: records.sensitiveFiles,
            details: { files: records.sensitiveFiles },
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
            fix: `You have ${pkg.name} ${pkg.version}. Run npm install ${pkg.name}@latest (or npm audit fix), then check your app still works.`,
            source: "repo",
            details: { package: pkg.name, version: pkg.version, vulns: pkg.vulns },
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
            fix: `Add a SECURITY.md file to ${repoName} that explains how to report security issues (e.g. an email address).`,
            source: "repo",
            details: {},
        });
    }
    if (basics && !basics.dependabot) {
        findings.push({
            id: "repo-dependabot",
            category: "repo-basics",
            checkId: "basics-dependabot",
            kind: "recommendation",
            severity: "low",
            title: "We couldn't find a Dependabot or Renovate config",
            explain: "Dependabot automatically opens pull requests when your packages have security fixes.",
            fix: `Add this as .github/dependabot.yml:\n# .github/dependabot.yml\nversion: 2\nupdates:\n  - package-ecosystem: "npm"\n    directory: "/"   # one entry per folder that has a package.json\n    schedule:\n      interval: "weekly"\nAlso turn on Dependabot alerts and security updates in Settings → Code security.`,
            source: "repo",
            details: {},
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
            fix: `Run npm install${inRepo} and commit the package-lock.json file it creates.`,
            source: "repo",
            details: {},
        });
    }

    // Archived repo, so nothing lands in it any more
    if (records.repo?.archived) {
        findings.push({
            id: "repo-archived",
            category: "repo-basics",
            checkId: null,
            kind: "recommendation",
            severity: "low",
            title: "This repository is archived",
            explain: "Archived repositories are read-only, so they get no more updates or security fixes, including for bugs found later.",
            fix: `If you still rely on ${repoName}, switch to a maintained fork or alternative. If it's still in use, unarchive it in Settings so it can be updated.`,
            source: "repo",
            details: {},
        });
    }

    // Ignore rules, skipped when the .gitignore couldn't be read (or an older scan never checked)
    if (checks?.gitignore === "ok" || checks?.gitignore === "none") {
        const gitignore = records.gitignore;
        const missing = [];

        if (!gitignore?.env) missing.push(".env");
        if (!gitignore?.nodeModules) missing.push("node_modules");
        if (!gitignore?.keys) missing.push("key files");

        if (missing.length > 0) {
            findings.push({
                id: "repo-gitignore",
                category: "ignore-rules",
                checkId: "ignore-rules",
                kind: "issue",
                severity: "medium",
                title: gitignore ? "Your .gitignore misses some risky files" : "No .gitignore file",
                explain: `Without a rule for ${missing.join(", ")}, these can be committed by accident and become public.`,
                fix: `Add a line for ${missing.join(", ")} to the .gitignore in ${repoName} (e.g. .env, node_modules/, *.pem).`,
                source: "repo",
                details: { missing },
            });
        }
    }

    // README, skipped when it couldn't be read (or an older scan never checked)
    if (checks?.readme === "ok" || checks?.readme === "none") {
        const readme = records.readme;
        const missing = [];

        if (!readme?.setup) missing.push("setup");
        if (!readme?.security) missing.push("security");

        if (missing.length > 0) {
            findings.push({
                id: "repo-readme",
                category: "readme",
                checkId: "readme",
                kind: "recommendation",
                severity: "low",
                title: readme ? "Your README is missing some sections" : "No README file",
                explain: `Your README doesn't cover ${missing.join(" or ")}, so people can't tell how to run your project safely.`,
                fix: `Add a short ${missing.join(" and ")} section to the README in ${repoName}.`,
                source: "repo",
                details: { missing },
            });
        }
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