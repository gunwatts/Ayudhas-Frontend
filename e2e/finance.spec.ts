/**
 * Full workflow from the brief (§23 "Integration and end-to-end tests", steps 1–14), driven through the UI
 * against the real FastAPI backend. Expected figures are computed independently below.
 */
import { expect, type Page, test } from "@playwright/test";

const USER = { username: "demo", password: "Demo-Password-2026" };
const INTRUDER = { username: "intruder", password: "Intruder-Pass-2026" };

/** Matches a form label exactly, allowing the visual "*" that marks required fields. */
const lbl = (text: string) => new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}( \\*)?$`);

const inr = (n: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 2 }).format(n);

async function login(page: Page, who = USER) {
  await page.goto("/login/");
  await page.getByLabel(lbl("Username")).fill(who.username);
  await page.getByLabel(lbl("Password")).fill(who.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
}

async function pick(page: Page, label: string | RegExp, option: string | RegExp) {
  await page.getByRole("dialog").getByLabel(typeof label === "string" ? lbl(label) : label).click();
  await page.getByRole("option", { name: option }).click();
}

async function available(page: Page) {
  await page.getByRole("link", { name: "Overview" }).click();
  return page.getByTestId("available");
}

async function quickAdd(page: Page, kind: "Expense" | "Income", amount: string, description: string, category: string) {
  await page.getByRole("button", { name: /Add transaction/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("tab", { name: kind }).click();
  await dialog.getByLabel(lbl("Amount")).fill(amount);
  await pick(page, kind === "Income" ? "Into account" : "Paid from", "Bank");
  await pick(page, "Category", category);
  await dialog.getByLabel(lbl("Description")).fill(description);
  await dialog.getByRole("button", { name: `Add ${kind.toLowerCase()}` }).click();
  await expect(dialog).toBeHidden();
}

test("complete money workflow stays consistent across every screen", async ({ page, browser }) => {
  // 1. Authenticate.
  await login(page);

  // 2. Create an account with an opening balance (not income).
  await page.getByRole("link", { name: "Accounts" }).click();
  await page.getByRole("button", { name: "Add account" }).first().click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel(lbl("Name")).fill("Bank");
  await dialog.getByLabel(lbl("Current balance")).fill("10000");
  await dialog.getByRole("button", { name: "Add account" }).click();
  await expect(page.getByText(inr(10000)).first()).toBeVisible();

  // 3–4. Income and an expense.
  await quickAdd(page, "Income", "50000", "October salary", "Salary");
  await quickAdd(page, "Expense", "1200", "Groceries", "Groceries");

  // 5. Available balance.
  let cash = 10000 + 50000 - 1200;
  await expect(await available(page)).toHaveText(inr(cash));

  // 6. Loan taken into the bank account: ₹1,00,000 at 12% for 12 months.
  await page.getByRole("link", { name: "Loans taken" }).click();
  await page.getByRole("button", { name: "Add loan" }).first().click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel(lbl("Lender")).fill("SBI");
  await dialog.getByLabel(lbl("Label")).fill("Personal loan");
  await dialog.getByLabel(lbl("Amount borrowed")).fill("100000");
  await dialog.getByLabel(lbl("Annual interest rate (%)")).fill("12");
  await dialog.getByLabel(lbl("Tenure (months)")).fill("12");
  await pick(page, "Received into account", "Bank");
  await expect(dialog.getByText(/Estimated EMI: ₹8,884\.88/)).toBeVisible();
  await dialog.getByRole("button", { name: "Add loan" }).click();
  await expect(page.getByRole("heading", { name: "Personal loan" })).toBeVisible();
  await expect(page.getByText("EMI ₹8,884.88", { exact: false })).toBeVisible();

  // 7. Record one installment (form defaults to the next EMI, interest first).
  await page.getByRole("button", { name: "Record repayment" }).click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel(lbl("Amount paid"))).toHaveValue("8884.88");
  await pick(page, "Paid from", "Bank");
  await dialog.getByRole("button", { name: "Record repayment" }).click();
  await expect(dialog).toBeHidden();
  // Interest for month 1 = 1% of 1,00,000 = 1,000 → principal 7,884.88 → outstanding 92,115.12
  await expect(page.getByText(inr(92115.12)).first()).toBeVisible();
  cash += 100000 - 8884.88;

  // 8–9. Money lent and a partial repayment.
  await page.getByRole("link", { name: "Money lent" }).click();
  await page.getByRole("button", { name: "Record money lent" }).first().click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel(lbl("Lent to")).fill("Ravi");
  await dialog.getByLabel(lbl("Amount lent")).fill("5000");
  await pick(page, "Paid from account", "Bank");
  await dialog.getByRole("button", { name: "Record money lent" }).click();
  await page.getByRole("button", { name: "Record amount received" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel(lbl("Amount paid")).fill("2000");
  await pick(page, "Received into", "Bank");
  await dialog.getByRole("button", { name: "Record repayment" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText(inr(3000)).first()).toBeVisible();
  cash += -5000 + 2000;

  // 10. Money held for a parent: received, then partly returned.
  await page.getByRole("link", { name: "Held for others" }).click();
  await page.getByRole("button", { name: "Record money received" }).first().click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel(lbl("Owner of the money")).fill("Father");
  await dialog.getByLabel(lbl("Purpose")).fill("House repairs");
  await dialog.getByLabel(lbl("Amount received")).fill("20000");
  await pick(page, "Held in account", "Bank");
  await dialog.getByRole("button", { name: "Record" }).click();
  await page.getByRole("button", { name: "Return money" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel(lbl("Amount")).fill("25000");
  await dialog.getByRole("button", { name: "Record return" }).click();
  await expect(dialog.getByText(/Cannot exceed/)).toBeVisible(); // cannot return more than is held
  await dialog.getByLabel(lbl("Amount")).fill("5000");
  await pick(page, "Paid from account", "Bank");
  await dialog.getByRole("button", { name: "Record return" }).click();
  await expect(dialog).toBeHidden();
  cash += 20000 - 5000;
  const held = 15000;

  // 11. Every summary agrees: available excludes custody; liabilities and receivables are separate.
  await expect(await available(page)).toHaveText(inr(cash - held));
  const card = (label: string) => page.locator("[data-slot=card]").filter({ hasText: label }).first();
  await expect(card("Owed to you")).toContainText(inr(3000));
  await expect(card("Loans outstanding")).toContainText(inr(92115.12));
  await expect(page.getByTestId("kpi-salary")).toHaveText(inr(50000)); // recorded under Salary; loans, custody, transfers are not salary
  await expect(page.getByTestId("kpi-spent")).toHaveText(inr(1200 + 1000)); // spending + loan interest only

  // 12. Edit then delete an expense; dependent figures follow.
  await page.getByRole("link", { name: "Expenses" }).click();
  await page.getByRole("button", { name: "Actions for Groceries" }).click();
  await page.getByRole("menuitem", { name: "Edit" }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel(lbl("Amount")).fill("1500");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog).toBeHidden();
  await expect(await available(page)).toHaveText(inr(cash - held - 300));
  await page.getByRole("link", { name: "Expenses" }).click();
  await page.getByRole("button", { name: "Actions for Groceries" }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(page.getByText("Transaction deleted")).toBeVisible();
  await expect(await available(page)).toHaveText(inr(cash - held + 1200));

  // 14. A hard refresh keeps the session and the same authoritative numbers.
  await page.reload();
  await expect(page.getByTestId("available")).toHaveText(inr(cash - held + 1200));

  // 13. Another user sees none of it — through the UI and via direct API calls.
  const other = await browser.newContext();
  const intruder = await other.newPage();
  await login(intruder, INTRUDER);
  await expect(intruder.getByTestId("available")).toHaveText(inr(0));
  await intruder.goto("/loans/view/?id=1");
  await expect(intruder.getByText("Couldn't load this")).toBeVisible();
  const status = await intruder.evaluate(async () => (await fetch("http://localhost:8000/api/v1/loans/1", { credentials: "include" })).status);
  expect(status).toBe(404);
  await other.close();
});

test("salary and an event's expenses count once on every screen", async ({ page }) => {
  await login(page, INTRUDER); // a clean account: no money recorded yet
  const monthLabel = new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric" }).format(new Date());

  // Salary for this month.
  await page.getByRole("link", { name: "Budgets" }).click();
  await page.getByRole("button", { name: "Set monthly salary" }).first().click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel(lbl("Salary for the month")).fill("40000");
  await dialog.getByRole("button", { name: "Save salary" }).click();
  await expect(dialog).toBeHidden();

  // An event, and an expense recorded from its card.
  await page.getByRole("tab", { name: "Events" }).click();
  await page.getByRole("button", { name: "New event" }).first().click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel(lbl("Event name")).fill("Diwali");
  await dialog.getByRole("button", { name: "Create event" }).click();
  await expect(dialog).toBeHidden();
  const eventCard = page.locator("[data-slot=card]").filter({ hasText: "Diwali" }).first();
  await eventCard.getByRole("button", { name: "Add expense" }).click();
  dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Event")).toHaveValue("Diwali");
  await dialog.getByLabel(lbl("Amount")).fill("3000");
  await dialog.getByLabel(lbl("Description")).fill("Lights and diyas");
  await dialog.getByRole("button", { name: "Add expense" }).click();
  await expect(dialog).toBeHidden();
  await expect(eventCard).toContainText(inr(3000));
  await expect(eventCard).toContainText("1 expense");
  await eventCard.getByRole("button", { name: /Show transactions/ }).click();
  await expect(eventCard).toContainText("Lights and diyas");
  await expect(eventCard).toContainText(`${monthLabel} · ${inr(3000)}`);

  // A second expense, typed with the event name in a different case: same event, not a new one.
  await page.getByRole("button", { name: /Add transaction/ }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel(lbl("Amount")).fill("500");
  await dialog.getByLabel(lbl("Description")).fill("Sweets");
  await dialog.getByLabel("Event").fill("diwali");
  await dialog.getByRole("button", { name: "Add expense" }).click();
  await expect(dialog).toBeHidden();
  // And a regular expense with no event.
  await page.getByRole("button", { name: /Add transaction/ }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel(lbl("Amount")).fill("1000");
  await dialog.getByLabel(lbl("Description")).fill("Groceries");
  await dialog.getByRole("button", { name: "Add expense" }).click();
  await expect(dialog).toBeHidden();
  await expect(page.locator("[data-slot=card]").filter({ hasText: "Diwali" })).toHaveCount(1);
  await expect(eventCard).toContainText(inr(3500));

  // The month counts every expense once: 3000 + 500 (event) + 1000 = 4500 of 40000.
  await page.getByRole("tab", { name: "Monthly salary" }).click();
  const monthCard = page.locator("[data-slot=card]").filter({ hasText: monthLabel }).first();
  await expect(monthCard).toContainText(inr(4500));
  await expect(monthCard).toContainText(inr(35500));

  await page.getByRole("link", { name: "Overview" }).click();
  await expect(page.getByTestId("kpi-salary")).toHaveText(inr(40000));
  await expect(page.getByTestId("kpi-spent")).toHaveText(inr(4500));
  await expect(page.getByTestId("kpi-remaining")).toHaveText(inr(35500));

  await page.getByRole("link", { name: "Reports" }).click();
  await expect(page.getByTestId("report-salary")).toContainText(inr(40000));
  await expect(page.getByTestId("report-expenses")).toContainText(inr(4500));
  await expect(page.getByTestId("report-remaining")).toContainText(inr(35500));
});

test("charts do not draw a focus box when clicked", async ({ page }) => {
  await login(page);
  const chart = page.locator(".recharts-wrapper").first();
  await chart.click({ position: { x: 120, y: 80 } });
  const outline = await chart.evaluate((el) => {
    const focused = document.activeElement as Element | null;
    const target = focused && el.contains(focused) ? focused : el;
    return getComputedStyle(target).outlineStyle;
  });
  expect(outline).toBe("none");
});

test("unauthenticated visitors are sent to sign-in, and bad credentials are rejected", async ({ page }) => {
  await page.goto("/reports/");
  await expect(page).toHaveURL(/\/login\/\?next=%2Freports%2F/);
  await page.getByLabel(lbl("Username")).fill("demo");
  await page.getByLabel(lbl("Password")).fill("wrong-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveText("Incorrect username or password");
});

test("signing out returns to sign-in and ends the session", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: "Account menu" }).click();
  await page.getByRole("menuitem", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login\/$/);
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
  await page.goto("/reports/");
  await expect(page).toHaveURL(/\/login\/\?next=%2Freports%2F/);
});

// The e2e backend runs with ALLOW_REGISTRATION=true, REGISTRATION_INVITE_CODE=e2e-invite and a GOOGLE_CLIENT_ID.
test("new users sign up with an invite code and land on their own empty dashboard", async ({ page }) => {
  await page.goto("/login/");
  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(page).toHaveURL(/\/signup\/$/);
  await page.getByLabel(lbl("Username")).fill(`new${Date.now()}`);
  await page.getByLabel(lbl("Password")).fill("Fresh-Password-2026");
  await page.getByLabel(lbl("Confirm password")).fill("Fresh-Password-2026");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Enter your invite code", { exact: true })).toBeVisible();
  await page.getByLabel(lbl("Invite code")).fill("wrong-code");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("That invite code isn't right")).toBeVisible();
  await page.getByLabel(lbl("Invite code")).fill("e2e-invite");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(page.getByTestId("available")).toHaveText(inr(0)); // sees none of the demo user's money
});

const FAKE_GOOGLE_SCRIPT = `window.google = { accounts: { id: {
  initialize: (o) => { window.__gisCallback = o.callback; },
  renderButton: (el) => { const b = document.createElement("button"); b.type = "button"; b.textContent = "Fake Google";
    b.onclick = () => window.__gisCallback({ credential: "fake-id-token" }); el.appendChild(b); },
} } };`;

test("the Google button sends Google's credential to the server, which rejects a forged one", async ({ page }) => {
  await page.route("https://accounts.google.com/gsi/client", (route) =>
    route.fulfill({ contentType: "text/javascript", body: FAKE_GOOGLE_SCRIPT }),
  );
  await page.goto("/login/");
  const sent = page.waitForRequest((r) => r.url().endsWith("/api/v1/auth/google") && r.method() === "POST");
  await page.getByRole("button", { name: "Fake Google" }).click();
  expect((await sent).postDataJSON()).toEqual({ credential: "fake-id-token" });
  await expect(page.locator("form").getByRole("alert")).toHaveText(/Google sign-in failed|Couldn't reach Google/);
  await expect(page).toHaveURL(/\/login\//);
});

test("Google sign-up on the sign-up page does not ask for the invite code", async ({ page }) => {
  await page.route("https://accounts.google.com/gsi/client", (route) =>
    route.fulfill({ contentType: "text/javascript", body: FAKE_GOOGLE_SCRIPT }),
  );
  await page.goto("/signup/");
  const sent = page.waitForRequest((r) => r.url().endsWith("/api/v1/auth/google") && r.method() === "POST");
  await page.getByRole("button", { name: "Fake Google" }).click(); // invite code box left empty
  expect((await sent).postDataJSON()).toEqual({ credential: "fake-id-token" });
  await expect(page.getByText("Enter your invite code", { exact: true })).toHaveCount(0);
});

test("form validation is inline and nothing is saved @responsive", async ({ page }) => {
  await login(page);
  await page.getByRole("button", { name: /Add transaction/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(lbl("Amount")).fill("12.345");
  await dialog.getByRole("button", { name: "Add expense" }).click();
  await expect(dialog.getByText("Enter an amount greater than 0 with at most 2 decimals")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});
