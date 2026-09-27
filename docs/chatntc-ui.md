# ChatNTC UI e API riusabili

La UI ChatNTC è divisa fra componenti pubblici riusabili e composizione
standalone del viewer. Il package non impone un provider né pubblica la route
server.

## API pubblica

```tsx
import {
  ChatNTCPanel,
  ChatNTCHistoryPanel,
  ChatTransportError,
  type ChatTransport,
} from "structural-codes-viewer/chatntc-ui";
import {
  IndexedDbChatHistoryStore,
  type ChatHistoryStore,
} from "structural-codes-viewer/chatntc-history";
```

`ChatTransport` è il boundary applicativo:

```ts
interface ChatTransport {
  readonly capabilities: {
    readonly cancellation: boolean;
    readonly streaming: false;
  };
  send(request: ChatRequest, options?: { signal?: AbortSignal }): Promise<ChatResult>;
}
```

Il consumer decide come implementarlo. `ChatResult` accetta soltanto una
risposta già validata dal server e include citazioni, fingerprint, provenance
di generazione e stato del Citation Validator.

## `ChatNTCPanel`

Il pannello gestisce:

- domanda, history recente e contesto corrente del viewer;
- annullamento della richiesta tramite `AbortSignal`;
- resa Markdown/KaTeX dei risultati;
- navigazione verso unità, blocchi o asset citati;
- classificazione, warning evidence e stato di validazione;
- callback controllate per persistenza o integrazione esterna.

Non conosce API key, provider environment, IndexedDB o route specifiche.

## `ChatNTCHistoryPanel`

Il pannello history dipende solo dal contratto `ChatHistoryStore`. Aggiunge
lista conversazioni, nuova chat, cambio conversazione, cancellazione e gestione
dei conflitti. `IndexedDbChatHistoryStore` è l'adapter browser incluso, ma un
consumer può fornirne un altro purché rispetti lo stesso contratto.

La history persistita è una fotografia storica: la UI confronta i fingerprint
con il corpus corrente e non la presenta come nuova evidence normativa.

## Composizione standalone

Il viewer standalone aggiunge, senza esportarli dal package:

- `LocalChatTransport`, che chiama `/api/chatntc` stessa origine;
- `LocalAIConfiguration`, vault in-memory per la chiave BYOK;
- `AISettings`, selezione provider/model e inserimento della chiave;
- `ViewerToolsDock`, che combina ChatNTC, history e PDF locale.

La configurazione viene montata solo su loopback. La chiave viene cancellata
allo smontaggio e al reload; solo provider e model possono essere ripristinati
da `localStorage`.

## Viewer senza ChatNTC

Se `CHATNTC_ENABLED` non è `true`, il viewer non monta transport, history o
impostazioni AI. `NormativeViewer` e tutti gli artefatti di consultazione
restano disponibili senza provider e senza chiavi.

## Packaging

Il tarball `structural-codes-viewer` include componenti shared, stili, tipi e
generatore artefatti. Esclude `viewer/app/`, `viewer/server/`, adapter provider,
configurazioni locali, test e output standalone. Il consumer test installa il
tarball in una nuova app e importa anche gli export ChatNTC pubblici.

## Test

```bash
npm --prefix viewer run test:chatntc-ui
npm --prefix viewer run test:consumer
npm --prefix viewer run pack:verify
```
