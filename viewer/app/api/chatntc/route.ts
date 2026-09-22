import "server-only";
import { configuredProvider } from "../../../server/chatntc/config.js";
import { createLocalArtifactRepository } from "../../../server/chatntc/localRepository.js";
import { createChatNTCHandler } from "../../../server/chatntc/routeHandler.js";
import { chatNTCSemanticRuntime } from "../../../server/chatntc/runtimeDependencies.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handle = createChatNTCHandler({
  environment: () => process.env,
  repository: () => createLocalArtifactRepository(),
  provider: (env, selection, apiKey) => configuredProvider(env, fetch, selection, apiKey),
  semanticRetrieval: chatNTCSemanticRuntime.mode === "off"
    ? chatNTCSemanticRuntime.configuration
    : () => chatNTCSemanticRuntime.initialize(),
});

export async function POST(request: Request) {
  return handle(request);
}
