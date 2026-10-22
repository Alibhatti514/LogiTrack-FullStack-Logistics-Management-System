import { test, expect } from "@playwright/test";
import fs from "node:fs";
import type {
  Inventory,
  Order,
  OrderDetail,
  OrderedProduct,
} from "@/lib/models";
const env = Object.fromEntries(
  fs
    .readFileSync("../.env", "utf8")
    .split("\n")
    .filter((line) => line.includes("="))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i), line.slice(i + 1).replace(/^['"]|['"]$/g, "")];
    }),
);
test("seeded dashboard, order analytics and warehouse use live API data", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/login");
  await page.getByLabel("Email address").fill(env.Bootstrap__ManagerEmail);
  await page
    .getByLabel("Password", { exact: true })
    .fill(env.Bootstrap__ManagerPassword);
  await page.getByRole("button", { name: "Enter command center" }).click();
  await expect(page).toHaveURL(/dashboard/);
  const data = await page.evaluate(async () => {
    const read = async (path: string) => {
      const r = await fetch("/api/gateway/" + path);
      if (!r.ok) throw Error("API verification failed");
      return r.json();
    };
    return {
      inventory: (await read("inventory")) as Inventory[],
      orders: (await read("orders")) as Order[],
    };
  });
  expect(
    data.inventory.filter((item) => item.name.startsWith("[DEMO LT1]")),
  ).toHaveLength(50);
  expect(
    data.orders.filter((order) => order.customerName.startsWith("[DEMO LT1]")),
  ).toHaveLength(25);
  const values = [
    data.inventory.length,
    data.inventory.reduce((sum, item) => sum + item.quantity, 0),
    data.orders.length,
    data.inventory.filter((item) => item.quantity <= 10).length,
  ];
  for (let i = 0; i < values.length; i++)
    await expect(
      page.locator(".stat-card").nth(i).locator(":scope > strong"),
    ).toHaveText(values[i].toLocaleString());
  await expect(page.locator(".warehouse canvas")).toBeVisible();
  await page.getByLabel("Warehouse inventory scope").selectOption("LHR");
  const lhr = data.inventory.filter((item) => item.location.startsWith("LHR-"));
  await expect(page.locator(".scene-data p")).toContainText(
    `${lhr.length} products`,
  );
  await expect(page.locator(".scene-data p")).toContainText(
    `${lhr.reduce((sum, item) => sum + item.quantity, 0).toLocaleString()} units`,
  );
  await page.goto("/analytics");
  await expect(
    page.getByRole("heading", { name: "Most frequently ordered products" }),
  ).toBeVisible();
  const aggregate = await page.evaluate(async () => {
    const read = async (path: string) => {
      const r = await fetch("/api/gateway/" + path);
      if (!r.ok) throw Error("API verification failed");
      return r.json();
    };
    const orders = (await read("orders")) as Order[];
    const counts: Record<number, { orderCount: number; orderedUnits: number }> =
      {};
    for (const order of orders) {
      const detail = (await read("orders/" + order.orderId)) as OrderDetail;
      for (const item of detail.items) {
        const current = counts[item.inventoryItemId] || {
          orderCount: 0,
          orderedUnits: 0,
        };
        current.orderCount++;
        current.orderedUnits += item.quantity;
        counts[item.inventoryItemId] = current;
      }
    }
    return {
      counts,
      ranked: (await read("orders/analytics")) as OrderedProduct[],
    };
  });
  expect(aggregate.ranked.length).toBeGreaterThan(0);
  for (const item of aggregate.ranked) {
    expect(item.orderCount).toBe(
      aggregate.counts[item.inventoryItemId].orderCount,
    );
    expect(item.orderedUnits).toBe(
      aggregate.counts[item.inventoryItemId].orderedUnits,
    );
  }
  await expect(
    page.getByRole("table", {
      name: "Product order frequency and total ordered units",
    }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
