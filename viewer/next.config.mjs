/** @type {import("next").NextConfig} */
const config = process.env.CHATNTC_STANDALONE === "true"
  ? { output: "standalone" }
  : {};

export default config;
