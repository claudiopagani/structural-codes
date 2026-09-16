import { build } from "vite";

// Bundle the real components for DOM interaction tests, without Next/RSC conditions.
await build({ configFile: false, publicDir: false, define: { "process.env.NODE_ENV": '"development"' },
  build: { ssr: "tests/chatntc-ui-entry.ts", outDir: ".chatntc-ui-test", emptyOutDir: true,
    rollupOptions: { output: { entryFileNames: "index.js" } } },
});
