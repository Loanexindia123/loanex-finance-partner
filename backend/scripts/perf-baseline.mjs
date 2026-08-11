/**
 * Local API timing harness for LoanEx backend optimization.
 * Usage: node scripts/perf-baseline.mjs [label]
 */
const BASE = process.env.API_BASE || 'http://localhost:4000';
const LABEL = process.argv[2] || 'measure';

async function timed(path) {
  const url = `${BASE}${path}`;
  const t0 = performance.now();
  const res = await fetch(url);
  const body = await res.text();
  const ms = performance.now() - t0;
  return {
    path,
    status: res.status,
    ms: Math.round(ms * 10) / 10,
    bytes: Buffer.byteLength(body),
    hydrateMs: (() => {
      try {
        return JSON.parse(body)?.data?.hydrateMs ?? null;
      } catch {
        return null;
      }
    })(),
    productCount: (() => {
      try {
        const j = JSON.parse(body);
        const d = j?.data;
        if (Array.isArray(d)) return d.length;
        if (Array.isArray(d?.products)) return d.products.length;
        if (Array.isArray(d?.items)) return d.items.length;
        return null;
      } catch {
        return null;
      }
    })(),
  };
}

async function main() {
  const results = [];
  // First wave after cold boot
  results.push(await timed('/health'));
  results.push(await timed('/api/v1/products'));
  results.push(await timed('/api/v1/categories'));
  results.push(await timed('/api/v1/banners'));

  // Discover a product id/slug for detail
  let detailPath = null;
  try {
    const res = await fetch(`${BASE}/api/v1/products?limit=1`);
    const j = await res.json();
    const p = j?.data?.products?.[0] ?? j?.data?.[0] ?? j?.data?.items?.[0];
    if (p?.slug) detailPath = `/api/v1/products/${p.slug}`;
    else if (p?.id) detailPath = `/api/v1/products/${p.id}`;
  } catch {
    /* ignore */
  }
  if (detailPath) results.push(await timed(detailPath));

  // Warm rounds (3x)
  for (let i = 1; i <= 3; i++) {
    results.push({ round: `warm-${i}`, ...(await timed('/health')) });
    results.push({ round: `warm-${i}`, ...(await timed('/api/v1/products')) });
    results.push({ round: `warm-${i}`, ...(await timed('/api/v1/categories')) });
    results.push({ round: `warm-${i}`, ...(await timed('/api/v1/banners')) });
    if (detailPath) results.push({ round: `warm-${i}`, ...(await timed(detailPath)) });
  }

  console.log(JSON.stringify({ label: LABEL, base: BASE, at: new Date().toISOString(), results }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
