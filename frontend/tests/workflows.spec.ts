import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { execFileSync } from "node:child_process";
const createdEmails: string[] = [];
test.afterAll(() => {
  for (const email of createdEmails)
    execFileSync("python3", [
      "-c",
      "import sqlite3,sys; db=sqlite3.connect('../logitrack.db'); db.execute('PRAGMA foreign_keys=ON'); db.execute('DELETE FROM AspNetUsers WHERE Email=? AND UserName=?',(sys.argv[1],sys.argv[1])); db.commit()",
      email,
    ]);
});
const env = Object.fromEntries(
  fs
    .readFileSync("../.env", "utf8")
    .split("\n")
    .filter((x) => x.includes("="))
    .map((x) => {
      const i = x.indexOf("=");
      return [x.slice(0, i), x.slice(i + 1).replace(/^['"]|['"]$/g, "")];
    }),
);
test("anonymous navigation and CSRF protection", async ({ page, request }) => {
  await page.goto("/inventory");
  await expect(page).toHaveURL(/login/);
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
  const r = await request.post("/api/gateway/auth/logout", {
    headers: { Origin: "https://attacker.invalid" },
  });
  expect(r.status()).toBe(403);
});
test("manager inventory, order, validation and responsive workflow", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(env.Bootstrap__ManagerEmail);
  await page
    .getByLabel("Password", { exact: true })
    .fill(env.Bootstrap__ManagerPassword);
  await page.getByRole("button", { name: "Enter command center" }).click();
  await expect(page).toHaveURL(/dashboard/);
  await expect(
    page.getByRole("heading", { name: "Your operations, in focus." }),
  ).toBeVisible();
  await page.goto("/inventory");
  await page
    .getByRole("button", { name: "Add inventory", exact: true })
    .click();
  await page.getByLabel("Item name").fill("E2E-" + Date.now());
  await page.getByLabel("Quantity", { exact: true }).fill("12");
  await page.getByLabel("Location", { exact: true }).fill("E2E test zone");
  const name = await page.getByLabel("Item name").inputValue();
  await page.getByRole("button", { name: "Save record" }).click();
  await expect(page.getByRole("status")).toContainText("created");
  await page
    .getByRole("textbox", { name: "Search inventory", exact: true })
    .last()
    .fill(name);
  await expect(
    page.getByRole("button", { name: new RegExp(`^${name} INV`) }),
  ).toBeVisible();
  await page.goto("/orders");
  await page.getByRole("button", { name: "Create order", exact: true }).click();
  await page.getByLabel("Customer name").fill(name);
  const itemOption = page.getByRole("option").filter({ hasText: name });
  const id = await itemOption.getAttribute("value");
  await page
    .getByRole("combobox", { name: /Inventory item/ })
    .selectOption(id!);
  await page.getByLabel("Line 1 quantity").fill("2");
  await page.getByRole("button", { name: "Save record" }).click();
  await expect(page.getByRole("status")).toContainText("Order created");
  await page.getByRole("textbox", { name: "Search orders" }).fill(name);
  const row = page.getByRole("row").filter({ hasText: name });
  await row.getByRole("button", { name: /Delete order/ }).click();
  await page.getByRole("button", { name: "Confirm deletion" }).click();
  await expect(page.getByRole("status")).toContainText("deleted");
  await page.goto("/inventory");
  await page
    .getByRole("textbox", { name: "Search inventory", exact: true })
    .last()
    .fill(name);
  await page
    .getByRole("button", { name: `Delete ${name}`, exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm deletion" }).click();
  await expect(page.getByRole("status")).toContainText("deleted");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/dashboard");
  await expect(
    page.getByRole("button", { name: "Open navigation" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "Analytics", exact: true }).click();
  await expect(page).toHaveURL(/analytics/);
  const cookies = await page.context().cookies();
  const session = cookies.find((c) => c.name === "logitrack_session");
  expect(session?.httpOnly).toBe(true);
  expect(session?.sameSite).toBe("Strict");
});

test("registration, viewer authorization, and API failure recovery", async ({
  page,
}) => {
  const browserErrors: string[] = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().includes("503 (Service Unavailable)")) browserErrors.push(message.text());
  });
  const email = `ui-${Date.now()}@example.com`;
  createdEmails.push(email);
  await page.goto("/register");
  await page.getByLabel("Email address").fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Temporary-Test!234567");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/login/);
  await page.getByLabel("Email address").fill(email);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Temporary-Test!234567");
  await page.getByRole("button", { name: "Enter command center" }).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.goto("/inventory");
  await expect(
    page.getByText("Viewer access · A Manager can create and delete records."),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add inventory", exact: true }),
  ).toHaveCount(0);
  await page.route("**/api/gateway/inventory", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Test API unavailable" }),
    }),
  );
  await page.getByRole("button", { name: "Refresh", exact: true }).click();
  await expect(page.locator(".error[role=alert]")).toContainText(
    "Test API unavailable",
  );
  await page.unroute("**/api/gateway/inventory");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.locator(".error[role=alert]")).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/dashboard");
  await expect(page.getByText("Total orders", { exact: true })).toBeVisible();
  await expect(page.locator(".warehouse canvas")).toBeVisible();
  await page.screenshot({
    path: "/tmp/logitrack-dashboard.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Toggle color theme" }).click();
  await expect(page.locator("html")).toHaveClass(/light/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/light/);
  await page.getByText("Total orders", { exact: true }).waitFor();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".overview-banner")).toHaveCSS(
    "background-color",
    "rgb(16, 24, 39)",
  );
  await expect(page.locator(".warehouse canvas")).toBeVisible();
  await page.screenshot({ path: "/tmp/logitrack-light.png", fullPage: true });
  await page.getByRole("button", { name: "Toggle color theme" }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "/tmp/logitrack-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(page).toHaveURL(/login/);
  expect(browserErrors).toEqual([]);
});
