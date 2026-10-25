import { expect, test } from "@playwright/test";

const scanId = "guest-domain-scan";

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
};

/*
  USER JOURNEY TEST CASE 1:
    1. User starts on Landing page
    2. Continue as Guest to Scan page (Phase 1: Pre-Scan)
    3. Enter domain name (example.com)
    4. Clicks "Start scan" button
    5. Sees "Scanning..." elements on "/scan" page (Phase 2: During Scan)
    6. Redirected to Results summary page after results obtained from scan (Phase 3: Post-Scan)
    7. Able to see exposure score and points lost per category
    8. Able to see dashboard view of results from scan (Servers, Open services, Issues)
    9. Able to see 3D rendered globe displaying all scanned servers
*/
test("guest can scan a domain and view results", async ({ page }) => {
  let releaseScanResponse;
  let notifyScanRequest;
  const scanRequestStarted = new Promise((resolve) => {
    notifyScanRequest = resolve;
  });

  await page.route("**/api/scan", async (route) => {
    if (route.request().method() !== "POST") {
      await route.continue();
      return;
    }

    notifyScanRequest(route.request());
    await new Promise((resolve) => {
      releaseScanResponse = resolve;
    });

    const events = [
      { type: "event", kind: "ok", text: "DNS records checked" },
      { type: "done", id: scanId },
    ];

    await route.fulfill({
      status: 200,
      headers: { "content-type": "application/x-ndjson" },
      body: `${events.map((event) => JSON.stringify(event)).join("\n")}\n`,
    });
  });

  await page.route(`**/api/scan/${scanId}`, async (route) => {
    await route.fulfill({ json: scanResult });
  });

  // 1. User starts on Landing page
  await page.goto("/");
  await expect(page.getByRole("link", { name: /Explore as guest/ })).toBeVisible();
  // 2. Continue as Guest to Scan page (Phase 1: Pre-Scan)
  await page.getByRole("link", { name: /Explore as guest/ }).click();
  await expect(page).toHaveURL(/\/scan$/);
  await expect(page.getByRole("heading", { name: "What would you like to scan?" })).toBeVisible();

  // 3. Enter domain name (example.com)
  await page.getByRole("textbox", { name: "Website or domain" }).fill("example.com");
  // 4. Clicks "Start scan" button
  await page.getByRole("button", { name: "Start scan" }).click();

  const request = await scanRequestStarted;
  // 5. Sees "Scanning..." elements on "/scan" page (Phase 2: During Scan)
  await expect(page.getByRole("heading", { name: "Scanning example.com" })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Scan progress" })).toHaveAttribute("aria-valuenow", "0");
  expect(request.postDataJSON()).toEqual({
    domain: "example.com",
    githubRepo: null,
    force: false,
  });

  releaseScanResponse();

  // 6. Redirected to Results summary page after results obtained from scan (Phase 3: Post-Scan)
  await expect(page).toHaveURL(new RegExp(`/scan/${scanId}$`));
  await expect(page.getByRole("heading", { name: "example.com", exact: true })).toBeVisible();

  // 7. Able to see exposure score and points lost per category
  await expect(page.getByRole("img", { name: "96 out of 100" })).toBeVisible();
  await expect(page.getByText("Points lost by category", { exact: true })).toBeVisible();
  const breakdown = page.getByRole("list", { name: "Score breakdown" });
  await expect(breakdown).toContainText("HTTPS & headers");
  await expect(breakdown).toContainText("DNS & email");
  await expect(breakdown).toContainText("-2");

  // 8. Able to see dashboard view of results from scan (Servers, Open services, Issues)
  const servers = page.getByRole("group", { name: "Servers" });
  await expect(servers.getByRole("button")).toHaveCount(2);
  await expect(servers).toContainText("example.com");
  await expect(servers).toContainText("edge.example.com");
  for (const [label, count] of [["Servers found", "2"], ["Open services", "3"], ["Issues found", "1"]]) {
    await expect(page.getByText(label, { exact: true }).locator("..")).toContainText(count);
  }

  // 9. Able to see 3D rendered globe displaying all scanned servers
  await expect(page.getByRole("heading", { name: "Where your servers are" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Globe", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#map-stage .exposure-globe canvas")).toBeVisible();
});
