const { githubGet } = require("../../lib/github");

const checkRepoInfo = async repo => {
    const { status, data } = await githubGet(`/repos/${repo}`);

    if (!data) {
        return { 
            records: { repo: null, commitSha: null }, 
            checks: { repo: status === 404 ? "not_found" : "unavailable" } 
        };
    }

    const commit = await githubGet(`/repos/${repo}/commits/${data.default_branch}`);

    if (!commit.data) {
        return { 
            records: { repo: null, commitSha: null }, 
            checks: { repo: "unavailable"} 
        }; 
    }

    return {
        records: {
            repo: {
                name: data.full_name,
                description: data.description,
                url: data.html_url,
                defaultBranch: data.default_branch,
                archived: data.archived,
                stars: data.stargazers_count,
                pushedAt: data.pushed_at,
            },
            commitSha: commit.data.sha,
        },
        checks: { repo: "ok" },
    };
}

module.exports = { checkRepoInfo };