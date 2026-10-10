const { supabase } = require("../lib/supabase");
const { checkWebsite } = require("../lib/domain");
const { checkDns } = require("../checks/dns");
const { checkSubdomains } = require("../checks/subdomains");
const { checkOpenPorts } = require("../checks/open-ports");
const { checkCves } = require("../checks/cves");
const { checkGeolocation } = require("../checks/geolocation");

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

const createScan = async (req, res) => {
    const { domain, force } = req.body;
    const check = checkWebsite(domain);

    if (!check.isValid) {
        return res.status(400).json({ error: check.reason });
    }

    try {
        let domainScan = null;
        
        // Find cache result from database if user does not require force
        // Cache result for 12 hours
        if (!force) {
            const cacheLimit = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();

            const { data } = await supabase.from("domain_scans").select("id").eq("domain", check.hostname).gte("created_at", cacheLimit)
                .order("created_at", {ascending: false}).limit(1).maybeSingle();
            domainScan = data;
        }

        if (!domainScan) {
            const result = await scanDomain(check.hostname, check.domain);

            const { data, error } = await supabase.from("domain_scans").insert({ domain: check.hostname, result }).select("id").single();
            if (error) throw error;

            domainScan = data;
        }

        let newScan = { domain_scan_id: domainScan.id, user_id: req.user?.id ?? null }
        const { data: scan, error } = await supabase.from("scans").insert(newScan).select("id").single();
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