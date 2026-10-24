const { supabase } = require("../lib/supabase");
const { checkWebsite } = require("../lib/domain");
const { checkDns } = require("../checks/domain/dns");
const { checkSubdomains } = require("../checks/domain/subdomains");
const { checkOpenPorts } = require("../checks/domain/open-ports");
const { checkCves } = require("../checks/domain/cves");
const { checkGeolocation } = require("../checks/domain/geolocation");
const { checkCertificate } = require("../checks/domain/certificate");
const { checkHeaders } = require("../checks/domain/headers");

const { checkRepo } = require("../lib/github");
const { checkRepoInfo } = require("../checks/github/repo");
const { checkRepoFiles } = require("../checks/github/files");
const { checkDependencies } = require("../checks/github/deps");

const { buildFindings } = require("../lib/findings");
const { isCdnIp } = require("../lib/cdn");

const { SYSTEM_PROMPT, buildPrompt } = require("../lib/guidePrompt");
const guideCache = new Map();

const cacheLimit = _ => new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()

const ev = (kind, text, module = null) => ({ type: "event", kind, text, module });

// "1 server", "3 servers"
const plural = (count, word) => `${count} ${count === 1 ? word : `${word}s`}`;

// Count DNS records
const dnsRecordCount = dns => {
    const r = dns.records;
    return (r.a?.length ?? 0) + (r.aaaa?.length ?? 0) + (r.ns?.length ?? 0)
         + (r.mx?.length ?? 0) + (r.caa?.length ?? 0);
}

// Count total open ports
const openPortCount = ports => (ports.records.ports ?? []).reduce((sum, p) => sum + (p.ports?.length ?? 0), 0);

// Describe the certificate for its progress line
const certLabel = certificate => {
    const cert = certificate.records.certificate;

    if (certificate.checks.certificate === "none") return "no HTTPS found";
    if (!cert) return "couldn't check";
    return `${cert.trusted ? "trusted" : "not trusted"}, ${cert.daysLeft < 0 ? "expired" : `${plural(cert.daysLeft, "day")} left`}`;
}

// Count how many of the 4 security headers the home page sends
const headerCount = headers => {
    const h = headers.records.headers;
    return h ? [h.hsts, h.csp, h.frameOptions, h.contentType].filter(Boolean).length : 0;
}

// Describe a .gitignore or README result for the Files progress line
const workflowLabel = (status, workflows) => {
    if (status === "not_applicable") return "no workflows";
    if (status !== "ok" || !workflows) return "workflows not checked";
    return workflows.files.length === 1 ? "1 workflow checked" : `${workflows.files.length} workflows checked`;
}

const coverLabel = (status, record) => {
    if (status === "none") return "missing";
    if (status !== "ok" || !record) return "not checked";
    return Object.values(record).every(Boolean) ? "complete" : "incomplete";
}

/**
 * Step-by-step Domain scan
 */
async function* scanDomainSteps(hostname, domain) {
    yield ev("info", "Resolving DNS records...", "dns");
    yield ev("info", "Searching certificate logs for subdomains...", "subdomains");

    const [dns, subdomains] = await Promise.all([
        checkDns(hostname, domain),
        checkSubdomains(domain)
    ]);

    // No address and no name servers means the domain doesn't exist, so there's nothing to scan
    if (dns.checks.a === "none" && dns.checks.aaaa === "none" && dns.checks.ns === "none") {
        yield ev("bad", "DNS: no records found for this domain.", "dns");
        return null;
    }

    yield ev(dns.checks.a === "unavailable" ? "warn" : "ok", `DNS: ${plural(dnsRecordCount(dns), "record")} found.`, "dns");
    yield ev(subdomains.checks.subdomains === "unavailable" ? "warn" : "ok",
        `Subdomains: ${subdomains.records.subdomains.length} found.`, "subdomains");

    // Collect every IP from the main site and each subdomain
    const hostIps = (dns.records.a ?? []).concat(dns.records.aaaa ?? []);
    const subdomainIps = [];

    for (let subdomain of subdomains.records.subdomains) {
        subdomainIps.push(...(subdomain.ips ?? []));
    }

    // Remove duplicated ips
    const ips = [...new Set([...hostIps, ...subdomainIps])];

    // Find open ports via Shodan using each ip and the server location for the globe
    yield ev("info", `Checking open ports on ${plural(ips.length, "server")}...`, "open-ports");
    yield ev("info", "Locating servers around the world...", "geolocation");
    yield ev("info", "Checking the HTTPS certificate...", "certificate");
    yield ev("info", "Checking website security settings...", "headers");

    const [ports, geolocations, certificate, headers] = await Promise.all([
        checkOpenPorts(ips),
        checkGeolocation(ips),
        checkCertificate(hostname),
        checkHeaders(hostname)
    ]);

    yield ev("ok", `Ports: ${openPortCount(ports)} open across ${plural(ips.length, "server")}.`, "open-ports");
    yield ev("ok", "Server locations mapped.", "geolocation");
    yield ev(certificate.records.certificate?.trusted ? "ok" : "warn", `Certificate: ${certLabel(certificate)}.`, "certificate");
    yield ev(headerCount(headers) === 4 ? "ok" : "warn",
        headers.checks.headers === "ok" ? `Website settings: ${headerCount(headers)} of 4 security headers found.` : "Website settings: couldn't check.", "headers");

    // Flag CDN edge IPs as their ports/CVEs are shared infrastructure so they must not become findings or dock the score (still keep them geolocated though)
    const geoByIp = new Map((geolocations.records.geo ?? []).map(g => [g.ip, g]));
    const cdnIps = new Set(
        (ports.records.ports ?? [])
            .filter(p => isCdnIp({ isp: geoByIp.get(p.ip)?.isp, org: geoByIp.get(p.ip)?.org, tags: p.tags }))
            .map(p => p.ip)
    );
    
    const cveIds = [];

    for (let port of ports.records.ports) {
        if (cdnIps.has(port.ip)) continue;
        cveIds.push(...(port.vulns ?? []));
    }

    yield ev("info", "Looking up known vulnerabilities (CVEs)...", "cves");
    const cves = await checkCves(cveIds);
    yield ev(cveIds.length > 0 ? "warn" : "ok", `CVEs: ${cves.records.cves?.length ?? 0} found.`, "cves");

    return {
        website: hostname,
        records: { ...dns.records, ...subdomains.records, ...ports.records, ...geolocations.records, ...cves.records, ...certificate.records, ...headers.records, cdnIps: [...cdnIps] },
        checks:  { ...dns.checks,  ...subdomains.checks,  ...ports.checks,  ...geolocations.checks,  ...cves.checks, ...certificate.checks, ...headers.checks }
    }
}

/**
 * Resolve the domain_scans id, returning progress along the way
 */
async function* getDomainScanIdSteps(site, force) {
    if (!force) {
        const { data } = await supabase.from("domain_scans").select("id").eq("domain", site.hostname).gte("created_at", cacheLimit())
            .order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (data) {
            yield ev("ok", "Found a recent website scan, reusing it.", "cache");
            return data.id;
        }
    }

    const result = yield* scanDomainSteps(site.hostname, site.domain);
    if (!result) return null;

    const { data, error } = await supabase.from("domain_scans").insert({ domain: site.hostname, result }).select("id").single();
    if (error) throw error;

    return data.id;
}

/**
 * Resolve the repo_scans id, returning progress along the way
 */
async function* getRepoScanIdSteps(repo, force) {
    yield ev("info", "Looking up the repository on GitHub...", "repo");
    const info = await checkRepoInfo(repo);
    if (info.checks.repo !== "ok") {
        // GitHub not answering is a different problem from a repo that isn't there
        const down = info.checks.repo === "unavailable";
        yield ev("bad", down ? "GitHub didn't respond. Please try again in a moment." : "Repository not found or not public.", "repo");
        return {
            id: null,
            message: down
                ? "GitHub didn't respond. Please try again in a moment."
                : "We couldn't find that GitHub repository. Check that it's public and spelled correctly."
        };
    }

    const sha = info.records.commitSha;
    yield ev("ok", "Repository found, latest commit read.", "repo");

    // Check for cache result in database
    if (!force) {
        const { data } = await supabase.from("repo_scans").select("id").eq("github_repo", repo).eq("commit_sha", sha).gte("created_at", cacheLimit())
            .order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (data) {
            yield ev("ok", "Found a recent repository scan, reusing it.", "cache");
            return { id: data.id };
        }
    }

    // Fetch new result
    yield ev("info", "Listing files and checking for committed secrets...", "files");
    yield ev("info", "Reading dependencies and asking OSV.dev about them...", "deps");

    const [files, deps] = await Promise.all([
        checkRepoFiles(repo, sha),
        checkDependencies(repo, sha)
    ]);

    yield ev(files.records.sensitiveFiles?.length > 0 ? "warn" : "ok",
        `Files: ${files.records.sensitiveFiles?.length ?? 0} sensitive file(s) found, `
        + `.gitignore ${coverLabel(files.checks.gitignore, files.records.gitignore)}, `
        + `README ${coverLabel(files.checks.readme, files.records.readme)}, `
        + `${workflowLabel(files.checks.workflows, files.records.workflows)}.`, "files");
    yield ev(deps.records.dependencies?.length > 0 ? "warn" : "ok",
        `Dependencies: ${deps.records.dependencies?.length ?? 0} vulnerable package(s).`, "deps");

    const result = {
        repo,
        records: { ...info.records, ...files.records, ...deps.records },
        checks: { ...info.checks, ...files.checks, ...deps.checks }
    }

    const { data, error } = await supabase.from("repo_scans").insert({ github_repo: repo, commit_sha: sha, result }).select("id").single();
    if (error) throw error;

    return { id: data.id }
}

/**
 * Drain an async generator, forwarding each yielded event to write(), and return the generator's final return value
 */
async function drain(gen, write) {
    let step = await gen.next();
    while (!step.done) {
        write(step.value);
        step = await gen.next();
    }
    return step.value;
}

const createScan = async (req, res) => {
    const { domain, githubRepo, force , projectId} = req.body;

    if (!domain && !githubRepo) {
        return res.status(400).json({ error: "Enter a website or a GitHub repository." });
    }

    const site = domain ? checkWebsite(domain) : null;
    const repo = githubRepo ? checkRepo(githubRepo) : null;

    if (site && !site.isValid) {
        return res.status(400).json({ error: site.reason });
    }
    if (repo && !repo.isValid) {
        return res.status(400).json({ error: repo.reason });
    }

    if (projectId) {
        if(!req.user) {
            return res.status(401).json({ error: "Please log in first." });
        }

        const { data:member } = await supabase.from("project_members").select("role").eq("project_id", projectId).eq("user_id", req.user.id).maybeSingle();

        if (!member || member.role !== "owner") {
            return res.status(403).json({ error: "Only project owners can scan this project." });
        }
    }

    // Stream progress as NDJSON
    res.status(200);
    res.setHeader("Content-Type", "application/x-ndjson");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("X-Accel-Buffering", "no");

    const write = event => {
        if (res.writableEnded) return;
        try {
            res.write(JSON.stringify(event) + "\n");
        } catch (error) {

        }
    };

    try {
        const domainScanId = site ? await drain(getDomainScanIdSteps(site, force), write) : null;

        if (site && !domainScanId) {
            write({ type: "error", message: "We couldn't find that website. Check the spelling and try again." });
            return res.end();
        }

        const repoScan = repo ? await drain(getRepoScanIdSteps(repo.repo, force), write) : null;

        if (repo && !repoScan.id) {
            write({ type: "error", message: repoScan.message });
            return res.end();
        }

        const newScan = {
            project_id: projectId || null,
            domain_scan_id: domainScanId,
            repo_scan_id: repoScan?.id ?? null,
            user_id: req.user?.id ?? null
        };

        const { data:scan, error } = await supabase.from("scans").insert(newScan).select("id").single();
        if (error) throw error;

        write({ type: "done", id: scan.id });
        res.end();

    } catch (e) {
        console.error("Create scan failed:", e);
        write({ type: "error", message: "Scan failed. Please try again." });
        res.end();
    }
}

const getScanById = async (req, res) => {
    const { data: scan, error } = await supabase.from("scans")
        .select("id, project_id, created_at, domain_scans(domain, result, created_at), repo_scans(github_repo, result, created_at)")
        .eq("id", req.params.id).maybeSingle();

    if (error) {
        console.error("Failed to load scan:", error);
    }

    if (!scan) {
        return res.status(404).json({ error: "Scan not found." }); 
    }

    let role = null;

    if (scan.project_id) {
        if (!req.user) {
            return res.status(404).json({ error: "Scan not found." });
        }

        const { data: member } = await supabase.from("project_members").select("role").eq("project_id", scan.project_id).eq("user_id", req.user.id).maybeSingle();

        if (!member) {
            return res.status(404).json({ error: "Scan not found." });
        }

        role = member.role;
    }

    res.json({ ...scan, role, ...buildFindings(scan) });
}

const getFindingGuide = async (req, res) => {
    try {
        const { id, findingId } = req.params;

        const { data: scan, error } = await supabase.from("scans")
            .select("id, project_id, created_at, domain_scans(domain, result, created_at), repo_scans(github_repo, result, created_at)")
            .eq("id", id).maybeSingle();

        if (error) {
            console.error("Failed to load scan for guide:", error);
            return res.status(500).json({ error: "Couldn't load the scan. Please try again." });
        }

        if (!scan) {
            return res.status(404).json({ error: "Scan not found." });
        }

        if (scan.project_id) {
            const { data: member } = await supabase.from("project_members").select("role")
                .eq("project_id", scan.project_id).eq("user_id", req.user.id).maybeSingle();

            if (!member) {
                return res.status(404).json({ error: "Scan not found." });
            }
        }

        const { findings } = buildFindings(scan);
        const finding = findings.find(f => f.id === findingId);
        const cacheKey = [finding.id, finding.title, finding.fix, (finding.hosts || []).join(",")].join("|");
        if (guideCache.has(cacheKey)) {
            return res.json({ guide: guideCache.get(cacheKey) });
        }

        if (!finding) {
            return res.status(404).json({ error: "Finding not found." });
        }

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL}:generateContent`,
            {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "x-goog-api-key": process.env.GEMINI_API_KEY,
                },
                body: JSON.stringify({
                    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
                    contents: [{ parts: [{ text: buildPrompt(finding) }] }],
                    generationConfig: {
                        maxOutputTokens: 600,
                    },
                }),
            }
        );

        const data = await response.json();

        if (response.status === 429) {
            return res.status(429).json({ error: "The guide writer is busy right now. Please try again in a minute." });
        }

        const guide = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!response.ok || !guide) {
            console.error("Gemini request failed:", response.status, JSON.stringify(data));
            throw new Error("AI request failed");
        }
        guideCache.set(cacheKey, guide);
        res.json({ guide });
    } catch (error) {
        console.error("Error creating fix guide:", error);
        res.status(500).json({ error: "Couldn't create the guide. Please try again." });
    }
};

module.exports = { createScan, getScanById, getFindingGuide }