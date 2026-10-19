const CDN_ISP_PATTERNS = [
    /cloudflare/i,
    /fastly/i,
    /akamai/i,
    /cloudfront/i,          // Amazon CloudFront (the edge product, not plain EC2)
    /azure front door/i,    // Azure's edge product, not plain Azure
    /incapsula|imperva/i,
    /sucuri/i,
    /stackpath|highwinds/i,
    /bunny/i,
    /edgecast|edgio/i,
    /gcore/i,
    /cdn77/i,
    /keycdn/i,
    /limelight/i,
];

// Hosting brands that contain a CDN name but are ordinary servers (Akamai Connected Cloud is Linode)
const NOT_CDN_PATTERNS = [
    /connected cloud/i,
    /linode/i,
];

/**
 * Decide if an IP is a CDN edge from its Shodan tags and ip-api ISP/org strings
 * (CloudFront and Azure Front Door may only show up in org, not isp)
 */
function isCdnIp({ isp = "", org = "", tags = [] } = {}) {
    if (tags.some(t => String(t).toLowerCase() === "cdn")) {
        return true;
    }
    if (NOT_CDN_PATTERNS.some(re => re.test(isp) || re.test(org))) {
        return false;
    }
    return CDN_ISP_PATTERNS.some(re => re.test(isp) || re.test(org));
}

module.exports = { isCdnIp };
