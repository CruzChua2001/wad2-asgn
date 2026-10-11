// Convert github link to owner/repo
const checkRepo = input => {
    if (typeof input !== "string" || !input.trim()) {
        return { isValid: false, reason: "Enter a public GitHub repository." };
    }

    const repo = input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^(www\.)?github\.com\//, "")
        .replace(/\.git$/, "").replace(/\/+$/, "");

    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) {
        return { isValid: false, reason: "Use a public GitHub URL or owner/repository." };
    }

    return { isValid: true, repo }
}

// GET from GitHub API.
const githubGet = async path => {
    const headers = { Accept: "application/vnd.github+json" };

    if (process.env.GITHUB_TOKEN) {
        headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    try {
        const response = await fetch(`https://api.github.com${path}`, { headers, signal: AbortSignal.timeout(10000) });

        return { 
            status: response.status, 
            data: response.ok ? await response.json() : null 
        };
    } catch (e) {
        return { status: 0, data: null };
    }
}

module.exports = { checkRepo, githubGet };