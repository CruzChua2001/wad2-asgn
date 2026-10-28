const test = require("node:test");
const assert = require("node:assert");
const { isSecretFile, README_FILE } = require("../checks/github/files");

// A file from the git tree, about the size of a private key unless given
const file = (path, size = 1700) => ({ path, size });

test("env files, SSH keys and private key files are secrets", () => {
    for (const path of [".env", "server/.env.production", "id_rsa", "config/credentials.json", "certs/privkey.pem", "my-server.pem", "tls/server.key", "keystore.p12"]) {
        assert.strictEqual(isSecretFile(file(path)), true, path);
    }
});

test("public certificates aren't secrets", () => {
    for (const path of ["certs/cert.pem", "fullchain.pem", "chain.pem", "rds-combined-ca-bundle.pem", "ca.pem"]) {
        assert.strictEqual(isSecretFile(file(path)), false, path);
    }
});

test("a Keynote deck isn't a secret, although it ends in .key", () => {
    assert.strictEqual(isSecretFile(file("docs/WAD2 Pitch.key", 2400000)), false);
});

test("other files aren't secrets", () => {
    for (const path of [".env.example", "README.md", "src/keys.js", "package.json"]) {
        assert.strictEqual(isSecretFile(file(path)), false, path);
    }
});

test("README, README.md, README.rst and README.txt at the root count as a README", () => {
    for (const path of ["README", "README.md", "readme.markdown", "README.rst", "README.txt"]) {
        assert.strictEqual(README_FILE.test(path), true, path);
    }
});

test("a README in a folder or with another extension doesn't count", () => {
    for (const path of ["docs/README.md", "README.html", "READMEFIRST.md"]) {
        assert.strictEqual(README_FILE.test(path), false, path);
    }
});
