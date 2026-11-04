let cachedProjects = null;

export const getProjectCache = _ => cachedProjects;

export const setProjectCache = data => {
    cachedProjects = data;
};

export const clearProjectCache = _ => {
    cachedProjects = null;
};