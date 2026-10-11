const TIMER_MS = 5000; // timeout of 5s in case an ip gets stuck

/**
 * Query Shodan InternetDB with a given IP, returning its ports, vulns, tags
 */
async function fetchIp(ip) {
    try {
        // https://internetdb.shodan.io/docs#/default/info__ip__get
        const response = await fetch(`https://internetdb.shodan.io/${ip}`, { signal: AbortSignal.timeout(TIMER_MS)});
        if (response.status === 404) {
            return { status: "none", ip, ports: [], vulns: [], tags: [] };  // no open ports on this ip
        }
        if (!response.ok) {
            return { status: "unavailable", ip, ports: [], vulns: [], tags: [] };   // server errors or rate limits
        }

        const data = await response.json();
        // console.log(data);
        return {
            status: "ok",
            ip,
            ports: data.ports ?? [],
            vulns: data.vulns ?? [],
            tags: data.tags ?? []
        };
    } catch (error) {
        return { status: "unavailable", ip, ports: [], vulns: [], tags: []};    // network issues or timeout
    }
}

/**
 * Run multiple fetchIp() functions in batches
 */
async function fetchIps(ips) {
    const ip_array = [];
    for (let i = 0; i < ips.length; i += 10) { // process 10 ips at a time
        const batch = ips.slice(i, i + 10);
        const results = await Promise.all(batch.map(fetchIp));
        ip_array.push(...results);
    }
    return ip_array;
}

/**
 * Evaluate final status of scan from a given results array, and returns "ok", "none" or "unavailable"
 */
function evaluateStatus(results) {
    const resultsLength = results.length;
    let cleanCount = 0;
    for (const result of results) {
        if (result.status === "ok") {   // evaluate as ok if theres at least 1 open port found
            return "ok";
        } else if (result.status === "none") {
            cleanCount += 1;
        }
    }
    if (resultsLength> 0 && resultsLength === cleanCount) {
        return "none";  // evaluate as none if theres no open ports found
    }
    return "unavailable";   // evaluate as unavailable if every ip failed the scan or theres no ips
}

/**
 * From a given array of ips, checks and returns open ports and known vulnerabilities using Shodan InternetDB's API
 */
async function checkOpenPorts(ips) {
    const uniqueIps = [...new Set(ips)];
    const results = await fetchIps(uniqueIps);
    // console.log(results);
    return {
        records: { ports: results },
        checks: { ports: evaluateStatus(results) }
    };
}

module.exports = { checkOpenPorts };