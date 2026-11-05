import { expect, test } from "@playwright/test";

const phone = { width: 375, height: 667 };
const scanId = "mobile-menu-scan";

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

// mock repo-only scan, so the results page has no globe to load
const scanResult = {
  score: 90,
  grade: "A",
  breakdown: [{ category: "readme", label: "README", lost: 10, status: "ok" }],
  checks: [{ id: "readme", category: "readme", label: "README", weight: 2.5, score: 0, status: "ok", gain: 10 }],
  cap: null,
  incomplete: false,
  uncappedScore: 90,
  findings: [],
  domain_scans: null,
  repo_scans: {
    github_repo: "octocat/hello-world",
    created_at: "2026-10-25T00:00:00.000Z",
    result: {
      checks: {},
      records: {
        repo: { name: "hello-world", defaultBranch: "main", pushedAt: "2026-10-20T00:00:00Z", stars: 1, url: "https://github.com/octocat/hello-world" },
        dependencies: [],
        sensitiveFiles: [],
      },
    },
  },
};

// The product tour opens for new visitors and its overlay blocks clicks, so mark it as seen
test.beforeEach(async ({ page }) => {
  await page.addInitScript((userId) => {
    for (const who of ["guest", userId]) {
      localStorage.setItem(`cruz-control-tour-seen-v1:intro:${who}`, "1");
      localStorage.setItem(`cruz-control-tour-seen-v1:results:${who}`, "1");
    }
  }, testUser.id);
});

// The hamburger sits on the same row as the logo, right of everything else in the header
const expectOneRowWithMenuLast = async (page) => {
  const header = page.locator("header").first();
  const logo = await header.getByRole("link", { name: "Cruz Control home" }).boundingBox();
  const menuButton = await page.getByRole("button", { name: "Open menu" }).boundingBox();
  const headerBox = await header.boundingBox();

  expect(Math.abs(logo.y + logo.height / 2 - (menuButton.y + menuButton.height / 2))).toBeLessThan(8);
  expect(headerBox.height).toBeLessThan(100);

  const others = await header.locator('button:not([aria-label="Open menu"])').all();
  for (const other of others) {
    if (!(await other.isVisible())) continue;
    const box = await other.boundingBox();
    expect(box.x + box.width).toBeLessThanOrEqual(menuButton.x);
  }
};

const openMenu = async (page) => {
  await page.getByRole("button", { name: "Open menu" }).click();
  const closeButton = page.getByRole("button", { name: "Close menu" });
  await expect(closeButton).toHaveAttribute("aria-expanded", "true");
  return page.locator(`#${await closeButton.getAttribute("aria-controls")}`);
};

test.describe("phone header", () => {
  test.use({ viewport: phone });

  test("landing page puts Sign up and Login in the menu", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /Explore as guest/ })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Main navigation" }).getByRole("button", { name: "Sign up" })).toBeHidden();
    await expectOneRowWithMenuLast(page);

    // Escape closes the menu and puts focus back on the button
    let menu = await openMenu(page);
    await expect(menu.getByRole("button", { name: "Sign up" })).toBeVisible();
    await expect(menu.getByRole("button", { name: "Login" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(page.getByRole("button", { name: "Open menu" })).toBeFocused();

    // Clicking outside closes it
    menu = await openMenu(page);
    await page.getByRole("heading", { level: 1 }).click();
    await expect(menu).toBeHidden();

    // Login opens the auth modal
    menu = await openMenu(page);
    await menu.getByRole("button", { name: "Login" }).click();
    await expect(menu).toBeHidden();
    await expect(page.getByRole("dialog", { name: "Cruz Control" })).toBeVisible();
  });

  test("scan page puts the nav, tour and Login in the menu", async ({ page }) => {
    await page.goto("/scan");
    await expect(page.getByRole("heading", { name: "What would you like to scan?" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Take the tour" })).toBeHidden();
    await expectOneRowWithMenuLast(page);

    let menu = await openMenu(page);
    await expect(menu.getByRole("link", { name: "Scan" })).toHaveAttribute("aria-current", "page");
    await expect(menu.getByRole("link", { name: "Projects" })).toBeVisible();
    await expect(menu.getByRole("button", { name: "Take the tour" })).toBeVisible();
    await expect(menu.getByRole("button", { name: "Login" })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
    await expect(page.getByRole("button", { name: "Open menu" })).toBeFocused();

    // The open menu covers the heading, so click lower down the page
    menu = await openMenu(page);
    await page.mouse.click(20, 600);
    await expect(menu).toBeHidden();

    menu = await openMenu(page);
    await menu.getByRole("button", { name: "Login" }).click();
    await expect(page.getByRole("dialog", { name: "Cruz Control" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Cruz Control" })).toBeHidden();

    // Projects goes to /project and leaves the menu closed
    menu = await openMenu(page);
    await menu.getByRole("link", { name: "Projects" }).click();
    await expect(page).toHaveURL(/\/project$/);
    await expect(page.getByRole("button", { name: "Open menu" })).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByRole("link", { name: "Projects" })).toHaveCount(0);
  });

  test("results page menu starts the results tour", async ({ page }) => {
    await page.route(`**/api/scan/${scanId}`, async (route) => {
      await route.fulfill({ json: scanResult });
    });

    await page.goto(`/scan/${scanId}`);
    await expect(page.getByRole("heading", { name: "octocat/hello-world", exact: true })).toBeVisible();
    await expectOneRowWithMenuLast(page);

    const menu = await openMenu(page);
    await menu.getByRole("button", { name: "Take the tour" }).click();
    await expect(page.getByRole("dialog", { name: "Your results are in" })).toBeVisible();
  });

  test("signed-in user keeps the avatar next to the menu", async ({ page }) => {
    await page.route(/\/auth\/v1\/token\?grant_type=password$/, async (route) => {
      await route.fulfill({
        json: {
          access_token: "playwright-test-access-token",
          token_type: "bearer",
          expires_in: 3600,
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          refresh_token: "playwright-test-refresh-token",
          user: testUser,
        },
      });
    });
    await page.route(/\/auth\/v1\/user$/, async (route) => {
      await route.fulfill({ json: testUser });
    });
    await page.route("**/api/invite", async (route) => {
      await route.fulfill({ json: [] });
    });

    await page.goto("/");
    const menu = await openMenu(page);
    await menu.getByRole("button", { name: "Login" }).click();
    const loginPanel = page.getByRole("dialog", { name: "Cruz Control" }).getByRole("tabpanel", { name: "Log In" });
    await loginPanel.getByRole("textbox", { name: "Email" }).fill(testUser.email);
    await loginPanel.getByRole("textbox", { name: "Password" }).fill("playwright-test-password");
    await loginPanel.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/scan$/);

    const avatar = page.getByRole("button", { name: "Open profile menu for Playwright User" });
    await expect(avatar).toBeVisible();
    await expectOneRowWithMenuLast(page);
    const avatarBox = await avatar.boundingBox();
    const menuBox = await page.getByRole("button", { name: "Open menu" }).boundingBox();
    expect(Math.abs(avatarBox.y + avatarBox.height / 2 - (menuBox.y + menuBox.height / 2))).toBeLessThan(8);

    const appMenu = await openMenu(page);
    await expect(appMenu.getByRole("link", { name: "Scan" })).toBeVisible();
    await expect(appMenu.getByRole("link", { name: "Projects" })).toBeVisible();
    await expect(appMenu.getByRole("button", { name: "Login" })).toHaveCount(0);
  });
});

test.describe("desktop header", () => {
  test.use({ viewport: { width: 1024, height: 768 } });

  test("hides the hamburger and shows the full nav", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: /Explore as guest/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Open menu" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Login" })).toBeVisible();

    await page.goto("/scan");
    await expect(page.getByRole("heading", { name: "What would you like to scan?" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Open menu" })).toBeHidden();
    await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Take the tour" })).toBeVisible();
  });
});
