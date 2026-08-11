/**
 * Cold-start timing: kill nothing — expects caller to start a fresh process.
 * Hits /health then /products as soon as the server accepts connections.
 */
const BASE = process.env.API_BASE || 'http://localhost:4000';

async function waitForUp(timeoutMs = 120_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      const res = await fetch(`${BASE}/health`);
      if (res.ok) {
        const j = await res.json();
        return { waitMs: Date.now() - t0, health: j };
      }
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('server did not become ready');
}

async function timed(path) {
  const t0 = performance.now();
  const res = await fetch(`${BASE}${path}`);
  const text = await res.text();
  return {
    path,
    status: res.status,
    ms: Math.round((performance.now() - t0) * 10) / 10,
    bytes: Buffer.byteLength(text),
  };
}

const up = await waitForUp();
const firstProducts = await timed('/api/v1/products');
const warm = [];
for (let i = 0; i < 3; i++) {
  warm.push(await timed('/api/v1/products'));
  warm.push(await timed('/health'));
  warm.push(await timed('/api/v1/categories'));
  warm.push(await timed('/api/v1/banners'));
}
console.log(
  JSON.stringify(
    {
      at: new Date().toISOString(),
      up,
      firstProducts,
      warm,
    },
    null,
    2,
  ),
);
