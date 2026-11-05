import { Term, withTerms } from "./glossary";

const MAX_SHOWN_CVES = 10;

// Package vulnerabilities use OSV and GitHub IDs (GHSA-...), not only CVEs.
function vulnUrl(id) {
  if (id.startsWith("CVE-")) {
    return `https://nvd.nist.gov/vuln/detail/${id}`;
  }
  return `https://osv.dev/vulnerability/${id}`;
}

function VulnLink({ id }) {
  return (
    <a href={vulnUrl(id)} target="_blank" rel="noreferrer" className="font-mono text-accent underline">{id}</a>
  );
}

// Technical data behind a finding, shaped by the finding type (see the data shapes table).
export default function FindingDetails({ details }) {
  return (
    <dl className="m-0 flex flex-col gap-2 text-sm text-muted">
      {details.cves && (
        <div className="flex flex-col gap-2">
          {details.cves.slice(0, MAX_SHOWN_CVES).map((cve, index) => (
            <div key={cve.id}>
              <VulnLink id={cve.id} />
              <span className="ml-2">
                {index === 0 ? <Term term="CVSS" /> : "CVSS"} {cve.cvss ?? "?"} ·{" "}
                {index === 0 ? <Term term="EPSS" /> : "EPSS"} {cve.epss == null ? "?" : `${Math.round(cve.epss * 100)}%`}
                {cve.kev && <strong className="ml-2 text-critical">Actively exploited</strong>}
              </span>
              {cve.summary && <p className="mt-0.5 mb-0 line-clamp-2">{cve.summary}</p>}
              {cve.hosts?.length > 0 && <p className="mt-0.5 mb-0 font-mono break-all">{cve.hosts.join(", ")}</p>}
            </div>
          ))}
          {details.cves.length > MAX_SHOWN_CVES && (
            <p className="m-0">+{details.cves.length - MAX_SHOWN_CVES} more</p>
          )}
        </div>
      )}

      {details.port != null && (
        <div><dt className="inline font-semibold">{withTerms("Port")}</dt><dd className="ml-2 inline">{details.port} · {details.service}</dd></div>
      )}

      {details.domain !== undefined && (
        <>
          <div><dt className="inline font-semibold">Domain</dt><dd className="ml-2 inline font-mono">{details.domain || "Unknown"}</dd></div>
          <div><dt className="inline font-semibold">Record</dt><dd className="ml-2 inline font-mono break-all">{details.record || "None"}</dd></div>
        </>
      )}

      {details.files && (
        <div>
          <dt className="font-semibold">Files</dt>
          {details.files.map((file) => <dd key={file} className="ml-0 font-mono break-all">{file}</dd>)}
        </div>
      )}

      {details.lines && (
        <div>
          <dt className="font-semibold">Lines</dt>
          {details.lines.map((item, index) => (
            <dd key={index} className="ml-0 font-mono break-all">{item.file}:{item.line} {item.text}</dd>
          ))}
        </div>
      )}

      {details.actions && (
        <div>
          <dt className="font-semibold">Actions</dt>
          {details.actions.map((item, index) => <dd key={index} className="ml-0 font-mono break-all">{item.file}: {item.uses}</dd>)}
        </div>
      )}

      {details.missing && (
        <div><dt className="inline font-semibold">Missing</dt><dd className="ml-2 inline">{details.missing.join(", ")}</dd></div>
      )}

      {details.package && (
        <>
          <div><dt className="inline font-semibold">Package</dt><dd className="ml-2 inline font-mono">{details.package} {details.version}</dd></div>
          <div>
            <dt className="font-semibold">Vulnerabilities</dt>
            <dd className="ml-0 flex flex-wrap gap-x-3 gap-y-1">
              {details.vulns.map((id) => <VulnLink key={id} id={id} />)}
            </dd>
          </div>
        </>
      )}

      {details.issuer && (
        <>
          <div><dt className="inline font-semibold">Issuer</dt><dd className="ml-2 inline">{details.issuer}</dd></div>
          <div><dt className="inline font-semibold">Expires</dt><dd className="ml-2 inline">{new Date(details.validTo).toLocaleDateString()} ({details.daysLeft < 0 ? "expired" : `${details.daysLeft} days`})</dd></div>
          <div><dt className="inline font-semibold">Key</dt><dd className="ml-2 inline font-mono">{details.keyBits ? `${details.keyBits}-bit · ` : ""}{details.tlsVersion}</dd></div>
        </>
      )}

      {details.header && (
        <>
          <div><dt className="inline font-semibold">Page</dt><dd className="ml-2 inline font-mono break-all">{details.url}</dd></div>
          <div><dt className="inline font-semibold">{withTerms(details.header)}</dt><dd className="ml-2 inline font-mono break-all">{details.value || "Not set"}</dd></div>
        </>
      )}
    </dl>
  );
}
