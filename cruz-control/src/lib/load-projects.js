import api from "./api";

// Loads the user's projects and invites together and returns { projects, invites }. A failed invite list still returns the projects
export const loadProjectData = async _ => {
    const [projectResponse, inviteResponse] = await Promise.all([api.get("/api/project"), api.get("/api/invite").catch(_ => ({ data: [] }))]);
    return { projects: projectResponse.data, invites: inviteResponse.data };
}
