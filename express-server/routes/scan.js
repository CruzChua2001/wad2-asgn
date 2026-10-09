const express = require("express");
const { checkWebsite } = require("../lib/domain");
const { checkDns } = require("../checks/dns");
const { checkSubdomains } = require("../checks/subdomains");
const { checkOpenPorts } = require("../checks/open-ports");
const { checkCves } = require("../checks/cves");
const { checkGeolocation } = require("../checks/geolocation");

const router = express.Router();

// GET /api/scan/dns?domain={domain}
router.get("/dns", async (req, res) => {
    const check = checkWebsite(req.query.domain);
    if (!check.isValid) {
        return res.status(400).json({ error: check.reason });
    }

    try {
        const result = await checkDns(check.hostname, check.domain);
        return res.json({ website: check.hostname, ...result });
    } catch (error) {
        console.error("DNS scan failed:", error);
        return res.status(500).json({ error: "DNS Scan failed. Please try again." });
    }
});

// GET /api/scan/subdomains?domain={domain}
router.get("/subdomains", async (req, res) => {
    const check = checkWebsite(req.query.domain);
    if (!check.isValid) {
        return res.status(400).json({ error: check.reason });
    }

    try {
        const result = await checkSubdomains(check.domain);
        return res.json({ website: check.domain, ...result });
    } catch (error) {
        console.error("Subdomain scan failed:", error);
        return res.status(500).json({ error: "Subdomain Scan failed. Please try again." });
    }
});

// GET /api/scan?domain={domain}  — temp prototype orchestrator to connect and feed data in/out of all the individual scans
router.get("/", async (req, res) => {
    const check = checkWebsite(req.query.domain);
    if (!check.isValid) {
        return res.status(400).json({ error: check.reason });
    }

    try {
        // 1. Scan for DNS + SPF/DMARC/CAA + Subdomains in parallel
        const [dns, subdomains] = await Promise.all([
            checkDns(check.hostname, check.domain),
            checkSubdomains(check.domain),
        ]);
        // console.log(dns);
        // console.log(subdomains);

        // 2. Create Set of obtained IPs
        const hostIps = (dns.records.a ?? []).concat(dns.records.aaaa ?? []);
        const subdomainIps = [];
        for (const subdomain of subdomains.records.subdomains) {
            subdomainIps.push(...(subdomain.ips ?? []));
        }
        const ips = [...new Set([...hostIps, ...subdomainIps])];
        // console.log(ips);

        // 3. Scan for open ports + geolocation in parallel
        const [ports, geolocations] = await Promise.all([
            checkOpenPorts(ips),
            checkGeolocation(ips),
        ]);
        // console.log(ports);
        // console.log(geolocations);

        // 4. From Open ports, retrieve their CVES and details
        const cveIds = [];
        for (const port of ports.records.ports) {
            cveIds.push(...(port.vulns ?? []));
        }
        const cves = await checkCves(cveIds);
        // console.log(cves);

        // 5. Merge and return all scans as a single JSON response
        return res.json({
            website: check.hostname,
            records: { ...dns.records, ...subdomains.records, ...ports.records, ...geolocations.records, ...cves.records },
            checks:  { ...dns.checks,  ...subdomains.checks,  ...ports.checks,  ...geolocations.checks,  ...cves.checks },
        });
    } catch (error) {
        console.error("Scan failed:", error);
        return res.status(500).json({ error: "Scan failed. Please try again." });
    }
});

module.exports = router;