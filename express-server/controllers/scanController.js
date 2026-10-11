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

const cacheLimit = _ => new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString()

const scanDomain = async (hostname, domain) => {
    const [dns, subdomains] = await Promise.all([
        checkDns(hostname, domain), 
        checkSubdomains(domain)
    ])

    // Collects every IP from the main site, and each subdomain
    const hostIps = (dns.records.a ?? []).concat(dns.records.aaaa ?? []);
    const subdomainIps = [];

    for (let subdomain of subdomains.records.subdomains) {
        subdomainIps.push(...(subdomain.ips ?? []));
    }

    // -- Remove duplicated ips
    const ips = [...new Set([...hostIps, ...subdomainIps])];

    // Find open ports (using Shodan) using each ip and the server location for the globe
    const [ports, geolocations] = await Promise.all([
        checkOpenPorts(ips),
        checkGeolocation(ips)
    ])

    // Open port may list known vulnerability IDs (vulns). Collect all and look up their details (CVE database)
    const cveIds = [];

    for (let port of ports.records.ports) {
        cveIds.push(...(port.vulns ?? []));
    }
    
    const cves = await checkCves(cveIds);

    return {
        website: hostname,
        records: { ...dns.records, ...subdomains.records, ...ports.records, ...geolocations.records, ...cves.records },
        checks:  { ...dns.checks,  ...subdomains.checks,  ...ports.checks,  ...geolocations.checks,  ...cves.checks }
    }
}

const getRepoScanId = async (repo, force) => {
    const info = await checkRepoInfo(repo);
    if (info.checks.repo !== "ok") return null;

    const sha = info.records.commitSha;
    
    // Check for cache result in database
    // - within the 12 hour limit
    // - compare with the commit SHA (if not additional commit, use the cache)
    if (!force) {
        const { data } = await supabase.from("repo_scans").select("id").eq("github_repo", repo).eq("commit_sha", sha).gte("created_at", cacheLimit())
            .order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (data) return data.id;
    }

    // Fetch new result
    const [files, deps] = await Promise.all([
        checkRepoFiles(repo, sha),
        checkDependencies(repo, sha)
    ])

    const result = {
        repo,
        records: { ...info.records, ...files.records, ...deps.records },
        checks: { ...info.checks, ...files.checks, ...deps.checks }
    }

    const { data, error } = await supabase.from("repo_scans").insert({ github_repo: repo, commit_sha: sha, result }).select("id").single();
    if (error) throw error;

    return data.id
}

const getDomainScanId = async (site, force) => {
    if (!force) {
        const { data } = await supabase.from("domain_scans").select("id").eq("domain", site.hostname).gte("created_at", cacheLimit())
            .order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (data) return data.id;
    }

    const result = await scanDomain(site.hostname, site.domain);

    const { data, error } = await supabase.from("domain_scans").insert({ domain: site.hostname, result }).select("id").single();
    if (error) throw error;

    return data.id;
}

const createScan = async (req, res) => {
    const { domain, githubRepo, force } = req.body;
    
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

    try {
        const [domainScanId, repoScanId] = await Promise.all([
            site ? getDomainScanId(site, force) : null,
            repo ? getRepoScanId(repo.repo, force) : null
        ])

        if (repo && !repoScanId) {
            return res.status(400).json({ error: "We couldn't find that GitHub repository. Check that it's public and spelled correctly." });
        }

        const newScan = {
            domain_scan_id: domainScanId,
            repo_scan_id: repoScanId,
            user_id: req.user?.id ?? null
        };

        const { data:scan, error } = await supabase.from("scans").insert(newScan).select("id").single();
        if (error) throw error;

        res.status(201).json({ id: scan.id });

    } catch (e) {
        console.error("Create scan failed:", e);
        res.status(500).json({ error: "Scan failed. Please try again." });
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

    if (scan.project_id) {
        if (!req.user) {
            return res.status(404).json({ error: "Scan not found." });
        }

        const { data: member } = await supabase.from("project_members").select("role").eq("project_id", scan.project_id).eq("user_id", req.user.id).maybeSingle();

        if (!member) {
            return res.status(404).json({ error: "Scan not found." });
        }
    }

    res.json(scan);
}

module.exports = { createScan, getScanById }