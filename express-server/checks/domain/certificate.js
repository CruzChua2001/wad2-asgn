const tls = require("tls");

const TIMER_MS = 5000; // timeout of 5s in case the server never answers
const DAY_MS = 24 * 60 * 60 * 1000;

const SELF_SIGNED = ["DEPTH_ZERO_SELF_SIGNED_CERT", "SELF_SIGNED_CERT_IN_CHAIN"];

/**
 * Open one TLS connection to port 443 and read the certificate, without sending a request
 */
const checkCertificate = hostname => new Promise(resolve => {
    const done = (status, certificate = null) => {
        socket.destroy();
        resolve({ records: { certificate }, checks: { certificate: status } });
    }

    // Don't reject a bad certificate or an old TLS version, so they can still be read and explained
    const socket = tls.connect({
        host: hostname,
        port: 443,
        servername: hostname,
        rejectUnauthorized: false,
        minVersion: "TLSv1",
        ciphers: "DEFAULT@SECLEVEL=0",
    });

    socket.setTimeout(TIMER_MS, () => done("unavailable"));

    socket.on("secureConnect", () => {
        const cert = socket.getPeerCertificate();

        const validTo = new Date(cert?.valid_to);

        if (isNaN(validTo)) {
            return done("unavailable");
        }

        done("ok", {
            issuer: cert.issuer?.O || cert.issuer?.CN || "Unknown",
            validTo: validTo.toISOString(),
            daysLeft: Math.floor((validTo - Date.now()) / DAY_MS),
            trusted: socket.authorized,
            error: socket.authorizationError ?? null,   // e.g. CERT_HAS_EXPIRED
            selfSigned: SELF_SIGNED.includes(socket.authorizationError),
            keyBits: cert.bits ?? null,
            keyType: cert.asn1Curve || cert.nistCurve ? "EC" : "RSA",
            tlsVersion: socket.getProtocol(),
        });
    });

    // Nothing listening on 443 (or no such host) means the site has no HTTPS to check
    socket.on("error", error => done(["ECONNREFUSED", "ENOTFOUND"].includes(error.code) ? "none" : "unavailable"));
});

module.exports = { checkCertificate };
