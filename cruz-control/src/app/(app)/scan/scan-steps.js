export const DOMAIN_STEPS = [
    "Resolving DNS records now...",
    "Checking email protection (SPF, DMARC)...",
    "Searching public certificate logs for subdomains...",
    "Collecting server IP addresses...",
    "Checking open ports and services...",
    "Locating servers around the world...",
    "Looking up known vulnerabilities (CVEs)...",
    "Putting your results together...",
]

export const REPO_STEPS = [
    "Looking up the repository on GitHub...",
    "Reading the latest commit...",
    "Listing files in the repository...",
    "Checking for committed secrets (.env, keys)...",
    "Checking security basics (SECURITY.md, Dependabot)...",
    "Reading package.json dependencies...",
    "Asking OSV.dev about known vulnerabilities...",
]