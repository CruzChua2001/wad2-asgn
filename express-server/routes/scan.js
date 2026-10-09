const express = require("express");
const { checkWebsite } = require("../lib/domain");
const { checkDns } = require("../checks/dns");
const { checkSubdomains } = require("../checks/subdomains");

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

module.exports = router;