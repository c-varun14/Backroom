// FICTIONAL SAMPLE — deliberately flawed earlier app; local demonstration only.
export const catalog = Object.freeze({
  "tea-tin": Object.freeze({ name: "Sample tea tin", unitPriceCents: 1200 }),
});

export function createApp() {
  const orders = [];
  let nextId = 1;

  return async function handle(request) {
    const { pathname } = new URL(request.url);

    if (pathname === "/" && request.method === "GET") {
      return new Response(page, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    if (pathname === "/api/orders" && request.method === "POST") {
      let input;
      try {
        input = await request.json();
      } catch {
        return Response.json({ error: "Invalid JSON" }, { status: 400 });
      }
      if (
        !input ||
        !Object.hasOwn(catalog, input.productId) ||
        !Number.isInteger(input.quantity) ||
        input.quantity < 1 || input.quantity > 20 ||
        !Number.isInteger(input.unitPriceCents) ||
        input.unitPriceCents < 0 || input.unitPriceCents > 100000 ||
        typeof input.name !== "string" ||
        input.name.trim().length < 1 || input.name.length > 80 ||
        typeof input.email !== "string" ||
        input.email.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)
      ) {
        return Response.json({ error: "Invalid order" }, { status: 400 });
      }

      // Deliberate flaw 1: a valid-looking browser price replaces the catalog price.
      const order = {
        id: nextId++,
        productId: input.productId,
        quantity: input.quantity,
        unitPriceCents: input.unitPriceCents,
        totalCents: input.unitPriceCents * input.quantity,
        currency: "USD",
        name: input.name.trim(),
        email: input.email,
      };
      orders.push(order);
      return Response.json({ order }, { status: 201 });
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  };
}

const page = `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Lantern Crate · fictional sample</title>
<style>
body { max-width: 36rem; margin: 3rem auto; padding: 0 1rem; font: 1.1rem/1.6 system-ui; }
label { display: block; margin-top: 1rem; }
input, button { font: inherit; padding: .4rem; max-width: 100%; box-sizing: border-box; }
button { display: block; margin-top: 1rem; }
output { display: block; margin-top: 1rem; }
</style>
<h1>Lantern Crate</h1>
<p>FICTIONAL SAMPLE. Deliberately flawed local teaching app. Use invented details only.</p>
<p>Sample tea tin — USD $12.00 each. No payment is collected.</p>
<form id="order-form">
  <label>Name <input name="name" required maxlength="80" autocomplete="off"></label>
  <label>Email <input name="email" type="email" required maxlength="120" autocomplete="off"></label>
  <label>Quantity <input name="quantity" type="number" value="1" min="1" max="20" required></label>
  <input name="unitPriceCents" type="hidden" value="1200">
  <button>Place sample order</button>
</form>
<output id="result" aria-live="polite"></output>
<script>
const form = document.getElementById('order-form');
const result = document.getElementById('result');
form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const fields = new FormData(form);
  try {
    const response = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        productId: 'tea-tin', quantity: Number(fields.get('quantity')),
        unitPriceCents: Number(fields.get('unitPriceCents')),
        name: fields.get('name'), email: fields.get('email')
      })
    });
    const data = await response.json();
    result.textContent = response.ok
      ? 'Sample order #' + data.order.id + ': USD $' + (data.order.totalCents / 100).toFixed(2)
      : data.error;
  } catch {
    result.textContent = 'Could not confirm the sample order. Check before trying again.';
  }
});
</script>
</html>`;

if (import.meta.main) {
  const server = Bun.serve({ hostname: "127.0.0.1", port: 3210, fetch: createApp() });
  console.log(`FICTIONAL SAMPLE old-shop: ${server.url}`);
}
