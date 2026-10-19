const WINDOW_MS = 10 * 60 * 1000;   // scans are counted per key over a rolling 10 minute window
const GUEST_LIMIT = 5;              // guests are keyed by ip, so keep their allowance small
const USER_LIMIT = 20;
const FORCE_COST = 2;               // a forced scan skips the cache and hits every external API again

const scanCounts = new Map();   // key -> { count, resetAt }

/**
 * Drop windows that have run out, so the Map doesn't grow forever
 */
const sweep = now => {
    for (const [key, entry] of scanCounts) {
        if (entry.resetAt <= now) {
            scanCounts.delete(key);
        }
    }
}

/**
 * Count scans per user (or per ip for guests) and answer 429 once they go over
 */
const scanRateLimit = (req, res, next) => {
    const now = Date.now();
    sweep(now);

    const userId = req.user?.id;
    const key = userId ? `user:${userId}` : `ip:${req.ip}`;
    const limit = userId ? USER_LIMIT : GUEST_LIMIT;
    const cost = req.body?.force ? FORCE_COST : 1;

    let entry = scanCounts.get(key);
    if (!entry || entry.resetAt <= now) {
        entry = { count: 0, resetAt: now + WINDOW_MS };
        scanCounts.set(key, entry);
    }

    if (entry.count + cost > limit) {
        res.setHeader("Retry-After", String(Math.ceil((entry.resetAt - now) / 1000)));
        return res.status(429).json({ error: "You're scanning too quickly. Please wait a few minutes and try again." });
    }

    entry.count += cost;

    // Give the cost back when the scan never ran (bad input, not signed in, wrong role)
    res.on("finish", () => {
        if (res.statusCode < 400 || res.statusCode >= 500 || res.statusCode === 429) {
            return;
        }
        if (scanCounts.get(key) === entry) {
            entry.count = Math.max(0, entry.count - cost);
        }
    });

    next();
}

module.exports = { scanRateLimit };
