const { supabase } = require("../lib/supabase");

const getProjects = async (req, res) => {
    const { data, error } = await supabase.from("project_members").select("role, projects(*)").eq("user_id", req.user.id);

    if (error) {
        console.error("Load projects failed:", error);
        return res.status(500).json({ error: "Could not load projects. Please try again." });
    }

    res.json(data.map(m => ({ ...m.projects, role: m.role })));
};

const createProject = async (req, res) => {
    const { name, domain, githubRepo } = req.body;

    if (!name || (!domain && !githubRepo)) {
        return res.status(400).json({ error: "Add a name and at least a domain or GitHub repo." });
    }

    let newProject = {
        name, 
        domain: domain || null,
        github_repo: githubRepo || null,
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

    res.status(201).json({ ...data, role: "owner" });
};

module.exports = { getProjects, createProject };