const TIMER_MS = 5000; // timeout of 5s in case a cve lookup gets stuck

/**
 * Query Shodan CVEDB for 1 cve id, returning its severity, epss, kev and summary
 */
async function fetchCve(id) {
    try {
        // https://cvedb.shodan.io/docs#/default/cve_cve__cve_id__get
        const response = await fetch(`https://cvedb.shodan.io/cve/${id}`, { signal: AbortSignal.timeout(TIMER_MS) });
        if (!response.ok) {
            return { status: "unavailable", id, cvss: null, epss: null, kev: false, summary: "" };
        }

        const data = await response.json();
        // console.log(data);
        return {
            status: "ok",
            id,
            cvss: data.cvss ?? null,        // Common Vulnerability Scoring System (CVSS) score, newest version, which ranges from 0 to 10, quantifies the severity of the vulnerability based on various factors such as exploitability, impact, and ease of attack. A score of 10 indicates the highest severity (from API documentation)
            epss: data.epss ?? null,        // Exploit Prediction Scoring System (EPSS) score, a probabilistic measure between 0 and 1 (0 and 100%)., predicts the likelihood of a vulnerability being exploited in the wild within the next 30 days. Scores closer to 1 indicate a higher risk of exploitation (from API documentation)
            kev: data.kev ?? false,         // A boolean value indicating whether the vulnerability is known to be exploited in the wild, which is crucial for prioritizing patching and mitigation efforts (from API documentation)
            summary: data.summary ?? ""     // A brief overview of the vulnerability, providing essential information on what it entails, the affected systems, and the potential impact in clear, understandable English (from API documentation)
        };
    } catch (error) {
        return { status: "unavailable", id, cvss: null, epss: null, kev: false, summary: "" };   // network issues or timeout
    }
}

/**
 * Run multiple fetchCve() functions in batches
 */
async function fetchCves(ids) {
    const cves = [];
    for (let i = 0; i < ids.length; i += 10) { // process 10 cves at a time
        const batch = ids.slice(i, i + 10);
        const results = await Promise.all(batch.map(fetchCve));
        cves.push(...results);
    }
    return cves;
}

/**
 * Sort array of CVES by their kev first, then higher epss, then higher cvss
 */
function sortCves(cves) {
    const sorted = [...cves];
    sorted.sort((a, b) => (b.cvss ?? 0) - (a.cvss ?? 0));   // least important: severity when exploited
    // console.log(sorted);
    sorted.sort((a, b) => (b.epss ?? 0) - (a.epss ?? 0));   // important: most likely to be exploited
    // console.log(sorted);
    sorted.sort((a, b) => Number(b.kev) - Number(a.kev));   // most imporatant: is it currently actively exploited?
    // console.log(sorted);
    return sorted;
}

/**
 * Evaluate final status of scan from a given results array, and returns "ok", "none" or "unavailable"
 */
function evaluateStatus(results) {
    if (results.length === 0) {         // evaluate as none if there were no cves
        return "none";
    }
    for (const result of results) {
        if (result.status === "ok") {   // evaluate as ok if theres at least 1 cve
            return "ok";
        }
    }
    return "unavailable";               // evaluate as unavailable if every cve lookup failed
}

/**
 * From a given array of cve ids, checks their validity and returns their ordered severity, epss, kev, and summmary data using Shodan CVEDB's API
 */
async function checkCves(ids) {
    const uniqueIds = [...new Set(ids)];
    const results = await fetchCves(uniqueIds);
    // console.log(results);
    return {
        records: { cves: sortCves(results) },
        checks: { cves: evaluateStatus(results) }
    }
}

module.exports = { checkCves };