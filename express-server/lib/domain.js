const { parse } = require("tldts");

/**
Normalize + Validate a given URL and returns a JSON object of whether it is
valid, reason (if invalid), and its hostname and domain (if valid)
*/
function checkWebsite(url) {
    if (typeof url !== "string" || !url.trim()) {
        return { isValid: false, reason: "Enter a public website or domain." };
    }

    let cleanedUrl = url.trim().toLowerCase();
    if (!cleanedUrl.startsWith("http://") && !cleanedUrl.startsWith("https://")) {
        cleanedUrl = `https://${cleanedUrl}`;
    }

    let hostname = "";
    try {
        hostname = new URL(cleanedUrl).hostname.replace(/\.$/, "") // get hostname after removing trailing '.'
    } catch (error) {
        return { isValid: false, reason: "Use a public hostname instead." };
    }

    const { domain, isIp, isIcann } = parse(hostname);
    if (!domain || isIp || !isIcann) {
        return { isValid: false, reason: "Use a public hostname instead." };
    }

    return { isValid: true, hostname, domain };
}

module.exports = { checkWebsite };