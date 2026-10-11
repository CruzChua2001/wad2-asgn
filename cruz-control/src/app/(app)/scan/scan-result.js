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

const getServerStatus = (ip, portRecord, findings) => {
    let status = "healthy";
    
    if (portRecord && portRecord.vulns.length > 0) {
        return "critical";
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
            severity: finding.severity,
            title: finding.title,
            why: finding.explain,
            fix: finding.fix,
            source: SOURCE_LABELS[finding.source],
            hosts: finding.hosts,
            files: finding.files,
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

    for (let geo of records.geo) {
        if (geo.status !== "ok"){
            continue;
        }

        let portRecord = records.ports.find(item => item.ip === geo.ip);
        let ports = [];

        if (portRecord) {
            ports = portRecord.ports;
        }

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

        servers.push({
            id: geo.ip,
            host: getHostName(geo.ip, domainScan),
            ip: geo.ip,
            city: geo.city,
            country: geo.country,
            lat: geo.lat,
            lng: geo.lon,
            provider: geo.isp,
            service: service,
            status: getServerStatus(geo.ip, portRecord, findings),
            summary: summary,
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

    return {
        title: domain || linkedRepository,
        domain: domain,
        linkedRepository: linkedRepository,
        repo: repo,
        score: data.score,
        grade: data.grade,
        rating: `Grade ${data.grade} · ${getRating(data.score)}`,
        summary,
        nodes: servers,
        arcs,
        findings,
        stats
    }
}

