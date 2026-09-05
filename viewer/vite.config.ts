import vinext from "vinext";
import { defineConfig } from "vite";
// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

const directStylesheetInDev = {
  name: "structural-codes-direct-stylesheet-in-dev",
  apply: "serve" as const,
  configureServer(server: { middlewares: { use: (middleware: (request: { url?: string }, response: unknown, next: () => void) => void) => void } }) {
    server.middlewares.use((request, _response, next) => {
      if (request.url === "/shared/styles.css") request.url = "/shared/styles.css?direct";
      next();
    });
  },
};

export default defineConfig({
  server: isCodexSeatbeltSandbox
    ? { watch: { useFsEvents: false, usePolling: true } }
    : undefined,
  plugins: [vinext(), directStylesheetInDev],
});
