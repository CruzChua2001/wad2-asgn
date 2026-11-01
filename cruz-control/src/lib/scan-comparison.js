// Both history summaries and full API scans use this same target key.
// Missing metadata is unknown; explicit null means this target was not scanned.
export const targetKey = scan => {
    const domain = "domain_scans" in scan ? (scan.domain_scans === null ? null : scan.domain_scans?.domain) : scan.domain;
    const repo = "repo_scans" in scan ? (scan.repo_scans === null ? null : scan.repo_scans?.github_repo) : scan.github_repo;
    const clean = value => value === null ? null : typeof value === "string" && value.trim()
        ? value.trim().toLowerCase() : undefined;
    const site = typeof domain === "string" ? clean(domain)?.replace(/\.$/, "") : clean(domain);
    const repository = clean(repo);
    if (site === undefined || repository === undefined || (!site && !repository)) return null;
    return JSON.stringify([site, repository]);
};

export const sameTargets = (a, b) => targetKey(a) !== null && targetKey(a) === targetKey(b);
export const newestFirst = scans => [...scans].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
export const scanDate = value => value && Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "Date unknown";
export const captureDates = scan => ({
    domain: scan.domain_scans?.created_at ?? scan.domain_captured_at ?? null,
    repo: scan.repo_scans?.created_at ?? scan.repo_captured_at ?? null,
});

// Sort evidence arrays and object keys; ignore incidental timestamp fields.
// Titles and explanation wording are deliberately not evidence.
const canonical = value => {
    if (Array.isArray(value)) return value.map(canonical).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort()
        .filter(key => !/^(created_at|updated_at|timestamp|scanned_at|fetched_at|checked_at)$/i.test(key))
        .map(key => [key, canonical(value[key])]));
    return value;
};
const evidence = finding => JSON.stringify(canonical({
    severity: finding.severity, kind: finding.kind, category: finding.category,
    checkId: finding.checkId ?? null, source: finding.source,
    hosts: [...new Set(finding.hosts || [])], details: finding.details ?? null,
}));
const checked = (scan, id) => !!id && scan.checks?.some(check => check.id === id && check.status === "ok");

export const compareScans = (a, b) => {
    if (a.id === b.id) return { error: "Choose two different scans." };
    if (!sameTargets(a, b)) return { error: "Choose scans with the same website and repository targets and scope." };
    if (![a.created_at, b.created_at].every(date => Number.isFinite(Date.parse(date)))) {
        return { error: "Cannot compare scans with an unknown record date." };
    }
    const [older, newer] = new Date(a.created_at) <= new Date(b.created_at) ? [a, b] : [b, a];
    const before = new Map((older.findings || []).map(f => [f.id, f]));
    const after = new Map((newer.findings || []).map(f => [f.id, f]));
    const rows = [...new Set([...before.keys(), ...after.keys()])].map(id => {
        const oldFinding = before.get(id);
        const newFinding = after.get(id);
        const finding = newFinding || oldFinding;
        let status = "uncertain";
        if (oldFinding && newFinding) status = evidence(oldFinding) === evidence(newFinding) ? "present" : "changed";
        else if (checked(older, finding.checkId) && checked(newer, finding.checkId)) status = newFinding ? "new" : "gone";
        return { id, finding, oldFinding, newFinding, status };
    });
    const oldDates = captureDates(older);
    const newDates = captureDates(newer);
    const reusedSources = ["domain", "repo"].filter(source => oldDates[source] && newDates[source]
        && Date.parse(oldDates[source]) === Date.parse(newDates[source]));
    const delta = [older.score, newer.score].every(Number.isFinite) ? newer.score - older.score : null;
    return { older, newer, delta, rows, reusedSources };
};
