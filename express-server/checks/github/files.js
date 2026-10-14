const { githubGet } = require("../../lib/github");

// get all sentitive files, e.g. .env .pems
const SENSITIVE_FILES = [/^\.env$/, /^\.env\.(local|development|production|staging)$/, /\.pem$/, /\.key$/, /^id_rsa$/, /^id_ed25519$/, /^credentials\.json$/, /\.p12$/];

// Renovate reads its config from any of these names, at the root or under .github/
const RENOVATE_FILE = /^(\.github\/)?(renovate\.json5?|\.renovaterc(\.json5?)?)$/;

const README_FILE = /^readme(\.md)?$/i;
const README_SETUP = /setup|set up|install|usage|getting started/i;
const README_SECURITY = /security|vulnerabilit/i;

const KEY_RULES = /\.(pem|key|p12|pfx)/;

/**
 * Read one file's text through the contents API, returning null if it cannot be read
 */
const readFile = async (repo, sha, path) => {
    const { data } = await githubGet(`/repos/${repo}/contents/${path}?ref=${sha}`);

    if (!data || typeof data.content !== "string") {
        return null;
    }

    return Buffer.from(data.content, "base64").toString("utf8");
}

/**
 * Which of .env files, node_modules and key files a .gitignore covers.
 * Negated lines (e.g. !.env.example) put a file back in, so they are not coverage.
 */
const readGitignore = text => {
    const rules = text.split("\n")
        .map(line => line.trim())
        .filter(line => line && !line.startsWith("#") && !line.startsWith("!"));

    return {
        env: rules.some(rule => rule.includes(".env")),
        nodeModules: rules.some(rule => rule.includes("node_modules")),
        keys: rules.some(rule => KEY_RULES.test(rule)),
    };
}

const checkRepoFiles = async (repo, sha) => {
    const { data } = await githubGet(`/repos/${repo}/git/trees/${sha}?recursive=1`);

    if (!data) {
        return {
            records: { sensitiveFiles: [], basics: null, gitignore: null, readme: null },
            checks: { files: "unavailable", gitignore: "unavailable", readme: "unavailable" }
        };
    }

    const paths = data.tree.filter(item => item.type === "blob").map(item => item.path);

    const sensitiveFiles = paths.filter(path => {
        const name = path.split("/").pop();
        return SENSITIVE_FILES.some(pattern => pattern.test(name));
    })

    const basics = {
        securityPolicy: paths.some(path => /^(\.github\/|docs\/)?security\.md$/i.test(path)),
        dependabot: paths.includes(".github/dependabot.yml") || paths.includes(".github/dependabot.yaml")
            || paths.some(path => RENOVATE_FILE.test(path)),
        lockfile: paths.some(path => ["package-lock.json", "yarn.lock", "pnpm-lock.yaml"].includes(path)),
        packageJson: paths.includes("package.json"),
    }

    // Only these two files are ever read, never any other file's contents
    const readmePath = paths.find(path => README_FILE.test(path));

    const [gitignoreText, readmeText] = await Promise.all([
        paths.includes(".gitignore") ? readFile(repo, sha, ".gitignore") : null,
        readmePath ? readFile(repo, sha, readmePath) : null
    ]);

    let gitignore = null;
    let gitignoreStatus = "none";
    if (paths.includes(".gitignore")) {
        gitignoreStatus = gitignoreText === null ? "unavailable" : "ok";
        if (gitignoreText !== null) {
            gitignore = readGitignore(gitignoreText);
        }
    }

    let readme = null;
    let readmeStatus = "none";
    if (readmePath) {
        readmeStatus = readmeText === null ? "unavailable" : "ok";
        if (readmeText !== null) {
            readme = {
                setup: README_SETUP.test(readmeText),
                security: README_SECURITY.test(readmeText),
            };
        }
    }

    return {
        records: { sensitiveFiles, basics, gitignore, readme },
        checks: { files: "ok", gitignore: gitignoreStatus, readme: readmeStatus }
    };
}

module.exports = { checkRepoFiles };
