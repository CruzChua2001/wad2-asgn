import { expect, test } from "@playwright/test";

const projectName = "Playwright User Journey Project";
const projectId = "playwright-project-1";
const scanId = "playwright-project-scan-1";
const rescanId = "playwright-project-rescan-1";
const authRequests = [];
const projectCreateRequests = [];
const scanRequests = [];

const testUser = {
  id: "playwright-user-1",
  email: "playwright@test.com",
  aud: "authenticated",
  role: "authenticated",
  email_confirmed_at: "2026-01-01T00:00:00.000Z",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { full_name: "Playwright User" },
  identities: [],
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const authSession = {
  access_token: "playwright-test-access-token",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: "playwright-test-refresh-token",
  user: testUser,
};

// mock post-scan results json data
const scanResult = {
  score: 96,
  grade: "A",
  breakdown: [
    { category: "https", label: "HTTPS & headers", lost: 2, status: "ok" },
    { category: "dns", label: "DNS & email", lost: 2, status: "ok" },
  ],
  checks: [
    { id: "https", category: "https", label: "HTTPS & headers", weight: 10, score: 8, status: "ok", gain: 2 },
    { id: "dns", category: "dns", label: "DNS & email", weight: 10, score: 8, status: "ok", gain: 2 },
  ],
  cap: null,
  incomplete: false,
  uncappedScore: 96,
  findings: [
    {
      id: "missing-hsts",
      category: "https",
      checkId: "https",
      kind: "missing-header",
      severity: "low",
      title: "HSTS header is missing",
      explain: "The site does not send a Strict-Transport-Security header.",
      fix: "Add a Strict-Transport-Security response header.",
      learnMore: { url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security" },
      source: "domain",
      hosts: ["93.184.216.34"],
      details: {},
    },
  ],
  domain_scans: {
    domain: "example.com",
    created_at: "2026-10-25T00:00:00.000Z",
    result: {
      checks: { geo: { status: "ok" } },
      records: {
        a: ["93.184.216.34"],
        aaaa: [],
        cdnIps: [],
        geo: [
          {
            ip: "93.184.216.34",
            status: "ok",
            city: "Los Angeles",
            country: "United States",
            lat: 34.05,
            lon: -118.24,
            isp: "Example Networks",
            org: "Example Networks",
            as: "AS64500",
            asname: "EXAMPLE-AS",
          },
          {
            ip: "203.0.113.12",
            status: "ok",
            city: "Singapore",
            country: "Singapore",
            lat: 1.35,
            lon: 103.82,
            isp: "Example Edge",
            org: "Example Edge",
            as: "AS64501",
            asname: "EXAMPLE-EDGE",
          },
        ],
        ports: [
          { ip: "93.184.216.34", ports: [443, 80], vulns: [] },
          { ip: "203.0.113.12", ports: [443], vulns: [] },
        ],
        subdomains: [{ hostname: "edge.example.com", ips: ["203.0.113.12"] }],
      },
    },
  },
  repo_scans: null,
};

const fixedScanResult = {
  ...scanResult,
  score: 100,
  grade: "A",
  breakdown: scanResult.breakdown.map((item) => ({ ...item, lost: 0 })),
  checks: scanResult.checks.map((check) => ({ ...check, score: 10, gain: 0 })),
  uncappedScore: 100,
  findings: [],
  domain_scans: {
    ...scanResult.domain_scans,
    created_at: "2026-10-26T00:00:00.000Z",
  },
};

const scanRuns = [
  { id: scanId, result: scanResult },
  { id: rescanId, result: fixedScanResult },
];

const scanResultsById = Object.fromEntries(scanRuns.map(({ id, result }) => [id, result]));
let project = null;

/*
  USER JOURNEY TEST CASE: SIGNED-IN USER CREATES A PROJECT AND RESCANS PROJECT AFTER FIXING ITS DOMAIN
    1. User starts on Landing page
    2. User clicks on Login button and signs in using mock test account
    3. User successfully signs in, being redirected to "/scan" page
    4. User clicks on "Projects" nav tab and creates a new project
    5. User inputs a domain into the project and continues to start its first scan
    6. User sees the first scan results, including the recommendations, and returns to the "Projects" page
    7. User follows the recommendations mentioned in the scan results, then rescans the domain registered in the project
    8. User sees an improved score and fewer issues on the updated results page
    9. User returns to the "Projects" page and sees the updated score and score history graph
*/
test("user signs in, creates a project, and sees an improved score after fixing domain and rescanning", async ({ page }) => {
  await page.route(/\/auth\/v1\/token\?grant_type=password$/, async (route) => {
    authRequests.push(route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      json: {
        ...authSession,
        user: { ...testUser, email: route.request().postDataJSON().email },
      },
    });
  });
  await page.route(/\/auth\/v1\/user$/, async (route) => {
    await route.fulfill({ json: testUser });
  });

  await page.route("**/api/project", async (route) => {
    const method = route.request().method();
    if (method === "GET") {
      await route.fulfill({ json: project ? [project] : [] });
      return;
    }

    if (method === "POST") {
      const body = route.request().postDataJSON();
      projectCreateRequests.push(body);
      project = {
        id: projectId,
        name: body.name,
        domain: body.domain,
        github_repo: body.githubRepo || null,
        role: "owner",
        created_by: testUser.id,
        latestScan: null,
        scores: [],
      };
      await route.fulfill({ json: project });
      return;
    }

    await route.continue();
  });

  await page.route("**/api/invite", async (route) => {
    await route.fulfill({ json: [] });
  });

  await page.route("**/api/scan", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }

    const body = route.request().postDataJSON();
    scanRequests.push(body);
    const scanRun = scanRuns[scanRequests.length - 1];
    expect(scanRun).toBeDefined();
    project = {
      ...project,
      latestScan: {
        id: scanRun.id,
        score: scanRun.result.score,
        grade: scanRun.result.grade,
        created_at: scanRun.result.domain_scans.created_at,
      },
      scores: [...project.scores, scanRun.result.score],
    };

    const events = [
      { type: "event", kind: "ok", text: "Domain checks completed" },
      { type: "done", id: scanRun.id },
    ];
    await route.fulfill({
      status: 200,
      headers: { "content-type": "application/x-ndjson" },
      body: `${events.map((event) => JSON.stringify(event)).join("\n")}\n`,
    });
  });

  await page.route("**/api/scan/*", async (route) => {
    const requestUrl = new URL(route.request().url());
    const result = scanResultsById[requestUrl.pathname.split("/").at(-1)];
    if (!result) {
      await route.fulfill({ status: 404, json: { error: "Scan not found" } });
      return;
    }
    await route.fulfill({ json: result });
  });

  // The product tour opens for new users and its overlay blocks clicks, so mark it as seen
  await page.addInitScript((userId) => {
    localStorage.setItem(`cruz-control-tour-seen-v1:intro:${userId}`, "1");
    localStorage.setItem(`cruz-control-tour-seen-v1:results:${userId}`, "1");
  }, testUser.id);

  // 1. User starts on Landing page
  await page.goto("/");
  // 2. User clicks on Login button and signs in using mock test account
  await page.getByRole("button", { name: "Login" }).click();
  const loginDialog = page.getByRole("dialog", { name: "Cruz Control" });
  const loginPanel = loginDialog.getByRole("tabpanel", { name: "Log In" });
  await loginPanel.getByRole("textbox", { name: "Email" }).fill(testUser.email);
  await loginPanel.getByRole("textbox", { name: "Password" }).fill("playwright-test-password");
  await loginPanel.getByRole("button", { name: "Sign in" }).click();

  // 3. User successfully signs in, being redirected to "/scan" page
  await expect(page).toHaveURL(/\/scan$/);
  expect(authRequests).toHaveLength(1);
  expect(authRequests[0]).toMatchObject({ email: testUser.email, password: "playwright-test-password" });

  // 4. User clicks on "Projects" nav tab and creates a new project
  // The results page also links to Projects in a hint, so use the one in the nav
  const projectsNav = page.getByRole("navigation", { name: "Primary navigation" }).getByRole("link", { name: "Projects" });
  await projectsNav.click();
  await expect(page.getByRole("heading", { name: "My Projects" })).toBeVisible();
  await page.getByRole("button", { name: "New project", exact: true }).click();
  const projectDialog = page.getByRole("dialog", { name: "Track a site or repo" });
  await projectDialog.getByRole("textbox", { name: "Project name" }).fill(projectName);
  // 5. User inputs a domain into the project and continues to start its first scan
  await projectDialog.getByRole("textbox", { name: "Domain" }).fill("example.com");
  await projectDialog.getByRole("button", { name: "Create & scan" }).click();

  // 6. User sees the first scan results, including the recommendations, and returns to the "Projects" page
  await expect(page).toHaveURL(new RegExp(`/scan/${scanId}$`));
  const cardPicker = page.getByRole("group", { name: "Choose a card" });
  await cardPicker.getByRole("button", { name: "Score" }).click();
  await expect(page.getByRole("heading", { name: "Exposure score" })).toBeVisible();
  await expect(page.getByRole("img", { name: "96 out of 100" })).toBeVisible();
  await expect(page.getByText("Issues found", { exact: true }).locator("..")).toContainText("1");
  const breakdown = page.getByRole("list", { name: "Score breakdown" });
  for (const [category, pointsLost] of [["HTTPS & headers", "-2"], ["DNS & email", "-2"]]) {
    const categoryRow = breakdown.getByRole("listitem").filter({ hasText: category });
    await expect(categoryRow).toContainText(pointsLost);
  }
  // The carousel shows one card at a time, so turn to the findings
  await cardPicker.getByRole("button", { name: "Findings" }).click();
  await expect(page.getByText("HSTS header is missing")).toBeVisible();
  await expect(page.locator("#finding-missing-hsts").getByText("Add a Strict-Transport-Security response header.")).toBeVisible();
  expect(projectCreateRequests).toEqual([{ name: projectName, domain: "example.com", githubRepo: "" }]);
  expect(scanRequests).toHaveLength(1);
  expect(scanRequests[0]).toEqual({ domain: "example.com", githubRepo: null, projectId, force: true });

  await projectsNav.click();
  await expect(page.getByRole("heading", { name: projectName, exact: true })).toBeVisible();

  // 7. User follows the recommendations mentioned in the scan results, then rescans the domain registered in the project
  await page.getByRole("button", { name: `Re-scan ${projectName}` }).click();
  await expect(page).toHaveURL(new RegExp(`/scan/${rescanId}$`));

  // 8. User sees an improved score and fewer issues on the updated results page
  await cardPicker.getByRole("button", { name: "Score" }).click();
  await expect(page.getByRole("img", { name: "100 out of 100" })).toBeVisible();
  await expect(page.getByText("Issues found", { exact: true }).locator("..")).toContainText("0");
  expect(scanRequests).toHaveLength(2);
  expect(scanRequests[1]).toEqual({ domain: "example.com", githubRepo: null, projectId, force: true });

  // 9. User returns to the "Projects" page and sees the updated score and score history graph
  await projectsNav.click();
  await expect(page.getByRole("heading", { name: "My Projects" })).toBeVisible();
  const projectCard = page.getByRole("heading", { name: projectName, exact: true }).locator("xpath=ancestor::li[1]");
  await expect(projectCard).toContainText("example.com");
  await expect(projectCard).toContainText("100");
  await expect(projectCard.getByRole("link", { name: `View results for ${projectName}` })).toHaveAttribute("href", `/scan/${rescanId}`);
});
