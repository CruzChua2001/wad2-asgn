const { githubGet } = require("../lib/github");

// get all sentitive files, e.g. .env .pems
const SENSITIVE_FILES = [/^\.env$/, /^\.env\.(local|development|production|staging)$/, /\.pem$/, /\.key$/, /^id_rsa$/, /^id_ed25519$/, /^credentials\.json$/, /\.p12$/];

const checkRepoFiles = async (repo, sha) => {
    const { data } = await githubGet(`/repos/${repo}/git/trees/${sha}?recursive=1`);

    if (!data) {
        return { 
            records: { sensitiveFiles: [], basics: null }, 
            checks: { files: "unavailable" } 
        };
    }

    const paths = data.tree.filter(item => item.type === "blob").map(item => item.path);

    const sensitiveFiles = paths.filter(path => {
        const name = path.split("/").pop();
        return SENSITIVE_FILES.some(pattern => pattern.test(name));
    })

    const basics = {
        securityPolicy: paths.some(path => /^(\.github\/|docs\/)?security\.md$/i.test(path)),
        dependabot: paths.includes(".github/dependabot.yml") || paths.includes(".github/dependabot.yaml"),
        lockfile: paths.some(path => ["package-lock.json", "yarn.lock", "pnpm-lock.yaml"].includes(path)),
        packageJson: paths.includes("package.json"),
    }

    return { 
        records: { sensitiveFiles, basics }, 
        checks: { files: "ok" } 
    };
}

module.exports = { checkRepoFiles };