const { supabase } = require("../lib/supabase");
const { checkWebsite } = require("../lib/domain");
const { checkDns } = require("../checks/domain/dns");
const { checkSubdomains } = require("../checks/domain/subdomains");
const { checkOpenPorts } = require("../checks/domain/open-ports");
const { checkCves } = require("../checks/domain/cves");
const { checkGeolocation } = require("../checks/domain/geolocation");

const { checkRepo } = require("../lib/github");
const { checkRepoInfo } = require("../checks/github/repo");
const { checkRepoFiles } = require("../checks/github/files");
const { checkDependencies } = require("../checks/github/deps");

const { buildFindings } = require("../lib/findings");
const { isCdnIp } = require("../lib/cdn");

const cacheLimit = _ => new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()

const ev = (kind, text, module = null) => ({ type: "event", kind, text, module });

// Count DNS records
const dnsRecordCount = dns => {
    const r = dns.records;
    return (r.a?.length ?? 0) + (r.aaaa?.length ?? 0) + (r.ns?.length ?? 0)
         + (r.mx?.length ?? 0) + (r.caa?.length ?? 0);
}

// Count total open ports
const openPortCount = ports => (ports.records.ports ?? []).reduce((sum, p) => sum + (p.ports?.length ?? 0), 0);

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

    yield ev(dns.checks.a === "unavailable" ? "warn" : "ok", `DNS: ${dnsRecordCount(dns)} record(s) found.`, "dns");
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
    yield ev("info", `Checking open ports on ${ips.length} server(s)...`, "open-ports");
    yield ev("info", "Locating servers around the world...", "geolocation");

    const [ports, geolocations] = await Promise.all([
        checkOpenPorts(ips),
        checkGeolocation(ips)
    ]);

    yield ev("ok", `Ports: ${openPortCount(ports)} open across ${ips.length} server(s).`, "open-ports");
    yield ev("ok", "Server locations mapped.", "geolocation");

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
        records: { ...dns.records, ...subdomains.records, ...ports.records, ...geolocations.records, ...cves.records, cdnIps: [...cdnIps] },
        checks:  { ...dns.checks,  ...subdomains.checks,  ...ports.checks,  ...geolocations.checks,  ...cves.checks }
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
        yield ev("bad", "Repository not found or not public.", "repo");
        return null;
    }

    const sha = info.records.commitSha;
    yield ev("ok", "Repository found, latest commit read.", "repo");

    // Check for cache result in database
    if (!force) {
        const { data } = await supabase.from("repo_scans").select("id").eq("github_repo", repo).eq("commit_sha", sha).gte("created_at", cacheLimit())
            .order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (data) {
            yield ev("ok", "Found a recent repository scan, reusing it.", "cache");
            return data.id;
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
        `Files: ${files.records.sensitiveFiles?.length ?? 0} sensitive file(s) found.`, "files");
    yield ev(deps.records.dependencies?.length > 0 ? "warn" : "ok",
        `Dependencies: ${deps.records.dependencies?.length ?? 0} vulnerable package(s).`, "deps");

    const result = {
        repo,
        records: { ...info.records, ...files.records, ...deps.records },
        checks: { ...info.checks, ...files.checks, ...deps.checks }
    }

    const { data, error } = await supabase.from("repo_scans").insert({ github_repo: repo, commit_sha: sha, result }).select("id").single();
    if (error) throw error;

    return data.id
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
        const repoScanId = repo ? await drain(getRepoScanIdSteps(repo.repo, force), write) : null;

        if (repo && !repoScanId) {
            write({ type: "error", message: "We couldn't find that GitHub repository. Check that it's public and spelled correctly." });
            return res.end();
        }

        const newScan = {
            project_id: projectId || null,
            domain_scan_id: domainScanId,
            repo_scan_id: repoScanId,
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

module.exports = { createScan, getScanById }