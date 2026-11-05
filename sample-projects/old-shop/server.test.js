// FICTIONAL SAMPLE — one happy-path test; it does not establish security.
import { expect, test } from "bun:test";
import { createApp } from "./server.js";

test("accepts a normal sample tea order and returns its total", async () => {
  const handle = createApp();
  const response = await handle(new Request("http://localhost/api/orders", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      productId: "tea-tin", quantity: 2, unitPriceCents: 1200,
      name: "Sample Rowan", email: "rowan@example.test",
    }),
  }));

  expect(response.status).toBe(201);
  const { order } = await response.json();
  expect(order.id).toBe(1);
  expect(order.totalCents).toBe(2400);
  expect(order.currency).toBe("USD");
});

test("private order collection is unavailable before and after fictional orders", async () => {
  const handle = createApp();
  expect((await handle(new Request("http://localhost/api/orders"))).status).toBe(404);
  for (const [name, email] of [["Fictional First", "first@example.test"], ["Fictional Second", "second@example.test"]]) {
    const response = await handle(new Request("http://localhost/api/orders", {
      method: "POST",
      body: JSON.stringify({ productId: "tea-tin", quantity: 1, unitPriceCents: 1200, name, email }),
    }));
    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.order.name).toBe(name);
    expect(data.order.email).toBe(email);
    expect(data).not.toHaveProperty("orders");
  }
  for (const path of ["/api/orders", "/api/orders?owner=true"]) {
    const response = await handle(new Request("http://localhost" + path));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found" });
  }
});

test("fabricated authorization cannot restore a removed private collection", async () => {
  const handle = createApp();
  for (const authorization of ["Bearer fictional-owner", "Basic " + btoa("owner:fictional-password")]) {
    const response = await handle(new Request("http://localhost/api/orders", { headers: { authorization } }));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "Not found" });
  }
});
