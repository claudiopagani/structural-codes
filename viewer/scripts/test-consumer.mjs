import { execSync } from "node:child_process";
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
  return execSync(`${npmCommand} ${args.join(" ")}`, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
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
  await writeFile(join(consumer, "app", "page.tsx"), `import { NormativeViewer } from "structural-codes-viewer";\nexport default function Page() { return <NormativeViewer defaultMode="combined" dataBaseUrl="/data/codes" />; }\n`);
  await writeFile(join(consumer, "tsconfig.json"), JSON.stringify({ compilerOptions: { strict: true, jsx: "preserve", module: "esnext", moduleResolution: "bundler", noEmit: true, allowJs: false }, include: ["**/*.ts", "**/*.tsx"] }, null, 2));
  await writeFile(join(consumer, "next.config.mjs"), "export default {};\n");
  npm(["install", "--ignore-scripts", "--no-audit", "--no-fund"], consumer);
  npm(["run", "build"], consumer);
  const installedPackage = JSON.parse(await readFile(join(consumer, "node_modules", "structural-codes-viewer", "package.json"), "utf8"));
  if (installedPackage.dependencies?.react || installedPackage.dependencies?.["react-dom"] || installedPackage.dependencies?.["pdfjs-dist"]) throw new Error("consumer ha ricevuto React o PDF runtime dal package viewer");
  console.log(JSON.stringify({ consumer, viewerPack, corePack, status: "ok", react: "peer", pdfjs: "absent from runtime dependencies" }, null, 2));
} finally {
  await rm(temporaryRoot, { recursive: true, force: true });
}
