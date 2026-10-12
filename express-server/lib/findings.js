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
            severity: "medium",
            title: "No SPF record",
            explain: "SPF tells email providers which servers may send email for your domain. Without it, scammers can fake your address more easily.",
            fix: "Add a TXT record starting with v=spf1 that lists your email provider.",
            source: "domain",
        });
    }

    if (!records.dmarc && checks.dmarc !== "unavailable") {
        findings.push({
            severity: "medium",
            title: "No DMARC record",
            explain: "DMARC tells email providers what to do with fake emails using your domain. Without it, they may still be delivered.",
            fix: "Add a TXT record at _dmarc.yourdomain starting with v=DMARC1; p=none, then tighten it to p=quarantine.",
            source: "domain",
        });
    } else if (/p=none/i.test(records.dmarc ?? "")) {
        findings.push({
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
            severity: "critical",
            title: "Secret files are committed to the repo",
            explain: `${records.sensitiveFiles.length} file(s) like .env or private keys are public. Anyone can download them and use the passwords or keys inside.`,
            fix: "Delete the files, add them to .gitignore, then change (rotate) every password or key inside. They stay in the git history, so deleting alone isn't enough.",
            source: "repo",
            files: records.sensitiveFiles,
        });
    }

    // Dependencies with known vulnerabilities
    for (let package of records.dependencies ?? []) {
        findings.push({
            severity: "high",
            title: `${package.name} ${package.version} has known vulnerabilities`,
            explain: `This package has ${package.vulns.length} known security bug(s): ${package.vulns.join(", ")}.`,
            fix: `Run npm install ${package.name}@latest (or npm audit fix), then check your app still works.`,
            source: "repo",
        });
    }

    // Basic security
    const basics = records.basics;
    if (basics && !basics.securityPolicy) {
        findings.push({
            severity: "low",
            title: "No security policy (SECURITY.md)",
            explain: "People who find a bug in your project don't know how to report it to you privately.",
            fix: "Add a SECURITY.md file that explains how to report security issues (e.g. an email address).",
            source: "repo",
        });
    }
    if (basics && !basics.dependabot) {
        findings.push({
            severity: "low",
            title: "Dependabot is not set up",
            explain: "Dependabot automatically opens pull requests when your packages have security fixes.",
            fix: "Add a .github/dependabot.yml file (GitHub > Insights > Dependency graph > Dependabot).",
            source: "repo",
        });
    }
    if (basics?.packageJson && !basics.lockfile) {
        findings.push({
            severity: "low",
            title: "No lockfile",
            explain: "Without package-lock.json, every install can pick different package versions, including vulnerable ones.",
            fix: "Run npm install and commit the package-lock.json file it creates.",
            source: "repo",
        });
    }

    return findings;
}

const getScore = findings => {
    let score = 100;

    for (let finding of findings) {
        score -= PENALTY[finding.severity];
        if (score < 0) {
            score = 0;
            break;
        }
    }

    let grade = "F";
    if (score >= 90) grade = "A";
    else if (score >= 80) grade = "B";
    else if (score >= 70) grade = "C";
    else if (score >= 60) grade = "D";

    return { score, grade };
}

module.exports = { getDomainFindings, getRepoFindings, getScore };