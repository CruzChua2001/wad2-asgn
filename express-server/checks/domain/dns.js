const dns = require("node:dns").promises;

const resolver = new dns.Resolver({ timeout: 5000, tries: 3 });
resolver.setServers(["1.1.1.1", "8.8.8.8"]); // use cloudflare/google dns servers

/**
 * Lookup a certain domain using a function as the input, then returns the status of it and its records if any
 */
async function lookupDomain(fn) {
    try {
        const records = await fn();
        return { status: "ok", data: records }; // record exists
    } catch (error) {
        if (error.code === "ENOTFOUND" || error.code === "ENODATA") {
            return { status: "none", data: null };  // record does not exist
        }
        return { status: "unavailable", data: null };   // domain might exist? (network/dns issues)
    }
}

/**
 * Find the first text record that begins with a given text marker (e.g. "v=spf1")
 */
function findText(textFile, text) {
    if (textFile.status !== "ok") {
        return null;
    }
    for (const item of textFile.data) {
        let line = item.join("");
        if (line.toLowerCase().startsWith(text)) {
            return line;
        }
    }
    return null;
}

/**
 * Lookup relevant DNS records and returns their status and data
 * TBD: Add logic to classify what was found into a findings object with its severity, reasoning, fix, etc.?
 */
async function checkDns(hostname, domain) {
    // run all dns checks in parallel and wait for responses
    const [a, aaaa, ns, mx, txt, dmarcTxt, caa] = await Promise.all([
        lookupDomain(() => resolver.resolve4(hostname)),                // a
        lookupDomain(() => resolver.resolve6(hostname)),                // aaaa
        lookupDomain(() => resolver.resolveNs(domain)),                 // ns
        lookupDomain(() => resolver.resolveMx(domain)),                 // mx
        lookupDomain(() => resolver.resolveTxt(domain)),                // txt
        lookupDomain(() => resolver.resolveTxt(`_dmarc.${domain}`)),    // dmarcTxt
        lookupDomain(() => resolver.resolveCaa(domain)),                // caa
    ]);

    return {
        records: {
            a: a.data,
            aaaa: aaaa.data,
            ns: ns.data,
            mx: mx.data,
            spf: findText(txt, "v=spf1"),
            dmarc: findText(dmarcTxt, "v=dmarc1"),
            caa: caa.data
        },
        checks: {
            a: a.status,
            aaaa: aaaa.status,
            ns: ns.status,
            mx: mx.status,
            txt: txt.status,
            dmarc: dmarcTxt.status,
            caa: caa.status
        },
    };
}

module.exports = { checkDns };