import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const viewerRoot = new URL("../", import.meta.url);
const repositoryRoot = new URL("../../", import.meta.url);
const viewerDirectory = decodeURIComponent(viewerRoot.pathname).replace(/^\//u, "").replaceAll("/", "\\");
const repositoryDirectory = decodeURIComponent(repositoryRoot.pathname).replace(/^\//u, "").replaceAll("/", "\\");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const temporaryRoot = await mkdtemp(join(tmpdir(), "structural-codes-viewer-consumer-"));

function npm(args, cwd) {
  const npmExecPath = process.env.npm_execpath;
  const result = spawnSync(npmExecPath ? process.execPath : npmCommand, npmExecPath ? [npmExecPath, ...args] : args,
    { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    if (result.stdout) process.stderr.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    throw new Error(`npm ${args.join(" ")} ha restituito ${result.status}`);
  }
  return result.stdout;
}

try {
  npm(["run", "build:library"], viewerDirectory);
  const viewerPack = JSON.parse(npm(["pack", "--json", "--pack-destination", temporaryRoot], viewerDirectory))[0].filename;
  const corePack = JSON.parse(npm(["pack", "--json", "--pack-destination", temporaryRoot], repositoryDirectory))[0].filename;
  const consumer = join(temporaryRoot, "consumer");
  await mkdir(join(consumer, "app"), { recursive: true });
  await writeFile(join(consumer, "package.json"), JSON.stringify({
    name: "scv-clean-consumer",
    private: true,
    scripts: { build: "next build" },
    dependencies: {
      "structural-codes": `file:${join(temporaryRoot, corePack)}`,
      "structural-codes-viewer": `file:${join(temporaryRoot, viewerPack)}`,
      next: "16.3.2",
      react: "19.2.8",
      "react-dom": "19.2.8",
    },
    devDependencies: { typescript: "5.9.3", "@types/node": "22.19.19", "@types/react": "19.2.14", "@types/react-dom": "19.2.3" },
  }, null, 2));
  await writeFile(join(consumer, "app", "layout.tsx"), `import "structural-codes-viewer/styles.css";\nexport default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="it"><body>{children}</body></html>; }\n`);
  await writeFile(join(consumer, "app", "chat-client.tsx"), `"use client";
import { ChatNTCPanel, ChatTransportError, type ChatResult, type ChatTransport } from "structural-codes-viewer/chatntc-ui";
import { IndexedDbChatHistoryStore, type ChatHistoryStore } from "structural-codes-viewer/chatntc-history";
const transport = { capabilities: { cancellation: true, streaming: false }, async send(): Promise<ChatResult> { throw new ChatTransportError("NOT_CONFIGURED", "Consumer fixture"); } } satisfies ChatTransport;
export function PublicChatApiSmoke() { const store: ChatHistoryStore = new IndexedDbChatHistoryStore({ name: "consumer-smoke" }); void store; return <ChatNTCPanel transport={transport} onNavigate={() => {}} hrefForTarget={() => "#"} />; }
`);
  await writeFile(join(consumer, "app", "page.tsx"), `import { NormativeViewer } from "structural-codes-viewer";
import { CHATNTC_DEFAULT_RETRIEVAL } from "structural-codes-viewer/chatntc";
import { createViewerArtifactRepository } from "structural-codes-viewer/chatntc/viewer-artifacts";
import { PublicChatApiSmoke } from "./chat-client";
export default function Page() { void CHATNTC_DEFAULT_RETRIEVAL; void createViewerArtifactRepository; return <><NormativeViewer defaultMode="combined" dataBaseUrl="/data/codes" /><PublicChatApiSmoke /></>; }
`);
  await writeFile(join(consumer, "tsconfig.json"), JSON.stringify({ compilerOptions: { strict: true, jsx: "preserve", module: "esnext", moduleResolution: "bundler", noEmit: true, allowJs: false }, include: ["**/*.ts", "**/*.tsx"] }, null, 2));
  await writeFile(join(consumer, "next.config.mjs"), "export default {};\n");
  npm(["install", "--ignore-scripts", "--no-audit", "--no-fund"], consumer);
  npm(["run", "build"], consumer);
  await writeFile(join(consumer, "consumer.mjs"), `
import assert from "node:assert/strict";
import { CHATNTC_DEFAULT_RETRIEVAL } from "structural-codes-viewer/chatntc";
import { createViewerArtifactRepository } from "structural-codes-viewer/chatntc/viewer-artifacts";
import { ChatTransportError } from "structural-codes-viewer/chatntc-ui";
import { IndexedDbChatHistoryStore } from "structural-codes-viewer/chatntc-history";
assert.equal(typeof CHATNTC_DEFAULT_RETRIEVAL.maxPrimaryUnits, "number");
assert.equal(typeof createViewerArtifactRepository, "function");
assert.equal(new ChatTransportError("fixture", "fixture").code, "fixture");
assert.equal(typeof new IndexedDbChatHistoryStore().listConversations, "function");
`);
  const runtime = spawnSync(process.execPath, ["consumer.mjs"], { cwd: consumer, encoding: "utf8", stdio: "inherit" });
  if (runtime.error) throw runtime.error;
  if (runtime.status !== 0) throw new Error(`consumer runtime ha restituito ${runtime.status}`);
  const installedPackage = JSON.parse(await readFile(join(consumer, "node_modules", "structural-codes-viewer", "package.json"), "utf8"));
  if (installedPackage.dependencies?.react || installedPackage.dependencies?.["react-dom"] || installedPackage.dependencies?.["pdfjs-dist"]) throw new Error("consumer ha ricevuto React o PDF runtime dal package viewer");
  console.log(JSON.stringify({ consumer, viewerPack, corePack, status: "ok", react: "peer", pdfjs: "absent from runtime dependencies" }, null, 2));
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
