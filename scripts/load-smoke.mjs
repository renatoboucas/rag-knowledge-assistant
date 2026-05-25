const target = process.env.LOAD_TEST_URL ?? "http://localhost:3100";
const path = process.env.LOAD_TEST_PATH ?? "/";
const requests = Number(process.env.LOAD_TEST_REQUESTS ?? 40);
const concurrency = Number(process.env.LOAD_TEST_CONCURRENCY ?? 8);
const warmupRequests = Number(process.env.LOAD_TEST_WARMUP_REQUESTS ?? 4);
const maxP95Ms = Number(process.env.LOAD_TEST_MAX_P95_MS ?? 2500);
const maxErrorRate = Number(process.env.LOAD_TEST_MAX_ERROR_RATE ?? 0.01);

const url = new URL(path, target).toString();
const latencies = [];
let failures = 0;
let cursor = 0;

async function hit() {
  const started = performance.now();

  try {
    const response = await fetch(url, { redirect: "manual" });
    const latency = performance.now() - started;
    latencies.push(latency);

    if (response.status >= 500) {
      failures += 1;
    }
  } catch {
    failures += 1;
    latencies.push(performance.now() - started);
  }
}

for (let index = 0; index < warmupRequests; index += 1) {
  await fetch(url, { redirect: "manual" }).catch(() => undefined);
}

async function worker() {
  while (cursor < requests) {
    cursor += 1;
    await hit();
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));

latencies.sort((a, b) => a - b);
const p95Index = Math.max(0, Math.ceil(latencies.length * 0.95) - 1);
const p95 = latencies[p95Index] ?? 0;
const average =
  latencies.reduce((total, value) => total + value, 0) / Math.max(1, latencies.length);
const errorRate = failures / Math.max(1, requests);

const summary = {
  url,
  requests,
  concurrency,
  warmupRequests,
  averageMs: Math.round(average),
  p95Ms: Math.round(p95),
  failures,
  errorRate,
  maxP95Ms,
  maxErrorRate,
};

console.log(JSON.stringify(summary, null, 2));

if (p95 > maxP95Ms || errorRate > maxErrorRate) {
  process.exit(1);
}
