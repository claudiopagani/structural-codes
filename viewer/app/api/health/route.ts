import "server-only";
import { readChatNTCHealth } from "../../../server/chatntc/health.js";
import { chatNTCSemanticRuntime } from "../../../server/chatntc/runtimeDependencies.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const health = await readChatNTCHealth(chatNTCSemanticRuntime);
  return Response.json(health, {
    status: health.ready ? 200 : 503,
    headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" },
  });
}
