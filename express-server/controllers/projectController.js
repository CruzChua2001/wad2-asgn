const { supabase } = require("../lib/supabase");
const { checkWebsite } = require("../lib/domain");
const { checkRepo } = require("../lib/github");
const { buildFindings } = require("../lib/findings");

const checkTargets = (domain, githubRepo) => {
    const site = domain ? checkWebsite(domain) : null;
    const repo = githubRepo ? checkRepo(githubRepo) : null;

    if (site && !site.isValid) {
        return { error: site.reason };
    }
    if (repo && !repo.isValid) {
        return { error: repo.reason };
    }

    return { domain: site?.hostname ?? null, githubRepo: repo?.repo ?? null };
}

// The projects table allows names of 1 to 60 characters
const cleanName = name => (typeof name === "string" ? name.trim() : "");

const getProjects = async (req, res) => {
    const { data, error } = await supabase.from("project_members").select("role, projects(*)").eq("user_id", req.user.id);

    if (error) {
        console.error("Load projects failed:", error);
        return res.status(500).json({ error: "Could not load projects. Please try again." });
    }

    // Newest project first, the same order the page adds new ones in
    const projects = data.map(m => ({ ...m.projects, role: m.role, latestScan: null, scores: [] }))
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    if (projects.length === 0) {
        return res.json(projects);
    }

    // One query for the scans of every project, newest first
    const ids = projects.map(p => p.id);
    const { data: scans, error: scanError } = await supabase.from("scans").select("id, project_id, created_at, domain_scans(result), repo_scans(result)")
        .in("project_id", ids).order("created_at", { ascending: false });

    // Still send the projects, just without scores
    if (scanError) {
        console.error("Load project scores failed:", scanError);
        return res.json(projects);
    }

    for (const project of projects) {
        const recent = scans.filter(scan => scan.project_id === project.id).slice(0, 8).map(scan => {
            const { score, grade } = buildFindings(scan);
            return { id: scan.id, created_at: scan.created_at, score, grade };
        });

        if (recent.length > 0) {
            project.latestScan = recent[0];
            project.scores = recent.map(scan => scan.score).reverse();
        }
    }

    res.json(projects);
};

const createProject = async (req, res) => {
    const { domain, githubRepo, scanId } = req.body;
    const name = cleanName(req.body.name);

    if (!name || (!domain && !githubRepo)) {
        return res.status(400).json({ error: "Add a name and at least a domain or GitHub repo." });
    }
    if (name.length > 60) {
        return res.status(400).json({ error: "Keep the project name to 60 characters or fewer." });
    }

    const targets = checkTargets(domain, githubRepo);
    if (targets.error) {
        return res.status(400).json({ error: targets.error });
    }

    let newProject = {
        name,
        domain: targets.domain,
        github_repo: targets.githubRepo,
        created_by: req.user.id
    }

    const { data, error } = await supabase.from("projects").insert(newProject).select().single();

    if (error) {
        console.error("Create project failed:", error);
        return res.status(500).json({ error: "Could not create project. Please try again." });
    }

    let newData = {
        project_id: data.id, 
        user_id: req.user.id, 
        role: "owner"
    }
    const { error: memberError } = await supabase.from("project_members").insert(newData);

    if(memberError) {
        await supabase.from("projects").delete().eq("id", data.id);
        console.error("Add owner failed:", memberError);
        return res.status(500).json({ error: "Could not create project. Please try again." });
    }

    // Save to project: copy the scan into the new project
    if (scanId) {
        const { data: scan } = await supabase.from("scans").select("domain_scan_id, repo_scan_id").eq("id", scanId).is("project_id", null).maybeSingle();

        if (scan) {
            const { error: scanError } = await supabase.from("scans").insert({ ...scan, project_id: data.id, user_id: req.user.id });

            if (scanError) {
                console.error("Save scan to project failed:", scanError);
            }
        }
    }

    res.status(201).json({ ...data, role: "owner" });
};

const updateProjectById = async (req, res) => {
    const { domain, githubRepo } = req.body;
    const name = cleanName(req.body.name);

    if (!name || (!domain && !githubRepo)) {
        return res.status(400).json({ error: "Add a name and at least a domain or GitHub repo." });
    }
    if (name.length > 60) {
        return res.status(400).json({ error: "Keep the project name to 60 characters or fewer." });
    }

    const targets = checkTargets(domain, githubRepo);
    if (targets.error) {
        return res.status(400).json({ error: targets.error });
    }

    let updatedProject = {
        name,
        domain: targets.domain,
        github_repo: targets.githubRepo
    }
    const { data, error } = await supabase.from("projects").update(updatedProject).eq("id", req.params.id).select().single();

    if (error) {
        console.error("Update project failed:", error);
        return res.status(500).json({ error: "Could not update project. Please try again." });
    }
    res.json({ ...data, role: "owner" });
}

const deleteProjectById = async (req, res) => {
    const { data, error } = await supabase.from("projects").delete().eq("id", req.params.id).eq("created_by", req.user.id).select();

    if (error) {
        console.error("Delete project failed:", error);
        return res.status(500).json({ error: "Could not delete project. Please try again." });
    }

    if(data.length === 0) {
        return res.status(403).json({ error: "Only the project creator can delete it." });
    }

    res.status(204).end();
}

const getScansByProjectId = async (req, res) => {
    const { data, error } = await supabase.from("scans").select("id, created_at, domain_scans(result), repo_scans(result)")
        .eq("project_id", req.params.id).order("created_at", { ascending: false });

    if (error) {
        console.error("Load project scans failed:", error);
        return res.status(500).json({ error: "Could not load scan history. Please try again." });
    }

    // Scores use today's rules, so past scores move when the formula changes
    res.json(data.map(scan => {
        const { score, grade } = buildFindings(scan);
        return { id: scan.id, created_at: scan.created_at, score, grade };
    }));
}

module.exports = { getProjects, createProject, updateProjectById, deleteProjectById, getScansByProjectId };