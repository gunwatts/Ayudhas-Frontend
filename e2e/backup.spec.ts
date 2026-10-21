/**
 * Backup & transfer, through the UI against the real backend: import a password-protected file made by the
 * Ayudhas Pro app, import it again (nothing is added twice), and download an encrypted backup that the app can open.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { expect, type Page, test } from "@playwright/test";

const USER = { username: "demo", password: "Demo-Password-2026" };
const APP_FILE = path.join(__dirname, "..", "src", "__tests__", "fixtures", "app-finance.encrypted.json");
const APP_PASSWORD = "app-to-web-8";

async function login(page: Page) {
  await page.goto("/login/");
  await page.getByLabel(/^Username( \*)?$/).fill(USER.username);
  await page.getByLabel(/^Password( \*)?$/).fill(USER.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
}

async function importAppFile(page: Page) {
  await page.goto("/settings/#backup");
  await page.locator("#backup-file").setInputFiles(APP_FILE);
  await page.getByLabel("Password of this backup").fill(APP_PASSWORD);
  await page.getByRole("button", { name: "Unlock" }).click();
}

test("import an encrypted app backup once, then download an encrypted backup", async ({ page }) => {
  await login(page);

  await importAppFile(page);
  await expect(page.getByText(/new records will be added/)).toBeVisible();
  await expect(page.getByRole("cell", { name: "Loans" })).toBeVisible();
  await page.getByRole("button", { name: /^Import \d+ records$/ }).click();
  await expect(page.getByText(/^Imported \d+ records$/)).toBeVisible();

  // The app's accounts, loans and transactions are now on the website.
  await page.goto("/accounts/");
  await expect(page.getByText("Cash", { exact: true }).first()).toBeVisible();
  await page.goto("/loans/");
  await expect(page.getByText("Home loan")).toBeVisible();

  // The same file again adds nothing.
  await importAppFile(page);
  await expect(page.getByText("Everything in this file is already here.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Import 0 records" })).toBeDisabled();
  await page.getByRole("button", { name: "Cancel" }).click();

  // Download: an encrypted envelope, nothing readable inside.
  await page.getByLabel("Backup password", { exact: true }).fill("web-to-app-8");
  await page.getByLabel("Repeat the password").fill("web-to-app-8");
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Download encrypted backup/ }).click()]);
  expect(download.suggestedFilename()).toMatch(/^FinanceAyudhas_Backup_\d{4}-\d{2}-\d{2}_Encrypted\.json$/);
  const file = JSON.parse(readFileSync((await download.path())!, "utf8"));
  expect(file.type).toBe("AYUDHAS_ENCRYPTED_BACKUP");
  expect(file.kdf).toMatchObject({ name: "PBKDF2-SHA256", iterations: 210000 });
  expect(JSON.stringify(file)).not.toContain("Home loan");
  await expect(page.getByText(/Backup downloaded/)).toBeVisible();
});
