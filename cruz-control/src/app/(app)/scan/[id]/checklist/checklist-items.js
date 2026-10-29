
export const CHECKLIST_SECTIONS = [
    {
        title: "Before you push code",
        items: [
            {
                id: "gitignore-node-modules",
                title: "node_modules is in .gitignore",
                hint: "Stops you uploading thousands of files you did not write.",
                categories: ["ignore-rules"],
                match: { text: ["node_modules"] },
            },
            {
                id: "gitignore-env",
                title: ".env is in .gitignore",
                hint: "Your .env file holds secret keys. If it is committed, anyone who sees the repo can read them.",
                categories: ["ignore-rules", "secrets"],
                match: { text: [".env"] },
            },
            {
                id: "lockfile",
                title: "A lockfile (package-lock.json) is committed",
                hint: "Makes sure your teammates install exactly the same versions you did.",
                categories: ["repo-basics"],
                match: { text: ["lock"] },
                includeTips: true,
            },
            {
                id: "no-secrets-in-code",
                title: "No passwords or keys anywhere in the code",
                hint: 'Search your project for the word "password" and for anything that looks like a long random string. The scan only checks file names, not what is inside your files.',
            },
        ],
    },
    {
        title: "Before you deploy",
        items: [
            {
                id: "database-rules",
                title: "Database rules require a login",
                hint: "If your database is open to everyone, anyone can read and delete your data. Check this in your database settings.",
            },
            {
                id: "api-keys-server",
                title: "Secret API keys live on a server, not in frontend code",
                hint: "Anything in the frontend is downloaded by every visitor, so it is never secret.",
            },
            {
                id: "libraries-safe",
                title: "Libraries have no known security bugs",
                hint: "Old libraries can have publicly known weaknesses. Updating them closes those holes.",
                categories: ["packages"],
            },
            {
                id: "validate-input",
                title: "Forms check their input before saving it",
                hint: "Never trust what a visitor types. Validate on the server, not just in the browser.",
            },
        ],
    },
    {
        title: "After it is live",
        items: [
            {
                id: "certificate",
                title: "The site has a valid HTTPS certificate",
                hint: "The padlock in the address bar. It keeps what visitors send and receive private.",
                categories: ["certificate"],
                match: { ids: ["cert-"] },
            },
            {
                id: "https-redirect",
                title: "Visitors who type http:// are sent to https://",
                hint: "Without this, someone on public Wi-Fi could read or change pages that were sent unencrypted.",
                categories: ["web-settings"],
                match: { text: ["redirect"] },
            },
            {
                id: "csp",
                title: "A Content-Security-Policy header is set",
                hint: "A browser rule that limits which scripts can run on your pages, which helps stop injected code.",
                categories: ["web-settings"],
                match: { ids: ["web-csp"] },
            },
            {
                id: "email-records",
                title: "Email records are configured (SPF, DKIM, DMARC)",
                hint: "These make it much harder for someone to send fake emails pretending to be your domain.",
                categories: ["email-dns"],
            },
            {
                id: "old-servers",
                title: "Old test servers are shut down",
                hint: "A forgotten server is an open door nobody is watching. Check your hosting provider's dashboard.",
            },
        ],
    },
];