const { supabase } = require("../lib/supabase");

const getMembersByProjectId = async (req, res) => {
    const { data, error } = await supabase.from("project_members").select("user_id, role").eq("project_id", req.params.id);

    if (error) {
        console.error("Failed to load members:", error);
        return res.status(500).json({ error: "Could not load members. Please try again." });
    }

    const withEmails = await Promise.all(data.map(async member => {
        const { data: tmp } = await supabase.auth.admin.getUserById(member.user_id);
        return { ...member, email: tmp.user?.email };
    }))

    const { data: invites } = await supabase.from("project_invites").select("id, email, role, expires_at").eq("project_id", req.params.id);

    res.json({ members: withEmails, invites: invites ?? [] });
}

const inviteMember = async (req, res) => {
    const email = req.body.email?.trim().toLowerCase();
    const role = req.body.role === "owner" ? "owner" : "viewer";

    if (!email) {
        return res.status(400).json({ error: "Enter an email address." });
    }

    const { data:members } = await supabase.from("project_members").select("user_id").eq("project_id", req.params.id);

    const memberEmails = await Promise.all(members.map(async member => {
        const { data:tmp } = await supabase.auth.admin.getUserById(member.user_id);
        return tmp.user?.email?.toLowerCase();
    }))

    if (memberEmails.includes(email)) {
        return res.status(400).json({ error: "This person is already in the project." }); 
    }

    const sevenDaysInMSeconds = 7 * 24 * 60 * 60 * 1000;
    
    let inviteData = {
        project_id: req.params.id,
        email,
        role,
        invited_by: req.user.id,
        expires_at: new Date(Date.now() + sevenDaysInMSeconds)
    }

    const { data, error } = await supabase.from("project_invites").upsert(inviteData, { onConflict: "project_id,email" }).select().single();

    if (error) {
        console.error("Failed to invite:", error);
        return res.status(500).json({ error: "Could not send the invite. Please try again." });
    }

    // Inviting users not in the database, will be invited through email sign-up
    await supabase.auth.admin.inviteUserByEmail(email, { redirectTo: `${process.env.FRONTEND_URL}/project`});

    res.status(201).json(data);
}

const getInviteByCurrUser = async (req, res) => {
    const { data, error } = await supabase.from("project_invites").select("id, role, expires_at, projects(name, domain, github_repo)").eq("email", req.user.email.toLowerCase()).gt("expires_at", new Date().toISOString());

    if (error) {
        console.error("Failed to load invites:", error);
        return res.status(500).json({ error: "Could not load invites. Please try again." });
    }

    res.json(data);
}

const acceptInvite = async (req, res) => {
    const { data:invite } = await supabase.from("project_invites").select("*").eq("id", req.params.id).eq("email", req.user.email.toLowerCase()).gt("expires_at", new Date().toISOString()).maybeSingle();

    if (!invite) {
        return res.status(404).json({ error: "This invite has expired or doesn't exist." });
    }

    let data = { 
        project_id: invite.project_id,  
        user_id: req.user.id,
        role: invite.role
    }

    const { error } = await supabase.from("project_members").upsert(data, { onConflict: "project_id,user_id", ignoreDuplicates: true });

    if (error) {
        console.error("Failed to accept invite:", error);
        return res.status(500).json({ error: "Could not accept the invite. Please try again." });
    }

    await supabase.from("project_invites").delete().eq("id", invite.id);
    res.json({ projectId: invite.project_id });
}

const declineInvite = async (req, res) => {
    const { error } = await supabase.from("project_invites").delete().eq("id", req.params.id).eq("email", req.user.email.toLowerCase());

    if (error) {
        console.error("Failed to decline invite:", error);
        return res.status(500).json({ error: "Could not decline the invite. Please try again." });
    }

    res.status(204).end();
}

const removeMemberById = async (req, res) => {
    if (req.params.userId === req.user.id) {
        return res.status(400).json({ error: "You can't remove yourself from your own project." });
    }

    const { error } = await supabase.from("project_members").delete().eq("project_id", req.params.id).eq("user_id", req.params.userId);

    if (error) {
        console.error("Failed to remove member:", error);
        return res.status(500).json({ error: "Could not remove the member. Please try again." }); 
    }

    res.status(204).end();
}

const cancelInviteById = async (req, res) => {
    const { error } = await supabase.from("project_invites").delete().eq("project_id", req.params.id).eq("id", req.params.inviteId);

    if (error) {
        console.error("Failed to cancel invite:", error);
        return res.status(500).json({ error: "Could not cancel the invite. Please try again." });
    }

    res.status(204).end();
}

module.exports = { 
    getMembersByProjectId, 
    inviteMember, 
    getInviteByCurrUser, 
    acceptInvite, 
    declineInvite,
    removeMemberById,
    cancelInviteById
}