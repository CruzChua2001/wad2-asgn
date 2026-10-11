const { githubGet } = require("../lib/github");

const checkDependencies = async (repo, sha) => {
    const file = await githubGet(`/repos/${repo}/contents/package.json?ref=${sha}`);

    if (!file.data) {
        return { 
            records: { dependencies: [] }, 
            checks: { dependencies: file.status === 404 ? "none" : "unavailable" } 
        };
    }

    try {
        const packageJson = JSON.parse(Buffer.from(file.data.content, "base64").toString());

        // Merge dependencies and devDependencies, map each pair to { name, version }
        const packages = Object.entries({ ...packageJson.dependencies, ...packageJson.devDependencies })
            .map(([name, range]) => ({ name, version: String(range).match(/\d+\.\d+\.\d+/)?.[0] }))
            .filter(pkg => pkg.version);

        // Return if no package or dependencies
        if (packages.length === 0) {
            return { records: { dependencies: [] }, checks: { dependencies: "none" } };
        }

        // Check with OSV about all the package
        // OSV - Open Source Vulnerability run by Google
        const response = await fetch("https://api.osv.dev/v1/querybatch", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ queries: packages.map(pkg => ({ package: { name: pkg.name, ecosystem: "npm" }, version: pkg.version })) }),
            signal: AbortSignal.timeout(10000),
        });

        const data = await response.json();

        // Match the vulnerability to the packages
        const dependencies = packages
            .map((pkg, i) => ({ ...pkg, vulns: (data.results[i].vulns ?? []).map(vuln => vuln.id) }))
            .filter(pkg => pkg.vulns.length > 0);

        return { 
            records: { dependencies }, 
            checks: { dependencies: dependencies.length ? "ok" : "none" } 
        };
    } catch (e) {
        return { 
            records: { dependencies: [] }, 
            checks: { dependencies: "unavailable" } 
        };
    }
}

module.exports = { checkDependencies }