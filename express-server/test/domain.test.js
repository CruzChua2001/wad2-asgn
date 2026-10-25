const test = require("node:test");
const assert = require("node:assert");
const { isPrivateIp } = require("../lib/domain");

test("loopback, private and link-local addresses are private", () => {
    for (const ip of ["127.0.0.1", "10.0.0.5", "192.168.1.10", "172.16.0.1", "172.31.255.255", "169.254.169.254", "0.0.0.0", "::1", "fd12:3456::1", "fe80::1"]) {
        assert.strictEqual(isPrivateIp(ip), true, ip);
    }
});

test("public addresses aren't private", () => {
    for (const ip of ["8.8.8.8", "203.0.113.10", "100.1.2.3", "172.15.0.1", "172.32.0.1", "2606:4700::6810:84e5"]) {
        assert.strictEqual(isPrivateIp(ip), false, ip);
    }
});
