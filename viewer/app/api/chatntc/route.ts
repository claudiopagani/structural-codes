import "server-only";
import { configuredProvider } from "../../../server/chatntc/config.js";
import { createLocalArtifactRepository } from "../../../server/chatntc/localRepository.js";
import { createChatNTCHandler } from "../../../server/chatntc/routeHandler.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handle = createChatNTCHandler({
  environment: () => process.env,
  repository: () => createLocalArtifactRepository(),
  provider: (env, selection, apiKey) => configuredProvider(env, fetch, selection, apiKey),
});

export async function POST(request: Request) {
  return handle(request);
}
