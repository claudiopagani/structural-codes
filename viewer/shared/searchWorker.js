import { createSearchEngine } from "./searchEngine.js";

const engines = new Map();

async function engineFor(indexUrl) {
  let pending = engines.get(indexUrl);
  if (!pending) {
    pending = fetch(indexUrl).then(async (response) => {
      if (!response.ok) throw new Error(`${indexUrl}: HTTP ${response.status}`);
      return createSearchEngine(await response.json());
    });
    engines.set(indexUrl, pending);
    pending.catch(() => {
      if (engines.get(indexUrl) === pending) engines.delete(indexUrl);
    });
  }
  return pending;
}

self.addEventListener("message", async ({ data }) => {
  if (data?.type !== "search") return;
  const startedAt = performance.now();
  try {
    const engine = await engineFor(data.indexUrl);
    const results = engine.search({ query: data.query, mode: data.mode, limit: data.limit });
    self.postMessage({ type: "results", requestId: data.requestId, query: data.query, mode: data.mode, results, durationMs: performance.now() - startedAt });
  } catch (error) {
    self.postMessage({ type: "error", requestId: data.requestId, message: error instanceof Error ? error.message : String(error) });
  }
});
