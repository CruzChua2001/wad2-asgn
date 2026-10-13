const SOURCE_LABELS = { domain: "Website", repo: "Repository" };

const getRating = score => {
    if (score >= 80) {
        return "Good";
    }
    if (score >= 60) {
        return "Needs work";
    }
    return "At risk";
}

const lastScanTime = date => {
    const minutes = Math.floor((Date.now() - new Date(date).getTime()) / 60000);

    if (minutes < 1) {
        return "just now"
    } 
    if (minutes < 60) {
        return `${minutes} minute(s) ago`;
    }

    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
        return `${hours} hour(s) ago`;
    }

    return new Date(date).toLocaleDateString();
}

const getHostName = (ip, domainScan) => {
    const records = domainScan.result.records;

    if (records.a && records.a.includes(ip)) {
        return domainScan.domain;
    }
    if (records.aaaa && records.aaaa.includes(ip)) {
        return domainScan.domain;
    }
    
    for (let subdomain of records.subdomains) {
        if (subdomain.ips && subdomain.ips.includes(ip)) {
            return subdomain.hostname;
        }
    }

    return ip;
}

const getServerStatus = (ip, portRecord, findings, isCdn = false) => {
    let status = "healthy";

    // mark CDN edge's open ports/vulns as non-critical as they are shared infrastructure
    if (!isCdn && portRecord && portRecord.vulns.length > 0) {
        return "critical";
    }
    if (isCdn) {
        return status;
    }

    for (let finding of findings) {
        if (finding.hosts && finding.hosts.includes(ip)) {
            if (finding.severity === "critical" || finding.severity === "high") {
                return "critical";
            }
            status = "attention";
        }
    }

    return status;
}

const getFindings = data => {
    let findings = [];

    for (let finding of data.findings) {
        let nodeId = null;
        if (finding.hosts) {
            nodeId = finding.hosts[0]
        }

        findings.push({
            id: finding.id,
            category: finding.category,
            kind: finding.kind,
            severity: finding.severity,
            title: finding.title,
            why: finding.explain,
            fix: finding.fix,
            source: SOURCE_LABELS[finding.source],
            hosts: finding.hosts,
            files: finding.files,
            details: finding.details,
            nodeId: nodeId,
        });
    }

    return findings;
}

const getServers = (domainScan, findings) => {
    let servers = [];

    if (!domainScan) {
        return servers;
    }

    const records = domainScan.result.records;
    const cdn = new Set(records.cdnIps ?? []);

    for (let geo of records.geo) {
        if (geo.status !== "ok"){
            continue;
        }

        let portRecord = records.ports.find(item => item.ip === geo.ip);
        let ports = [];

        if (portRecord) {
            ports = portRecord.ports;
        }

        const isCdn = cdn.has(geo.ip);

        let service = "None found";
        let summary = "No open services were listed for this server.";

        if (ports.length > 0) {
            if (ports.length > 6) {
                service = ports.slice(0, 6).join(", ");
                service += "..."
            } else {
                service = ports.join(", ");
            }   

            
            summary = `${ports.length} open service(s) found on this server.`;
        }

        if (isCdn) {
            summary = "CDN edge server — shared infrastructure, not scored against you.";
        }

        servers.push({
            id: geo.ip,
            host: getHostName(geo.ip, domainScan),
            ip: geo.ip,
            city: geo.city,
            country: geo.country,
            lat: geo.lat,
            lng: geo.lon,
            provider: geo.isp,
            org: geo.org,
            as: geo.as,
            asname: geo.asname,
            service: service,
            status: getServerStatus(geo.ip, portRecord, findings, isCdn),
            summary: summary,
            isCdn: isCdn,
        });
    }

    const order = { critical: 0, attention: 1, healthy: 2 };
    servers.sort((a, b) => order[a.status] - order[b.status]);

    return servers;
}

export const toResult = data => {
    let findings = getFindings(data);
    let servers = getServers(data.domain_scans, findings);
    let domain = null;
    let openServices = 0;
    let linkedRepository = null;
    let repo = null;
    let serious = 0;
    let summary = "No serious issues found.";
    const arcs = [];
    let stats = []
     let scannedAt = null;

    if (data.domain_scans) {
        domain = data.domain_scans.domain;
        for (let item of data.domain_scans.result.records.ports) {
            openServices += item.ports.length;
        }
    }

    if (data.repo_scans) {
        linkedRepository = data.repo_scans.github_repo;
        repo = data.repo_scans.result;
    }

    for (let finding of findings) {
        if (finding.severity === "critical" || finding.severity === "high") {
            serious++;
        }
    }

    if(serious > 0) {
        summary = `${serious} serious issue(s) are pulling your score down. Fix those first.`;
    }

    for (let i = 1; i < servers.length; i++) {
        arcs.push({ id: servers[i].id, from: servers[0], to: servers[i], status: servers[i].status });    
    }

    if (data.domain_scans) {
        stats.push({ label: "Servers found", value: servers.length });
        stats.push({ label: "Open services", value: openServices });
    }
    if (data.repo_scans) {
        stats.push({ label: "Vulnerable packages", value: repo.records.dependencies.length });
        if (!data.domain_scans) {
            stats.push({ label: "Secret files", value: repo.records.sensitiveFiles.length });
        }
    }
    stats.push({ label: "Issues found", value: findings.length })

    if (data.domain_scans) {
        scannedAt = data.domain_scans.created_at;
    }
    if (data.repo_scans) {
        if (!scannedAt || new Date(data.repo_scans.created_at) < new Date(scannedAt)) {
            scannedAt = data.repo_scans.created_at;
        }
    }

    return {
        title: domain || linkedRepository,
        domain: domain,
        linkedRepository: linkedRepository,
        repo: repo,
        score: data.score,
        grade: data.grade,
        rating: `Grade ${data.grade} · ${getRating(data.score)}`,
        breakdown: data.breakdown,
        checks: data.checks,
        cap: data.cap,
        incomplete: data.incomplete,
        uncappedScore: data.uncappedScore,
        summary,
        nodes: servers,
        arcs,
        findings,
        stats,
        scannedAt: scannedAt,
        scannedAgo: lastScanTime(scannedAt),
        projectId: data.project_id,
        role: data.role
    }
}

