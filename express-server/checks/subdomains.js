const MAX_NAMES = 100;  // temp upper bound to avoid returning excessive certificates
const TIMER_MS = 10000; // timeout of 10s in case ctlogs.dev takes too long to respond or is down
const dns = require("node:dns").promises;

const resolver = new dns.Resolver({ timeout: 2000, tries: 1 });
resolver.setServers(["1.1.1.1", "8.8.8.8"]); // use cloudflare/google dns servers

/**
 * Fetches a URL and parses its JSON body, timing out after 10s, taking a given URL string 
 * and returning the parsed JSON on success or throws an error if exceeding 10s timer or status is not ok
 */
async function fetchJson(url) {
    const response = await fetch(url, {signal: AbortSignal.timeout(TIMER_MS)});
    if (!response.ok) {
        throw new Error(response.status);
    }
    return response.json();    
}

/**
 * Lowercase + trim + strip leading "*." + reject names outside the domain from a given raw hostname
 */
function cleanName(rawName, domain) {
    let name = rawName ?? "";
    name = name.trim().toLowerCase();
    if (name.startsWith("*.")) {    // remove *. at start of subdomain
        name = name.slice(2);
    }
    if (!name) {
        return null;
    }
    if (!name.endsWith(`.${domain}`)) {  // drop unrelated subdomains
        return null;
    }
    return name;
}

/**
 * Remove duplicates + Sort + Cap a given list of raw hostnames into a result set
 */
function processResults(lst, domain) {
    const names = new Set();
    for (const rawName of lst) {
        const name = cleanName(rawName, domain);
        if (name) {
            names.add(name);
        }
    }
    // console.log(names);
    return [...names].sort().slice(0, MAX_NAMES);
}

/**
 * Query ctlogs.dev's /v1/hosts endpoint for a given domain's certificate-log hostnames and returns a list of subdomains
 */
async function fromCtLogs(domain) {
    const url = `https://api.ctlogs.dev/v1/hosts/${encodeURIComponent(domain)}`;
    const data = await fetchJson(url);
    // console.log(data);
    const entries = data.hosts ?? [];
    const rawNames = entries.map((entry) => entry.host);
    return processResults(rawNames, domain);
}

/**
 * Query CertSpotter's issuances endpoint for a given domain's certificate hostnames and returns a list of subdomains
 */
async function fromCertSpotter(domain) {
    const url = `https://api.certspotter.com/v1/issuances?domain=${encodeURIComponent(domain)}&include_subdomains=true&expand=dns_names`;
    const data = await fetchJson(url);
    // console.log(data);
    const entries = data ?? [];
    const rawNames = [];
    for (const entry of entries) {
        let rawName = entry.dns_names ?? [];
        rawNames.push(...rawName);
    }
    // console.log(rawNames);
    return processResults(rawNames, domain);
}

/**
 * Resolve a given hostname's A records, returning its ips on success or null on failure
 */
async function resolveHostname(hostname) {
    try {
        const ips = await resolver.resolve4(hostname);
        return { hostname, ips };
    } catch (error) {
        return null;
    }
}

/**
 * Filters a list of hostnames to only include resolved hostnames, excluding dead hostnames
 */
async function filterHostnames(names) {
    const filtered = [];
    for (let i = 0; i < names.length; i += 10) { // check 10 names at a time
        const batch = names.slice(i, i + 10);
        const results = await Promise.all(batch.map(resolveHostname));
        for (const result of results) {
            if (result) {
                filtered.push(result); // add result to filtered list if hostname can resolve
            }
        }
        // console.log(filtered);
    }
    return filtered;
}

/**
 * Retrieve a given domain's live subdomains from its certificate transparency logs using ctlogs.dev first and CertSpotter as a fallback
 */
async function checkSubdomains(domain) {
    try {   // 1. try using ctlogs.dev first
        const names = await fromCtLogs(domain);
        const subdomains = await filterHostnames(names);
        return {
            records: { subdomains },
            checks: { subdomains: "ok" }
        };
    } catch (ctLogsError) {
        try {   // 2. if ctlogs.dev fails/unresponsive, use certspotter instead
            const names = await fromCertSpotter(domain);
            const subdomains = await filterHostnames(names);
            return {
                records: { subdomains },
                checks: { subdomains: "ok" }
            };
        } catch (certSpotterError) {
            return {    // 3. both ctlogs.dev and certspotter failed
                records: { subdomains: [] },
                checks: { subdomains: "unavailable" },
            };
        }
    }    
}

module.exports = { checkSubdomains };