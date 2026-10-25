const test = require("node:test");
const assert = require("node:assert");
const { readWorkflow } = require("../checks/github/files");

const SHA = "a".repeat(40);

// One workflow with every case we check for: quoted official action, a pinned and an unpinned
// third-party action, a commented-out action, a dangerous run: line and a harmless if: line
const WORKFLOW = [
    "name: ci",
    "on: [push]",
    "jobs:",
    "  build:",
    "    runs-on: ubuntu-latest",
    "    steps:",
    '      - uses: "actions/checkout@v4"',
    `      - uses: tj-actions/changed-files@${SHA}`,
    "      - uses: pnpm/action-setup@v4",
    "      # - uses: some-one/old-action@v1",
    "      - if: ${{ github.event.issue.title != '' }}",
    "        run: echo ${{ github.event.issue.title }}",
].join("\n");

test("a workflow without a permissions line is reported", () => {
    const file = readWorkflow("ci.yml", WORKFLOW);
    assert.strictEqual(file.permissions, false);
});

test("a top-level permissions line is found", () => {
    const file = readWorkflow("ci.yml", `name: ci\npermissions:\n  contents: read\n`);
    assert.strictEqual(file.permissions, true);
});

test("only third-party actions are counted, and a commented-out one is ignored", () => {
    const file = readWorkflow("ci.yml", WORKFLOW);
    assert.strictEqual(file.thirdParty, 2);
});

test("an action at a tag is unpinned, and one at a commit SHA is not", () => {
    const file = readWorkflow("ci.yml", WORKFLOW);
    assert.deepStrictEqual(file.unpinned, [{ file: "ci.yml", uses: "pnpm/action-setup@v4" }]);
});

test("a quoted commit SHA still counts as pinned", () => {
    const file = readWorkflow("ci.yml", `    steps:\n      - uses: "tj-actions/changed-files@${SHA}"\n`);
    assert.strictEqual(file.thirdParty, 1);
    assert.deepStrictEqual(file.unpinned, []);
});

test("a run line using the issue title is dangerous, but the if line isn't", () => {
    const file = readWorkflow("ci.yml", WORKFLOW);
    assert.deepStrictEqual(file.dangerous, [
        { file: "ci.yml", line: 12, text: "run: echo ${{ github.event.issue.title }}" },
    ]);
});

test("text in env:, with: or a concurrency group isn't dangerous, so our own fix passes", () => {
    const text = [
        "on: [issues, pull_request]",
        "concurrency:",
        "  group: ${{ github.workflow }}-${{ github.head_ref || github.ref }}",
        "jobs:",
        "  greet:",
        "    steps:",
        "      - uses: actions/checkout@v4",
        "        with:",
        "          ref: ${{ github.head_ref }}",
        "      - env:",
        "          MY_TEXT: ${{ github.event.issue.title }}",
        '        run: echo "$MY_TEXT"',
    ].join("\n");

    assert.deepStrictEqual(readWorkflow("ci.yml", text).dangerous, []);
});

test("unsafe text inside a multi-line run: block is dangerous, and the block ends at the next key", () => {
    const text = [
        "jobs:",
        "  greet:",
        "    steps:",
        "      - name: Greet",
        "        run: |",
        "          echo hello",
        "          echo ${{ github.event.pull_request.title }}",
        "      - name: Next step",
        "        env:",
        "          TITLE: ${{ github.event.pull_request.title }}",
    ].join("\n");

    assert.deepStrictEqual(readWorkflow("ci.yml", text).dangerous, [
        { file: "ci.yml", line: 7, text: "echo ${{ github.event.pull_request.title }}" },
    ]);
});

test("the branch name (github.head_ref) inside a run step is dangerous", () => {
    const file = readWorkflow("ci.yml", "    steps:\n      - run: git checkout ${{ github.head_ref }}\n");
    assert.strictEqual(file.dangerous.length, 1);
});

test("a pull_request_target workflow checking out the pull request's code is dangerous", () => {
    const text = [
        "on: pull_request_target",
        "jobs:",
        "  build:",
        "    steps:",
        "      - uses: actions/checkout@v4",
        "        with:",
        "          ref: ${{ github.event.pull_request.head.sha }}",
    ].join("\n");

    const file = readWorkflow("pr.yml", text);
    assert.strictEqual(file.dangerous.length, 1);
    assert.strictEqual(file.dangerous[0].line, 7);
});

test("a clean workflow has nothing to report", () => {
    const text = [
        "permissions:",
        "  contents: read",
        "jobs:",
        "  build:",
        "    steps:",
        "      - uses: actions/checkout@v4",
        "      - run: npm ci",
    ].join("\n");

    const file = readWorkflow("clean.yml", text);
    assert.deepStrictEqual(file, { permissions: true, thirdParty: 0, unpinned: [], dangerous: [] });
});
