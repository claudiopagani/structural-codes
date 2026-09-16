import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

// Explicit standalone BYOK launcher. Bind only to loopback; no AI request at startup.
const child = spawn(process.execPath, [fileURLToPath(new URL("../node_modules/vinext/dist/cli.js", import.meta.url)), "dev", "--hostname", "127.0.0.1"], {
  stdio: "inherit", env: { ...process.env, CHATNTC_ENABLED: "true" },
});
child.on("exit", (code) => { process.exitCode = code ?? 1; });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
