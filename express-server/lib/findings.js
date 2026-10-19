const { checkWebsite } = require("./domain");
const { getDomainChecks, getRepoChecks, getScore } = require("./score");

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

// Shodan matches cves from the version number a server reports, without confirming them
const VERSION_GUESS = "This is based on the version number your server reports, so check whether your version already includes the fix.";

// HSTS should last at least about six months
const HSTS_MIN_AGE = 180 * 24 * 60 * 60;

// Name the user's own servers or files, keeping the fix short: at most 3, then a count
const nameList = (items = []) => {
    const named = items.slice(0, 3).join(", ");

    if (items.length > 3) {
        return `${named} and ${items.length - 3} more`;
    }

    return named;
}

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
            // A lookup that failed tells us nothing, so don't group it or score it
            if (cve.status === "unavailable") {
                continue;
            }

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
            title: `Server software may have ${exploited.length} ${exploited.length === 1 ? "bug" : "bugs"} attackers are already using`,
            explain: `Your servers report software versions that are listed as affected by bugs being used in real attacks right now. ${VERSION_GUESS}`,
            fix: `Update the software on ${nameList(groupHosts(exploited)) || "these servers"} to the latest version as soon as possible.`,
            source: "domain",
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
            title: `Server software may have ${serious.length} serious known ${serious.length === 1 ? "bug" : "bugs"}`,
            explain: `Your servers report software versions that are listed as affected by publicly known, high-risk bugs. ${VERSION_GUESS}`,
            fix: `Update the software on ${nameList(groupHosts(serious)) || "these servers"} to the latest version.`,
            source: "domain",
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
            title: `Server software may have ${other.length} smaller known ${other.length === 1 ? "bug" : "bugs"}`,
            explain: `Your servers report software versions that are listed as affected by publicly known bugs that are less likely to be used in attacks. ${VERSION_GUESS}`,
            fix: `Plan to update the software on ${nameList(groupHosts(other)) || "these servers"}.`,
            source: "domain",
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
            explain: `Port ${port} is reachable on ${servers.length} ${servers.length === 1 ? "server" : "servers"}, so anyone online can try to break in.`,
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

    const host = website ?? "your site";

    // HTTPS certificate
    const cert = records.certificate;

    if (checks.certificate === "ok" && cert) {
        const certDetails = {
            issuer: cert.issuer,
            validTo: cert.validTo,
            daysLeft: cert.daysLeft,
            selfSigned: cert.selfSigned,
            keyBits: cert.keyBits,
            tlsVersion: cert.tlsVersion,
        };

        let certTitle = "Your HTTPS certificate can't be verified";
        if (cert.daysLeft < 0) {
            certTitle = "Your HTTPS certificate has expired";
        } else if (cert.selfSigned) {
            certTitle = "Your HTTPS certificate is self-signed";
        } else if (cert.error === "ERR_TLS_CERT_ALTNAME_INVALID") {
            certTitle = `Your HTTPS certificate doesn't cover ${host}`;
        }

        if (!cert.trusted) {
            findings.push({
                id: "cert-invalid",
                category: "certificate",
                checkId: "cert-validity",
                kind: "issue",
                severity: "high",
                title: certTitle,
                explain: "Browsers warn visitors that the connection isn't private, so many will leave, and it's easier for someone to pretend to be your site.",
                fix: `Install a valid certificate for ${host} from a trusted authority such as Let's Encrypt (most hosts do this for free), and turn on automatic renewal.`,
                source: "domain",
                details: certDetails,
            });
        } else if (cert.daysLeft < 30) {
            const expiresIn = cert.daysLeft === 0 ? "today" : `in ${cert.daysLeft} ${cert.daysLeft === 1 ? "day" : "days"}`;

            findings.push({
                id: "cert-expiring",
                category: "certificate",
                checkId: "cert-validity",
                kind: "issue",
                severity: "medium",
                title: `Your HTTPS certificate expires ${expiresIn}`,
                explain: "Once it expires, browsers show visitors a security warning instead of your site.",
                fix: `Renew the certificate for ${host} now, and turn on automatic renewal so it can't lapse.`,
                source: "domain",
                details: certDetails,
            });
        }

        const weakKey = cert.keyBits && cert.keyBits < (cert.keyType === "EC" ? 256 : 2048);
        const oldTls = ["TLSv1", "TLSv1.1"].includes(cert.tlsVersion);

        if (weakKey || oldTls) {
            findings.push({
                id: "cert-weak",
                category: "certificate",
                checkId: "cert-validity",
                kind: "issue",
                severity: "medium",
                title: "Your HTTPS setup uses outdated security",
                explain: weakKey
                    ? `The certificate uses a ${cert.keyBits}-bit key, which is too short to be safe today.`
                    : `Your server uses ${cert.tlsVersion}, an old version that browsers have stopped trusting.`,
                fix: weakKey
                    ? `Get a new certificate for ${host} with a 2048-bit RSA or 256-bit EC key.`
                    : `Turn on TLS 1.2 and 1.3 for ${host} and turn off the older versions.`,
                source: "domain",
                details: certDetails,
            });
        }
    }

    // Website security settings, read from the home page
    const headers = records.headers;

    if (checks.headers === "ok" && headers) {
        const webDetails = (header, value) => ({ url: headers.url, header, value: value ?? null });

        // A certificate means the site has HTTPS, even if the page couldn't be read over it
        const hasHttps = headers.https || checks.certificate === "ok";

        if (headers.httpRedirect === false) {
            findings.push({
                id: "web-https-redirect",
                category: "web-settings",
                checkId: "web-https-hsts",
                kind: "issue",
                severity: hasHttps ? "medium" : "high",
                title: hasHttps ? "HTTP doesn't redirect to HTTPS" : "Your site doesn't use HTTPS",
                explain: "Pages sent over plain http:// aren't encrypted, so anyone on the same network (like public Wi-Fi) can read or change them.",
                fix: hasHttps
                    ? `Make http://${host} redirect to https://${host} with a 301 redirect in your web server or hosting settings.`
                    : `Set up HTTPS for ${host} (most hosts offer free Let's Encrypt certificates), then redirect http:// to https://.`,
                source: "domain",
                details: { url: `http://${host}/`, header: "Location", value: null },
            });
        }

        const hstsAge = Number(/max-age="?(\d+)/i.exec(headers.hsts ?? "")?.[1] ?? 0);

        if (hstsAge < HSTS_MIN_AGE) {
            findings.push({
                id: "web-hsts",
                category: "web-settings",
                checkId: "web-https-hsts",
                kind: "issue",
                severity: "medium",
                title: headers.hsts ? "HSTS is too short" : "HSTS is missing",
                explain: "HSTS tells browsers to always use HTTPS for your site, so nobody can quietly switch visitors back to plain HTTP.",
                fix: headers.hsts
                    ? `Raise max-age in the Strict-Transport-Security header on ${host} to 31536000 (one year).`
                    : `Once HTTPS works on every page of ${host}, add the header Strict-Transport-Security: max-age=31536000.`,
                source: "domain",
                details: webDetails("Strict-Transport-Security", headers.hsts),
            });
        }

        if (!headers.csp) {
            findings.push({
                id: "web-csp",
                category: "web-settings",
                checkId: "web-headers",
                kind: "issue",
                severity: "low",
                title: "No Content-Security-Policy",
                explain: "A Content-Security-Policy limits which scripts can run on your pages, which makes cross-site scripting (XSS) attacks much harder.",
                fix: `Add a Content-Security-Policy header to ${host}, starting with default-src 'self'. Try it as Content-Security-Policy-Report-Only first so nothing breaks.`,
                source: "domain",
                details: webDetails("Content-Security-Policy", headers.csp),
            });
        }

        if (!headers.frameOptions && !/frame-ancestors/i.test(headers.csp ?? "")) {
            findings.push({
                id: "web-frame-options",
                category: "web-settings",
                checkId: "web-headers",
                kind: "issue",
                severity: "medium",
                title: "No clickjacking protection",
                explain: "Other sites can show your pages inside a hidden frame and trick visitors into clicking buttons they can't see.",
                fix: `Add the header X-Frame-Options: DENY to ${host} (or frame-ancestors 'none' in your Content-Security-Policy).`,
                source: "domain",
                details: webDetails("X-Frame-Options", headers.frameOptions),
            });
        }

        if (!/nosniff/i.test(headers.contentType ?? "")) {
            findings.push({
                id: "web-content-type",
                category: "web-settings",
                checkId: "web-headers",
                kind: "issue",
                severity: "low",
                title: "No X-Content-Type-Options",
                explain: "Without it, browsers may guess a file's type and run an uploaded file as a script.",
                fix: `Add the header X-Content-Type-Options: nosniff to every response from ${host}.`,
                source: "domain",
                details: webDetails("X-Content-Type-Options", headers.contentType),
            });
        }
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
            explain: records.sensitiveFiles.length === 1
                ? "1 file like .env or a private key is public. Anyone can download it and use the passwords or keys inside."
                : `${records.sensitiveFiles.length} files like .env or private keys are public. Anyone can download them and use the passwords or keys inside.`,
            fix: `Delete ${nameList(records.sensitiveFiles)} from ${repoName}, add them to .gitignore, then change (rotate) every password or key inside. They stay in the git history, so deleting alone isn't enough.`,
            source: "repo",
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
            explain: `This package has ${pkg.vulns.length} known security ${pkg.vulns.length === 1 ? "bug" : "bugs"}: ${pkg.vulns.join(", ")}.`,
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
    if (basics?.packageJson && !basics.dependabot) {
        findings.push({
            id: "repo-dependabot",
            category: "repo-basics",
            checkId: "basics-dependabot",
            kind: "recommendation",
            severity: "low",
            title: "We couldn't find a Dependabot or Renovate config",
            explain: "Dependabot automatically opens pull requests when your packages have security fixes.",
            fix: `Let Dependabot watch ${repoName} for you.\n1. Create the file: \`.github/dependabot.yml\`.\n2. Paste this in:\n\`\`\`\nversion: 2\nupdates:\n  - package-ecosystem: "npm"\n    directory: "/"   # one entry per folder that has a package.json\n    schedule:\n      interval: "weekly"\n\`\`\`\nTip: also turn on Dependabot alerts and security updates in Settings → Code security.`,
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

    // CI workflows, skipped for repos with no workflows, failed reads and older scans (C11)
    if (checks?.workflows === "ok" && records.workflows) {
        const { noPermissions, unpinned, dangerous } = records.workflows;

        if (dangerous.length > 0) {
            const places = dangerous.map(item => `${item.file} line ${item.line}`);

            findings.push({
                id: "repo-workflow-dangerous",
                category: "workflows",
                checkId: "workflow-dangerous",
                kind: "issue",
                severity: "high",
                title: "A workflow runs text that anyone can write",
                explain: "Your GitHub Actions workflow puts text from an issue, pull request or commit message straight into a command. Anyone can write that text, so they can put commands in it and your workflow will run them with access to your secrets.",
                fix: `Keep the text out of your commands in ${nameList(places)}.\n1. Move it into a variable: add an \`env:\` block to the step, like \`MY_TEXT: \${{ github.event.issue.title }}\`.\n2. Use the variable: in your \`run:\` step, write \`"$MY_TEXT"\` instead of \`\${{ ... }}\`.\nTip: keep the double quotes, so spaces in the text can't start a second command.`,
                source: "repo",
                details: { lines: dangerous },
            });
        }

        if (noPermissions.length > 0) {
            findings.push({
                id: "repo-workflow-permissions",
                category: "workflows",
                checkId: "workflow-permissions",
                kind: "issue",
                severity: "high",
                title: "Your workflows can change your code without asking",
                explain: `${noPermissions.length === 1 ? "One workflow doesn't" : `${noPermissions.length} workflows don't`} say what the workflow is allowed to do, so GitHub may give it write access to your whole repository. A mistake or a bad action could then change your code or releases.`,
                fix: `Say what each workflow may do in ${nameList(noPermissions)}.\n1. Open the file: the top of it, above \`jobs:\`.\n2. Paste these two lines there:\n\`\`\`\npermissions:\n  contents: read\n\`\`\`\nTip: if one job really needs to write, give that job its own permissions: block.`,
                source: "repo",
                details: { files: noPermissions },
            });
        }

        if (unpinned.length > 0) {
            // One action can appear in several workflows, and the first one shows the example fix
            const actions = [...new Set(unpinned.map(item => item.uses))];
            const [name, tag] = actions[0].split("@");

            findings.push({
                id: "repo-workflow-pinned",
                category: "workflows",
                checkId: "workflow-pinned",
                kind: "recommendation",
                severity: "medium",
                title: "Some workflow actions can change without you knowing",
                explain: "Your workflows use other people's actions by a version label like @v2. The owner, or someone who hacks their account, can move that label to new code, and your workflow would run it with access to your secrets. This happened to tj-actions/changed-files in March 2025. Locking each action to an exact commit stops this.",
                fix: `Lock these actions to an exact version: ${nameList(actions)}.\n1. Find the commit ID: open the action on GitHub, go to Releases, pick the version you use, and copy its full 40-character commit ID.\n2. Replace the tag: change \`uses: ${actions[0]}\` to \`uses: ${name}@<commit ID> # ${tag}\`.\nTip: Dependabot can keep these up to date for you.`,
                source: "repo",
                learnMore: { label: "Read about the tj-actions incident", url: "https://github.com/advisories/GHSA-mrrh-fwg8-r2c3" },
                details: { actions: unpinned },
            });
        }
    }

    return findings;
}

const buildFindings = scan => {
    let findings = [];
    let checks = [];

    if (scan.domain_scans) {
        const domainFindings = getDomainFindings(scan.domain_scans.result);
        findings.push(...domainFindings);
        checks.push(...getDomainChecks(scan.domain_scans.result, domainFindings));
    }

    if (scan.repo_scans) {
        const repoFindings = getRepoFindings(scan.repo_scans.result);
        findings.push(...repoFindings);
        checks.push(...getRepoChecks(scan.repo_scans.result, repoFindings));
    }

    return { findings, ...getScore(checks) };
}

module.exports = { getDomainFindings, getRepoFindings, buildFindings };