import { expect, test } from "@playwright/test";

const scanId = "guest-repository-scan";
const repository = "github.com/juice-shop/juice-shop";

const scanResult = {
  "score": 80,
  "grade": "B",
  "breakdown": [
    {
      "category": "packages",
      "label": "Dependencies",
      "lost": 8,
      "status": "ok"
    },
    {
      "category": "secrets",
      "label": "Secrets",
      "lost": 6,
      "status": "ok"
    },
    {
      "category": "repo-basics",
      "label": "Project basics",
      "lost": 6,
      "status": "ok"
    }
  ],
  "checks": [
    {
      "id": "dependencies",
      "category": "packages",
      "label": "Dependencies",
      "weight": 40,
      "score": 8,
      "status": "ok",
      "gain": 8
    },
    {
      "id": "secrets",
      "category": "secrets",
      "label": "Secret files",
      "weight": 30,
      "score": 8,
      "status": "ok",
      "gain": 6
    },
    {
      "id": "repo-basics",
      "category": "repo-basics",
      "label": "Project basics",
      "weight": 30,
      "score": 8,
      "status": "ok",
      "gain": 6
    }
  ],
  "cap": null,
  "incomplete": false,
  "uncappedScore": 80,
  "findings": [
    {
      "id": "vulnerable-dependency",
      "category": "packages",
      "checkId": "dependencies",
      "kind": "issue",
      "severity": "high",
      "title": "A dependency has a known vulnerability",
      "explain": "The dependency version is affected by a published advisory.",
      "fix": "Upgrade the dependency to a patched version.",
      "learnMore": {
        "url": "https://osv.dev/vulnerability/GHSA-test-1234"
      },
      "source": "repo",
      "hosts": [],
      "details": {
        "package": "example-package",
        "version": "1.0.0",
        "vulns": [
          "GHSA-test-1234"
        ]
      }
    },
    {
      "id": "committed-env-file",
      "category": "secrets",
      "checkId": "secrets",
      "kind": "issue",
      "severity": "medium",
      "title": "A sensitive environment file is committed",
      "explain": "A file that may contain secrets is present in the repository.",
      "fix": "Remove the file from the repository and rotate any credentials it contained.",
      "learnMore": null,
      "source": "repo",
      "hosts": [],
      "details": {
        "files": [
          ".env"
        ]
      }
    }
  ],
  "domain_scans": null,
  "repo_scans": {
    "github_repo": "github.com/juice-shop/juice-shop",
    "created_at": "2026-10-25T00:00:00Z",
    "result": {
      "checks": {},
      "records": {
        "repo": {
          "name": "juice-shop",
          "description": "An intentionally insecure web application for security training.",
          "defaultBranch": "master",
          "pushedAt": "2026-10-20T00:00:00Z",
          "stars": 100,
          "url": "https://github.com/juice-shop/juice-shop"
        },
        "dependencies": [
          {
            "name": "example-package",
            "version": "1.0.0"
          }
        ],
        "sensitiveFiles": [
          ".env"
        ]
      }
    }
  }
};

/*
  USER JOURNEY TEST CASE: GUEST SCAN REPO & VIEW RESULTS
    1. User starts on Landing page
    2. Continue as Guest to Scan page (Phase 1: Pre-Scan)
    3. Enter GitHub repo url (github.com/juice-shop/juice-shop)
    4. Clicks "Start scan" button
    5. Sees "Scanning..." elements on "/scan" page (Phase 2: During Scan)
    6. Redirected to Results summary page after results obtained from scan (Phase 3: Post-Scan)
    7. Able to see exposure score and points lost per category
    8. Able to see dashboard view of results from scan (Vulnerable packages, Secret files, Issues)
    9. Able to see repository overview
*/
test("guest can scan a GitHub repository and view results", async ({ page }) => {
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
      { type: "event", kind: "ok", text: "Repository metadata checked" },
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
  await page.getByRole("link", { name: /Explore as guest/ }).click();
  // 2. Continue as Guest to Scan page (Phase 1: Pre-Scan)
  await expect(page).toHaveURL(/\/scan$/);
  await expect(page.getByRole("heading", { name: "What would you like to scan?" })).toBeVisible();

  // 3. Enter GitHub repo url (github.com/juice-shop/juice-shop)
  await page.getByRole("button", { name: /GitHub repository/ }).click();
  await page.getByRole("textbox", { name: "Public repository" }).fill("github.com/juice-shop/juice-shop");
  // 4. Clicks "Start scan" button
  await page.getByRole("button", { name: "Start scan" }).click();

  const request = await scanRequestStarted;
  // 5. Sees "Scanning..." elements on "/scan" page (Phase 2: During Scan)
  await expect(page.getByRole("heading", { name: `Scanning ${repository}` })).toBeVisible();
  await expect(page.getByRole("progressbar", { name: "Scan progress" })).toHaveAttribute("aria-valuenow", "0");
  expect(request.postDataJSON()).toEqual({ 
    githubRepo: repository,
    force: false
  });

  releaseScanResponse();

  // 6. Redirected to Results summary page after results obtained from scan (Phase 3: Post-Scan)
  await expect(page).toHaveURL(new RegExp(`/scan/${scanId}$`));
  await expect(page.getByRole("heading", { name: repository, exact: true })).toBeVisible();

  // 7. Able to see exposure score and points lost per category
  await expect(page.getByRole("heading", { name: "Exposure score" })).toBeVisible();
  await expect(page.getByRole("img", { name: "80 out of 100" })).toBeVisible();
  const breakdown = page.getByRole("list", { name: "Score breakdown" });
  for (const [category, pointsLost] of [["Dependencies", "-8"], ["Secrets", "-6"], ["Project basics", "-6"]]) {
    const categoryRow = breakdown.getByRole("listitem").filter({ hasText: category });
    await expect(categoryRow).toContainText(pointsLost);
  }

  // 8. Able to see dashboard view of results from scan (Vulnerable packages, Secret files, Issues)
  for (const [label, count] of [["Vulnerable packages", "1"], ["Secret files", "1"], ["Issues found", "2"]]) {
    await expect(page.getByText(label, { exact: true }).locator("..")).toContainText(count);
  }

  // 9. Able to see repository overview
  const repositoryCard = page.getByRole("region", { name: "Repository" });
  await expect(repositoryCard).toContainText("juice-shop");
  await expect(repositoryCard).toContainText("master");
  await expect(repositoryCard.getByRole("link", { name: "Open on GitHub" })).toHaveAttribute("href", "https://github.com/juice-shop/juice-shop");
});
