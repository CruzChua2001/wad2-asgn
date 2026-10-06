// Shared by the root layout (server) and theme-store (client), so it must not be a "use client" module.
export const THEME_STORAGE_KEY = "cruz-control-theme-v2";

// Runs while the HTML is parsed, before the first paint, so the saved theme is on <html>
// before anything renders. Without it the server's light default shows until React hydrates.
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==="dark"||t==="light")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;
