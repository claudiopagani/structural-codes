import { spawn } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { cpus, freemem, platform, release, tmpdir, totalmem } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const viewerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = path.resolve(process.env.SCV_BASELINE_OUTPUT || path.join(viewerRoot, "reports", "performance-baseline.json"));
const fast4g = Object.freeze({
  name: "Fast 4G",
  latencyMs: 150,
  downloadBytesPerSecond: 1_600 * 1024 / 8,
  uploadBytesPerSecond: 750 * 1024 / 8,
  packetLossPercent: 0,
});
const modes = ["ntc", "circ", "combined"];
const chunkPattern = /\/data\/codes\/(ntc2018|circ2019)\/chunks\/[^?#]+\.json(?:[?#]|$)/u;

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => server.once("error", reject).listen(0, "127.0.0.1", resolve));
  const address = server.address();
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (!address || typeof address === "string") throw new Error("Impossibile allocare una porta locale per il benchmark.");
  return address.port;
}

async function waitForHttp(url, processHandle) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (processHandle.exitCode !== null) throw new Error(`Il server production è terminato con codice ${processHandle.exitCode}.`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // The production server is still starting.
    }
    await delay(100);
  }
  throw new Error(`Timeout avviando il server production su ${url}.`);
}

async function startProductionServer() {
  const configuredUrl = process.env.SCV_BASE_URL;
  if (configuredUrl) return { baseUrl: configuredUrl.replace(/\/$/u, ""), processHandle: null };
  const port = await freePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const cli = path.join(viewerRoot, "node_modules", "vinext", "dist", "cli.js");
  const processHandle = spawn(process.execPath, [cli, "start", "--port", String(port)], {
    cwd: viewerRoot,
    env: { ...process.env, NODE_ENV: "production" },
    stdio: "ignore",
    windowsHide: true,
  });
  await waitForHttp(baseUrl, processHandle);
  return { baseUrl, processHandle };
}

async function findChromium() {
  const candidates = [
    process.env.SCV_CHROMIUM_PATH,
    process.platform === "win32" ? path.join(process.env.PROGRAMFILES || "", "Google", "Chrome", "Application", "chrome.exe") : null,
    process.platform === "win32" ? path.join(process.env["PROGRAMFILES(X86)"] || "", "Microsoft", "Edge", "Application", "msedge.exe") : null,
    process.platform === "win32" ? path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe") : null,
    process.platform === "darwin" ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" : null,
    process.platform === "linux" ? "/usr/bin/google-chrome" : null,
    process.platform === "linux" ? "/usr/bin/chromium" : null,
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      // Try the next known browser path.
    }
  }
  throw new Error("Chromium non trovato. Imposta SCV_CHROMIUM_PATH sul browser da usare.");
}

async function waitForDevToolsPort(profilePath, processHandle) {
  const portFile = path.join(profilePath, "DevToolsActivePort");
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (processHandle.exitCode !== null) throw new Error(`Chromium è terminato con codice ${processHandle.exitCode}.`);
    try {
      const [port] = (await readFile(portFile, "utf8")).trim().split(/\r?\n/u);
      if (port) return Number(port);
    } catch {
      // Chromium has not written its debugging endpoint yet.
    }
    await delay(50);
  }
  throw new Error("Timeout attendendo l'endpoint DevTools di Chromium.");
}

class CdpClient {
  constructor(url) {
    this.socket = new WebSocket(url);
    this.nextId = 0;
    this.pending = new Map();
    this.listeners = new Map();
    this.ready = new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", ({ data }) => {
      const message = JSON.parse(String(data));
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        if (message.error) pending.reject(new Error(`${pending.method}: ${message.error.message}`));
        else pending.resolve(message.result);
        return;
      }
      const key = `${message.sessionId || "browser"}:${message.method}`;
      for (const listener of this.listeners.get(key) || []) listener(message.params || {});
    });
  }

  async send(method, params = {}, sessionId = undefined) {
    await this.ready;
    const id = ++this.nextId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { method, resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }

  on(sessionId, method, listener) {
    const key = `${sessionId || "browser"}:${method}`;
    const listeners = this.listeners.get(key) || new Set();
    listeners.add(listener);
    this.listeners.set(key, listeners);
    return () => listeners.delete(listener);
  }

  close() {
    this.socket.close();
  }
}

async function launchBrowser() {
  const executablePath = await findChromium();
  const profilePath = await mkdtemp(path.join(tmpdir(), "scv-performance-"));
  const processHandle = spawn(executablePath, [
    "--headless=new",
    "--disable-background-networking",
    "--disable-component-update",
    "--disable-default-apps",
    "--disable-extensions",
    "--disable-gpu",
    "--disable-sync",
    "--metrics-recording-only",
    "--no-default-browser-check",
    "--no-first-run",
    "--remote-debugging-port=0",
    `--user-data-dir=${profilePath}`,
    "--window-size=1440,1000",
    "about:blank",
  ], { stdio: "ignore", windowsHide: true });
  const port = await waitForDevToolsPort(profilePath, processHandle);
  const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  const client = new CdpClient(version.webSocketDebuggerUrl);
  await client.ready;
  return { client, executablePath, processHandle, profilePath };
}

async function evaluate(client, sessionId, expression) {
  const result = await client.send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, sessionId);
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
  return result.result.value;
}

async function waitForCondition(client, sessionId, expression, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(client, sessionId, expression)) return;
    await delay(50);
  }
  throw new Error(`Timeout attendendo la condizione browser: ${expression}`);
}

async function waitForNetworkQuiet(state, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (state.inflight === 0 && performance.now() - state.lastActivity >= 1_500) return;
    await delay(50);
  }
  throw new Error("Timeout attendendo la quiete di rete.");
}

function summarizeLongTasks(entries) {
  const durations = entries.map((entry) => entry.duration);
  return {
    count: entries.length,
    totalDurationMs: Number(durations.reduce((total, value) => total + value, 0).toFixed(2)),
    maxDurationMs: Number(Math.max(0, ...durations).toFixed(2)),
  };
}

function summarizeNetwork(requests) {
  const completed = [...requests.values()].filter((request) => request.finished);
  const chunkRequests = completed.filter((request) => chunkPattern.test(request.url));
  const distinctChunkUrls = new Set(chunkRequests.map((request) => request.url));
  const circChunkUrls = new Set(chunkRequests.filter((request) => request.url.includes("/circ2019/chunks/")).map((request) => request.url));
  const duplicates = [...distinctChunkUrls].flatMap((url) => {
    const count = chunkRequests.filter((request) => request.url === url).length;
    return count > 1 ? [{ url, count }] : [];
  });
  return {
    requestCount: completed.length,
    transferredBytes: Math.round(completed.reduce((total, request) => total + request.encodedDataLength, 0)),
    corpusJsonTransferredBytes: Math.round(completed.filter((request) => request.url.includes("/data/codes/")).reduce((total, request) => total + request.encodedDataLength, 0)),
    chunkRequestCount: chunkRequests.length,
    distinctChunkCount: distinctChunkUrls.size,
    chunkTransferredBytes: Math.round(chunkRequests.reduce((total, request) => total + request.encodedDataLength, 0)),
    circChunkCount: circChunkUrls.size,
    duplicateChunkRequests: duplicates,
  };
}

const measurementExpression = `async () => {
  const root = document.querySelector('.scv-text-pane');
  if (!root) throw new Error('Pannello documento non disponibile');
  const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
  const expectedScrollTop = (target) => Math.min(root.scrollHeight - root.clientHeight, Math.max(0, target.offsetTop - 14));
  const reached = (target) => Math.abs(root.scrollTop - expectedScrollTop(target)) <= 1;
  const timeClick = async (button) => {
    const id = button.dataset.indexUnit;
    window.__scvLongTasks.length = 0;
    const start = performance.now();
    button.click();
    let target = null;
    let reachedAt = null;
    while (performance.now() - start < 30000) {
      await frame();
      target = document.querySelector('[data-scv-text-unit="' + CSS.escape(id) + '"]');
      if (target && reached(target)) {
        reachedAt = performance.now();
        break;
      }
    }
    await frame();
    return {
      targetUnitId: id,
      durationMs: Number(((reachedAt || performance.now()) - start).toFixed(2)),
      reached: reachedAt !== null,
      longTasks: window.__scvLongTasks.slice(),
    };
  };
  const buttons = [...document.querySelectorAll('[data-index-unit]')];
  const mountedButton = buttons.find((button) => document.querySelector('[data-scv-text-unit="' + CSS.escape(button.dataset.indexUnit) + '"]'));
  if (!mountedButton) throw new Error('Nessun target indice montato');
  const mountedTarget = document.querySelector('[data-scv-text-unit="' + CSS.escape(mountedButton.dataset.indexUnit) + '"]');
  const mountedExpected = expectedScrollTop(mountedTarget);
  root.scrollTop = mountedExpected > root.scrollHeight / 2 ? 0 : root.scrollHeight;
  await frame();
  const mountedClick = await timeClick(mountedButton);
  const chapterButtons = [...document.querySelectorAll('.scv-index-cell:first-child [data-index-unit]')];
  const unloadedButton = [...chapterButtons].reverse().find((button) => !document.querySelector('[data-scv-text-unit="' + CSS.escape(button.dataset.indexUnit) + '"]'));
  const unloadedClick = unloadedButton ? await timeClick(unloadedButton) : null;
  window.__scvLongTasks.length = 0;
  const scrollStart = performance.now();
  for (let step = 0; step < 120; step += 1) {
    root.scrollTop += Math.max(24, root.clientHeight / 18);
    await frame();
  }
  return {
    mountedClick,
    unloadedClick,
    scroll: {
      durationMs: Number((performance.now() - scrollStart).toFixed(2)),
      frames: 120,
      longTasks: window.__scvLongTasks.slice(),
    },
  };
}`;

async function measureMode(client, baseUrl, mode) {
  const { browserContextId } = await client.send("Target.createBrowserContext", { disposeOnDetach: true });
  const { targetId } = await client.send("Target.createTarget", { url: "about:blank", browserContextId });
  const { sessionId } = await client.send("Target.attachToTarget", { targetId, flatten: true });
  const network = { inflight: 0, lastActivity: performance.now(), requests: new Map() };
  const off = [
    client.on(sessionId, "Network.requestWillBeSent", (event) => {
      network.lastActivity = performance.now();
      if (!network.requests.has(event.requestId)) network.inflight += 1;
      network.requests.set(event.requestId, { url: event.request.url, type: event.type, encodedDataLength: 0, finished: false });
    }),
    client.on(sessionId, "Network.loadingFinished", (event) => {
      network.lastActivity = performance.now();
      const request = network.requests.get(event.requestId);
      if (request && !request.finished) {
        request.finished = true;
        request.encodedDataLength = event.encodedDataLength || 0;
        network.inflight = Math.max(0, network.inflight - 1);
      }
    }),
    client.on(sessionId, "Network.loadingFailed", (event) => {
      network.lastActivity = performance.now();
      const request = network.requests.get(event.requestId);
      if (request && !request.finished) {
        request.finished = true;
        request.failed = true;
        network.inflight = Math.max(0, network.inflight - 1);
      }
    }),
  ];
  try {
    await Promise.all([
      client.send("Page.enable", {}, sessionId),
      client.send("Runtime.enable", {}, sessionId),
      client.send("Network.enable", {}, sessionId),
    ]);
    await client.send("Network.setCacheDisabled", { cacheDisabled: true }, sessionId);
    await client.send("Network.clearBrowserCache", {}, sessionId);
    await client.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: fast4g.latencyMs,
      downloadThroughput: fast4g.downloadBytesPerSecond,
      uploadThroughput: fast4g.uploadBytesPerSecond,
      connectionType: "cellular4g",
      packetLoss: fast4g.packetLossPercent,
    }, sessionId);
    await client.send("Page.addScriptToEvaluateOnNewDocument", { source: `
      window.__scvLongTasks = [];
      window.__scvLongTaskSupported = PerformanceObserver.supportedEntryTypes.includes('longtask');
      if (window.__scvLongTaskSupported) {
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) window.__scvLongTasks.push({ startTime: entry.startTime, duration: entry.duration });
        }).observe({ type: 'longtask', buffered: true });
      }
    ` }, sessionId);
    const url = `${baseUrl}/?mode=${mode}`;
    await client.send("Page.navigate", { url }, sessionId);
    await waitForCondition(client, sessionId, "Boolean(document.querySelector('.scv-root[data-scv-mounted-chunks] [data-scv-text-unit]'))");
    await waitForNetworkQuiet(network);
    const initialNetwork = summarizeNetwork(network.requests);
    const initialDom = await evaluate(client, sessionId, `(() => {
      const root = document.querySelector('.scv-root');
      return {
        mountedChunkCount: Number(root?.dataset.scvMountedChunks || 0),
        loadedRelatedChunkCount: Number(root?.dataset.scvLoadedRelatedChunks || 0),
        longTaskSupported: Boolean(window.__scvLongTaskSupported),
      };
    })()`);
    const interactions = await evaluate(client, sessionId, `(${measurementExpression})()`);
    const mountedClickLongTasks = summarizeLongTasks(interactions.mountedClick.longTasks);
    const unloadedClickLongTasks = interactions.unloadedClick ? summarizeLongTasks(interactions.unloadedClick.longTasks) : null;
    const scrollLongTasks = summarizeLongTasks(interactions.scroll.longTasks);
    return {
      mode,
      url,
      cache: "cold; isolated browser context; HTTP cache disabled",
      initialLoad: { ...initialNetwork, ...initialDom },
      interactions: {
        clickMountedTarget: {
          targetUnitId: interactions.mountedClick.targetUnitId,
          durationMs: interactions.mountedClick.durationMs,
          reached: interactions.mountedClick.reached,
          longTasks: mountedClickLongTasks,
        },
        clickUnloadedTarget: interactions.unloadedClick ? {
          targetUnitId: interactions.unloadedClick.targetUnitId,
          durationMs: interactions.unloadedClick.durationMs,
          reached: interactions.unloadedClick.reached,
          longTasks: unloadedClickLongTasks,
        } : null,
        continuousScroll: {
          durationMs: interactions.scroll.durationMs,
          frames: interactions.scroll.frames,
          longTasks: scrollLongTasks,
        },
      },
      anomalies: [
        ...(!initialDom.longTaskSupported ? ["Long Tasks API non supportata dal browser"] : []),
        ...(initialNetwork.duplicateChunkRequests.length ? [`${initialNetwork.duplicateChunkRequests.length} URL chunk richiesti più volte`] : []),
        ...(!interactions.mountedClick.reached ? ["Il click verso il target montato non ha raggiunto la posizione attesa"] : []),
        ...(interactions.unloadedClick && !interactions.unloadedClick.reached ? ["Il click verso il target non montato non ha raggiunto la posizione attesa"] : []),
        ...(mountedClickLongTasks.count ? [`${mountedClickLongTasks.count} Long Task durante il click verso un target montato`] : []),
        ...(unloadedClickLongTasks?.count ? [`${unloadedClickLongTasks.count} Long Task durante il click verso un target non montato`] : []),
        ...(scrollLongTasks.count ? [`${scrollLongTasks.count} Long Task durante lo scroll continuo`] : []),
      ],
    };
  } finally {
    off.forEach((remove) => remove());
    await client.send("Target.disposeBrowserContext", { browserContextId }).catch(() => undefined);
  }
}

async function main() {
  const startedAt = new Date().toISOString();
  const server = await startProductionServer();
  let browser;
  try {
    browser = await launchBrowser();
    const browserVersion = await browser.client.send("Browser.getVersion");
    const scenarios = [];
    for (const mode of modes) scenarios.push(await measureMode(browser.client, server.baseUrl, mode));
    const report = {
      schemaVersion: 1,
      generatedAt: startedAt,
      environment: {
        os: `${platform()} ${release()}`,
        cpu: cpus()[0]?.model || "unknown",
        logicalCpuCount: cpus().length,
        totalMemoryBytes: totalmem(),
        freeMemoryBytesAtStart: freemem(),
        node: process.version,
        browser: browserVersion.product,
        userAgent: browserVersion.userAgent,
        executablePath: browser.executablePath,
        viewport: { width: 1440, height: 1000, deviceScaleFactor: 1 },
        server: "vinext production build",
        baseUrl: server.baseUrl,
        network: fast4g,
        cpuThrottlingRate: 1,
      },
      methodology: {
        runsPerScenario: 1,
        initialLoadBoundary: "viewer ready followed by 1500 ms with no in-flight network requests",
        transferredBytesSource: "Chrome DevTools Protocol Network.loadingFinished.encodedDataLength",
        clickBoundary: "HTMLElement.click() to first requestAnimationFrame where scrollTop reaches clamp(target.offsetTop - 14 px) (±1 px)",
        scrollBoundary: "120 requestAnimationFrame steps in the document pane",
        longTaskThresholdMs: 50,
      },
      scenarios,
    };
    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    process.stderr.write(`Baseline scritta in ${outputPath}\n`);
  } finally {
    browser?.client.close();
    browser?.processHandle.kill();
    server.processHandle?.kill();
    const profileRelativePath = browser?.profilePath ? path.relative(path.resolve(tmpdir()), path.resolve(browser.profilePath)) : null;
    if (profileRelativePath && !profileRelativePath.startsWith("..") && !path.isAbsolute(profileRelativePath) && path.basename(browser.profilePath).startsWith("scv-performance-")) {
      await delay(250);
      await rm(browser.profilePath, { recursive: true, force: true }).catch(() => undefined);
    }
  }
}

await main();
