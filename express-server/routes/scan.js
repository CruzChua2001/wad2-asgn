const express = require("express");
const { checkWebsite } = require("../lib/domain");
const { checkDns } = require("../checks/dns");

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
        return res.status(500).json({ error: "Scan failed. Please try again." });
    }
});

module.exports = router;