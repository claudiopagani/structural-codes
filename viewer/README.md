# structural-codes-viewer

`structural-codes-viewer` è il package React per consultare il corpus
`structural-codes`. La stessa directory contiene l'applicazione standalone e
la route ChatNTC self-hosted, che restano fuori dal tarball del package.

## Boundary

- `structural-codes`: corpus, schema, provenance e helper non React;
- `structural-codes-viewer`: componenti React, client lazy, generatore
  artefatti e API ChatNTC condivise;
- `viewer/app/` e `viewer/server/`: composizione standalone, route e adapter
  provider non pubblicati nel package.

React e ReactDOM sono peer dependency. Il package non dipende a runtime da
Next/Vinext, `pdfjs-dist`, BGE-M3, adapter provider o file `.local`.

## Viewer React

```tsx
import { NormativeViewer } from "structural-codes-viewer";
import "structural-codes-viewer/styles.css";

export function Normativa() {
  return <NormativeViewer defaultMode="combined" dataBaseUrl="/data/codes" />;
}
```

Props principali:

- `defaultMode`: `combined`, `ntc` o `circ`;
- `dataBaseUrl`: artefatti lazy, default `/data/codes`;
- `assetsBaseUrl`: figure, default `/assets`;
- `auxiliaryPanel`: pannello opzionale o render prop;
- `auxiliaryPanelDefaultVisible`, `auxiliaryPanelKeepMounted` e modalità
  consentite del pannello.

La vista combinata mantiene le NTC come struttura principale e inserisce la
Circolare solo tramite relazioni esplicite. Ricerca, chunk, relazioni, figure e
prefetch sono lazy; il package shared non importa PDF o route standalone.

## Artefatti

```bash
npm --prefix viewer run sync:corpus
```

Il comando genera sotto `viewer/public/data/codes/` manifest, indici documento,
chunk, relazioni, riferimenti e indice di ricerca. `viewer/public/` è ignorato
da Git e rigenerabile dal corpus canonico.

Un consumer può usare la CLI inclusa:

```bash
npx structural-codes-viewer --source structural-codes \
  --output public/data/codes --assets public/assets
```

Il package viewer non include il corpus completo: il generatore legge il
package `structural-codes` installato nel consumer.

## Export ChatNTC

```ts
import {
  CHATNTC_DEFAULT_RETRIEVAL,
  retrieveChatNTCEvidence,
  validateChatNTCResponse,
} from "structural-codes-viewer/chatntc";
import { createViewerArtifactRepository } from
  "structural-codes-viewer/chatntc/viewer-artifacts";
import { ChatNTCPanel, type ChatTransport } from
  "structural-codes-viewer/chatntc-ui";
import { IndexedDbChatHistoryStore, type ChatHistoryStore } from
  "structural-codes-viewer/chatntc-history";
```

Questi export sono shared/browser-safe. Route HTTP, provider secrets,
`LocalChatTransport`, `LocalAIConfiguration` e impostazioni standalone non
sono API del package.

## Standalone senza ChatNTC

```bash
npm ci
npm run sync:corpus
npm run dev
```

Il viewer funziona senza provider e senza ChatNTC. Il PDF ufficiale è un
ausilio locale/debug e non entra nel build pubblico o nel package.

## ChatNTC self-hosted

Dal root della repository:

```bash
npm run dev
```

Il launcher abilita ChatNTC e vincola il server a `127.0.0.1`. In alternativa,
copiando `viewer/.env.example` in `viewer/.env.local`, impostare:

```dotenv
CHATNTC_ENABLED=true
CHATNTC_PROVIDER=deepseek
CHATNTC_DEEPSEEK_API_KEY=
CHATNTC_SEMANTIC_MODE=off
```

La chiave può restare vuota se l'utente usa la UI BYOK. Le chiavi environment
rimangono server-side; quelle UI rimangono in memoria e viaggiano in un header
stessa origine, mai nel body o nella history.

Pipeline standard:

```text
query → lexical retrieval → structural expansion → Evidence Package
      → LLM → Citation Validator → risposta verificata
```

Dettagli: [overview](../docs/chatntc-core.md),
[self-hosting](../docs/chatntc-server.md),
[BYOK](../docs/chatntc-byok.md) e
[history](../docs/chatntc-history.md).

## Semantic retrieval sperimentale

`CHATNTC_SEMANTIC_MODE=off|shadow|on`; il default è `off`.

- `off`: percorso lessicale standard, nessun indice o embedding;
- `shadow`: calcolo semantic osservazionale, output lessicale invariato;
- `on`: ranking fuso RRF con fallback lessicale.

Gli adapter BGE-M3 HTTP e Ollama, i generatori indice e i benchmark sono
strumenti opt-in. BGE-M3 non è una dipendenza obbligatoria del viewer o di
ChatNTC. Vedere la
[documentazione semantic](../docs/chatntc-semantic-index.md).

## Sviluppo e verifica

```bash
npm ci
npm run lint
npm test
npm run check
npm run pack:verify
npm run test:consumer
```

`check` costruisce app e libreria ed esegue test viewer, ChatNTC, history,
semantic e boundary. `pack:verify` mostra il contenuto effettivo del tarball.
`test:consumer` crea tarball reali di entrambi i package, li installa in una
nuova app Next e verifica viewer, export ChatNTC runtime e tipi pubblici.

Il tarball deve contenere soltanto `package-dist/`, README, licenza, notice e
manifest. Sono vietati `app/`, `server/`, test, PDF, corpus completo, `.env`,
cache, indici semantic e output standalone.
