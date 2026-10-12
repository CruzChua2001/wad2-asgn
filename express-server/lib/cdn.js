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

/**
 * Decide if an IP is a CDN edge from its Shodan tags and ip-api ISP string
 */
function isCdnIp({ isp = "", tags = [] } = {}) {
    if (tags.some(t => String(t).toLowerCase() === "cdn")) {
        return true;
    }
    return CDN_ISP_PATTERNS.some(re => re.test(isp));
}

module.exports = { isCdnIp };
