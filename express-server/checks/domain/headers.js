const TIMER_MS = 5000; // timeout of 5s in case a page takes too long to respond

/**
 * GET one page without downloading its body, returning null if nothing answered
 */
const getPage = async (url, redirect) => {
    try {
        const response = await fetch(url, { redirect, signal: AbortSignal.timeout(TIMER_MS) });
        await response.body?.cancel();
        return response;
    } catch (error) {
        return null;    // refused, timed out or a bad certificate
    }
}

/**
 * Follow http:// redirects by hand (at most 5), stopping at the first one that goes to https://
 */
const followHttp = async hostname => {
    let url = `http://${hostname}/`;
    let response = null;

    for (let i = 0; i < 5; i++) {
        response = await getPage(url, "manual");
        const location = response?.headers.get("location");

        if (!location || response.status < 300 || response.status >= 400) {
            break;
        }

        let next;
        try {
            next = new URL(location, url);
        } catch (error) {
            break;  // a broken Location header
        }

        if (next.protocol === "https:") {
            return { response, toHttps: true };
        }
        url = next.href;
    }

    return { response, toHttps: false };
}

/**
 * Request the http:// and https:// home pages and read their security settings
 */
const checkHeaders = async hostname => {
    const [httpsPage, http] = await Promise.all([
        getPage(`https://${hostname}/`, "follow"),
        followHttp(hostname)
    ]);

    // Some https pages redirect back to http, which doesn't count as https
    const https = httpsPage?.url.startsWith("https:") ? httpsPage : null;

    // Read the https page, or the http page on sites without https.
    // If https failed but http sends visitors there (e.g. a bad certificate), there's no page to read.
    let page = https;
    if (!page && !http.toHttps) {
        page = http.response;
    }

    if (!page) {
        return { records: { headers: null }, checks: { headers: "unavailable" } };
    }

    return {
        records: {
            headers: {
                url: page.url,
                https: Boolean(https),
                httpRedirect: http.response ? http.toHttps : null,   // null when port 80 didn't answer
                hsts: https?.headers.get("strict-transport-security") ?? null,
                csp: page.headers.get("content-security-policy"),
                frameOptions: page.headers.get("x-frame-options"),
                contentType: page.headers.get("x-content-type-options"),
            }
        },
        checks: { headers: "ok" }
    };
}

module.exports = { checkHeaders };
