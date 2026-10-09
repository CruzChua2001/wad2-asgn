const TIMER_MS = 5000; // timeout of 5s in case ip-api takes too long to respond
const BATCH_SIZE = 100; // ip-api's free batch endpoint cap of 100 ips per request
const GLOBE_FIELDS = "status,query,country,city,lat,lon,isp"; // required fields for frontend's globe to work

/**
 * Given a batch of 100 ips, returns each ip's geolocation details using ip-api's API
 */
async function fetchGeolocation(ips) {
    try {
        // https://ip-api.com/docs/api:batch
        const response = await fetch(`http://ip-api.com/batch?fields=${GLOBE_FIELDS}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(ips),
            signal: AbortSignal.timeout(TIMER_MS)
        });
        if (!response.ok) {   // rate limits, server errors, etc.
            return ips.map((ip) => ({ status: "unavailable", ip, lat: null, lon: null, city: "", country: "", isp: "" }));
        }

        const data = await response.json();
        // console.log(data);
        return data.map((entry) => ({
            status: entry.status === "success" ? "ok" : "none",   // if not "success", ip-api cannot locate it, prob due to private/reserved ip
            ip: entry.query,
            lat: entry.lat ?? null,
            lon: entry.lon ?? null,
            city: entry.city ?? "",
            country: entry.country ?? "",
            isp: entry.isp ?? ""
        }));
    } catch (error) {   // network issues or timeout
        return ips.map((ip) => ({ status: "unavailable", ip, lat: null, lon: null, city: "", country: "", isp: "" }));
    }
}

/**
 * Locate every ip by sending them to ip-api 100 at a time, returning one record per ip
 */
async function fetchGeolocations(ips) {
    const geolocations = [];
    for (let i = 0; i < ips.length; i += BATCH_SIZE) {
        const batch = ips.slice(i, i + BATCH_SIZE);
        const results = await fetchGeolocation(batch);
        geolocations.push(...results);
    }
    return geolocations;
}

/**
 * Evaluate final status of scan from a given results array, returning "ok", "none" or "unavailable"
 */
function evaluateStatus(results) {
    const resultsLength = results.length;
    let noneCount = 0;
    for (const result of results) {
        if (result.status === "ok") {   // evaluate as ok if at least one ip was located
            return "ok";
        } else if (result.status === "none") {
            noneCount += 1;
        }
    }
    if (resultsLength > 0 && resultsLength === noneCount) {
        return "none";  // evaluate as none if every ip cant be located
    }
    return "unavailable";   // unavailable if every lookup failed or there were no ips
}

/**
 * From a given array of ips, locates and returns each ip's city/country/coordinates using ip-api's batch API
 */
async function checkGeolocation(ips) {
    const uniqueIps = [...new Set(ips)];
    const results = await fetchGeolocations(uniqueIps);
    return {
        records: { geo: results },
        checks: { geo: evaluateStatus(results) }
    };
}

module.exports = { checkGeolocation };