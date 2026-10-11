const { supabase } = require("../lib/supabase");

const getRole = async (projectId, userId) => {
    const { data } = await supabase.from("project_members").select("role").eq("project_id", projectId).eq("user_id", userId).maybeSingle();
    return data?.role;
}

const projectMember = async (req, res, next) => {
    if (!(await getRole(req.params.id, req.user.id))) {
        return res.status(403).json({ error: "You don't have access to this project." });
    }
    
    next();
}

const projectOwner = async (req, res, next) => {
    if ((await getRole(req.params.id, req.user.id)) !== "owner") {
        return res.status(403).json({ error: "Only project owners can do this." });
    }

    next();
};

const projectCreator = async (req, res, next) => {
    const { data } = await supabase.from("projects").select("created_by").eq("id", req.params.id).maybeSingle();
    if (data?.created_by !== req.user.id) {
        return res.status(403).json({ error: "Only the project creator can do this." });
    }

    next();
}

module.exports = {
    projectMember,
    projectOwner,
    projectCreator
}