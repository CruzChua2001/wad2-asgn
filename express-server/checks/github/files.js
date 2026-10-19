const { githubGet } = require("../../lib/github");

// get all sentitive files, e.g. .env .pems
const SENSITIVE_FILES = [/^\.env$/, /^\.env\.(local|development|production|staging)$/, /\.pem$/, /\.key$/, /^id_rsa$/, /^id_ed25519$/, /^credentials\.json$/, /\.p12$/];

// Renovate reads its config from any of these names, at the root or under .github/
const RENOVATE_FILE = /^(\.github\/)?(renovate\.json5?|\.renovaterc(\.json5?)?)$/;

const README_FILE = /^readme(\.md)?$/i;
const README_SETUP = /setup|set up|install|usage|getting started/i;
const README_SECURITY = /security|vulnerabilit/i;

const KEY_RULES = /\.(pem|key|p12|pfx)/;

// GitHub Actions workflows, read for the three CI checks (C11)
const WORKFLOW_FILE = /^\.github\/workflows\/[^/]+\.ya?ml$/i;
const MAX_WORKFLOWS = 10;

// uses: owner/name@ref, with the quotes of uses: "actions/checkout@v4" stripped
const USES_LINE = /uses:\s*["']?([^\s@#"']+)@([^\s#"']+)/g;
const PINNED_REF = /^[0-9a-f]{40}$/;
const OFFICIAL_OWNERS = ["actions", "github"];

// Text anyone can write, so using it inside a run: step runs their commands with your secrets
const UNSAFE_INPUT = /\$\{\{[^}]*github\.event\.(issue\.(title|body)|comment\.body|review\.body|pull_request\.(title|body|head\.ref)|head_commit\.message)[^}]*\}\}|github\.head_ref/;

// A pull_request_target workflow that checks out the pull request's own code
const PR_HEAD = /github\.event\.pull_request\.head\.(sha|ref)/;

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

/**
 * What one workflow file says about permissions, pinned actions and dangerous lines (C11).
 * Plain regex, no YAML library, and commented-out lines are ignored.
 */
const readWorkflow = (name, text) => {
    const lines = text.split("\n");
    const prTarget = text.includes("pull_request_target");

    let thirdParty = 0;
    const unpinned = [];
    const dangerous = [];
    const seen = new Set();

    lines.forEach((line, index) => {
        const trimmed = line.trim();

        if (trimmed.startsWith("#")) {
            return;
        }

        USES_LINE.lastIndex = 0;
        let match = USES_LINE.exec(line);
        while (match) {
            const [, action, ref] = match;
            const owner = action.split("/")[0];

            if (!action.startsWith("./") && !action.startsWith("docker:") && !OFFICIAL_OWNERS.includes(owner)) {
                thirdParty++;
                if (!PINNED_REF.test(ref)) {
                    unpinned.push({ file: name, uses: `${action}@${ref}` });
                }
            }

            match = USES_LINE.exec(line);
        }

        // An if: line only decides whether a step runs, so it isn't the injection itself.
        // A step's first key is written as "- if:", so drop the list dash before checking.
        const key = trimmed.startsWith("- ") ? trimmed.slice(2).trim() : trimmed;
        const unsafe = !key.startsWith("if:") && UNSAFE_INPUT.test(line);

        if ((unsafe || (prTarget && PR_HEAD.test(line))) && !seen.has(index)) {
            seen.add(index);
            dangerous.push({ file: name, line: index + 1, text: trimmed.slice(0, 120) });
        }
    });

    return {
        permissions: /^permissions:/m.test(text),
        thirdParty,
        unpinned,
        dangerous,
    };
}

const checkRepoFiles = async (repo, sha) => {
    const { data } = await githubGet(`/repos/${repo}/git/trees/${sha}?recursive=1`);

    if (!data) {
        return {
            records: { sensitiveFiles: [], basics: null, gitignore: null, readme: null, workflows: null },
            checks: { files: "unavailable", gitignore: "unavailable", readme: "unavailable", workflows: "unavailable" }
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

    // Only these two files and up to 10 workflow files are ever read, never any other file's contents
    const readmePath = paths.find(path => README_FILE.test(path));
    const workflowPaths = paths.filter(path => WORKFLOW_FILE.test(path)).slice(0, MAX_WORKFLOWS);

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

    let workflows = null;
    let workflowStatus = "not_applicable";

    if (workflowPaths.length > 0) {
        const texts = await Promise.all(workflowPaths.map(path => readFile(repo, sha, path)));

        if (texts.some(text => text === null)) {
            workflowStatus = "unavailable";
        } else {
            const names = workflowPaths.map(path => path.split("/").pop());
            const read = texts.map((text, index) => readWorkflow(names[index], text));

            workflows = {
                files: names,
                noPermissions: names.filter((name, index) => !read[index].permissions),
                unpinned: read.flatMap(file => file.unpinned),
                thirdPartyCount: read.reduce((sum, file) => sum + file.thirdParty, 0),
                dangerous: read.flatMap(file => file.dangerous),
            };
            workflowStatus = "ok";
        }
    } else if (data.truncated) {
        // The tree was cut short, so we can't say the repo has no workflows
        workflowStatus = "unavailable";
    }

    return {
        records: { sensitiveFiles, basics, gitignore, readme, workflows },
        checks: { files: "ok", gitignore: gitignoreStatus, readme: readmeStatus, workflows: workflowStatus }
    };
}

module.exports = { checkRepoFiles, readWorkflow };
