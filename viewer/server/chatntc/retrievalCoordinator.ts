import "server-only";
import {
  retrieveChatNTCEvidence,
  type ChatNTCEvidencePackage, type ChatNTCHit, type ChatNTCRepository, type ChatNTCRetrievalOptions,
} from "../../shared/chatntc/index.js";

export type ChatNTCSemanticRetrievalMode = "off" | "shadow" | "on";

export interface ChatNTCSemanticRetrievalInput {
  query: string;
  limit: number;
  document?: ChatNTCRetrievalOptions["document"];
  /** Legacy lexical candidates; the injected capability owns any future fusion. */
  lexicalHits: readonly ChatNTCHit[];
  signal?: AbortSignal;
}

/**
 * Optional server-side extension point. Implementations own semantic lookup and
 * rank fusion; ChatNTC core remains deterministic and model-agnostic.
 */
export interface ChatNTCSemanticRetriever {
  retrieve(input: ChatNTCSemanticRetrievalInput): Promise<readonly ChatNTCHit[]>;
}

export interface ChatNTCSemanticRetrievalConfiguration {
  mode: ChatNTCSemanticRetrievalMode;
  retriever?: ChatNTCSemanticRetriever;
}

/** Keep the legacy path literal for local/off and for every unconfigured mode. */
export async function retrieveChatNTCEvidenceForMode(
  repository: ChatNTCRepository,
  question: string,
  options: ChatNTCRetrievalOptions,
  configuration: ChatNTCSemanticRetrievalConfiguration = { mode: "off" },
  signal?: AbortSignal,
): Promise<ChatNTCEvidencePackage> {
  const retriever = configuration.retriever;
  if (configuration.mode === "off" || !retriever) return await retrieveChatNTCEvidence(repository, question, options);

  const candidateRepository: ChatNTCRepository = {
    identity: () => repository.identity(),
    resolveExact: (query, document) => repository.resolveExact(query, document),
    getUnit: (unitId) => repository.getUnit(unitId),
    related: (unitId) => repository.related(unitId),
    async search(query, limit, document) {
      const lexicalHits = await repository.search(query, limit, document);
      const semanticInput: ChatNTCSemanticRetrievalInput = {
        query, limit, lexicalHits, ...(document ? { document } : {}), ...(signal ? { signal } : {}),
      };
      if (configuration.mode === "shadow") {
        await Promise.resolve().then(() => retriever.retrieve(semanticInput)).catch(() => undefined);
        return lexicalHits;
      }
      return [...await retriever.retrieve(semanticInput)];
    },
  };
  return await retrieveChatNTCEvidence(candidateRepository, question, options);
}
