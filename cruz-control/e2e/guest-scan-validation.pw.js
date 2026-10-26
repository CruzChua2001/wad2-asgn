import { expect, test } from "@playwright/test";

/*
  USER JOURNEY TEST CASE: GUEST SEES VALIDATION ERRORS AND CANNOT PROCEED TO SCAN INVALID DOMAINS/REPOS
    1. User starts on Landing page
    2. Continue as Guest to Scan page
    3. Enter invalid domain name ("not a domain")
    4. Guest sees invalid domain name error message
    5. Start scan button is disabled and cannot be clicked
    6. Enter invalid GitHub repository (github.com/juice-shop)
    7. Guest sees invalid domain name error message
    8. Start scan button is disabled and cannot be clicked
*/
test("Guest sees validation errors for invalid domain and repository inputs while staying on the scan page", async ({ page }) => {
  const scanRequests = [];

  await page.route("**/api/scan", async (route) => {
    if (route.request().method() === "POST") {
      scanRequests.push(route.request());
      await route.fulfill({ status: 500, json: { error: "Unexpected scan request" } });
      return;
    }

    await route.continue();
  });

  // 1. User starts on Landing page
  await page.goto("/");
  await page.getByRole("link", { name: /Explore as guest/ }).click();
  // 2. Continue as Guest to Scan page
  await expect(page).toHaveURL(/\/scan$/);

  const startScanButton = page.getByRole("button", { name: "Start scan" });

  // 3. Enter invalid domain name ("not a domain")
  const domainInput = page.getByRole("textbox", { name: "Website or domain" });  
  await domainInput.fill("not a domain");
  // 4. Guest sees invalid domain name error message
  await expect(page.getByText("Use a public hostname such as example.com.")).toBeVisible();
  // 5. Start scan button is disabled and cannot be clicked
  await expect(domainInput).toHaveAttribute("aria-invalid", "true");
  await expect(startScanButton).toBeDisabled();
  await domainInput.press("Enter");
  expect(scanRequests).toHaveLength(0);
  await expect(page).toHaveURL(/\/scan$/);

  // 6. Enter invalid GitHub repository (github.com/juice-shop)
  await page.getByRole("button", { name: /GitHub repository/ }).click();
  const repositoryInput = page.getByRole("textbox", { name: "Public repository" });
  await repositoryInput.fill("github.com/juice-shop");
  // 7. Guest sees invalid domain name error message
  await expect(page.getByText("Use a public GitHub URL or owner/repository.")).toBeVisible();
  // 8. Start scan button is disabled and cannot be clicked
  await expect(repositoryInput).toHaveAttribute("aria-invalid", "true");
  await expect(startScanButton).toBeDisabled();
  await repositoryInput.press("Enter");
  expect(scanRequests).toHaveLength(0);
  await expect(page).toHaveURL(/\/scan$/);
});
