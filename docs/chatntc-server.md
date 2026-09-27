# ChatNTC self-hosted e boundary server

La versione pubblica esegue ChatNTC come componente self-hosted del viewer.
L'installazione controlla corpus, route e configurazione; il provider generativo
è un servizio esterno scelto dall'utente o configurato nell'environment locale.

```text
browser
  → POST /api/chatntc sul viewer self-hosted
  → retrieval locale/server-side
  → provider esterno configurato dall'utente o dal server
```

## Avvio locale

```bash
npm ci
npm run viewer:install
npm run dev
```

`npm run dev` sincronizza gli artefatti, imposta `CHATNTC_ENABLED=true` e
avvia il viewer su `127.0.0.1`. L'import o il render iniziale non inviano
richieste a un provider.

Per una build standalone è disponibile lo
[stack Docker self-hosted](../deploy/chatntc/README.md). Anche con
`NODE_ENV=production`, l'unico opt-in funzionale è
`CHATNTC_ENABLED=true`; `NODE_ENV` mantiene il normale significato tecnico del
build e non seleziona un'architettura diversa.

## Configurazione minima

```dotenv
CHATNTC_ENABLED=true
CHATNTC_PROVIDER=deepseek
CHATNTC_DEEPSEEK_API_KEY=<chiave locale>
CHATNTC_DEEPSEEK_MODEL=deepseek-flash
CHATNTC_TIMEOUT_MS=60000
CHATNTC_SEMANTIC_MODE=off
```

Le variabili complete e la precedenza BYOK sono descritte in
[chatntc-byok.md](chatntc-byok.md). Nessuna chiave è necessaria all'avvio se
l'utente la inserirà dalla UI.

## Contratto HTTP

La route accetta soltanto `POST` JSON con i campi chiusi:

```ts
interface ChatRequest {
  question: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  context?: {
    documentId: "ntc2018" | "circ2019";
    unitId: string;
    numbering: string;
    blockId?: string;
    assetId?: string;
  };
}
```

Limiti correnti:

| Vincolo | Limite |
| --- | ---: |
| body HTTP | 65.536 byte |
| domanda | 4.000 caratteri |
| history inviata al provider | 6 messaggi |
| singolo messaggio history | 2.000 caratteri |
| history complessiva | 8.000 caratteri |
| lettura body | 5 secondi |
| chiamata provider | 1–120 secondi, default 60 |
| risposta provider letta | 1 MiB |

La history HTTP deve alternare `user`/`assistant` e iniziare con `user`. I
campi inattesi, i ruoli di sistema e un contesto non risolvibile vengono
rifiutati.

## Loopback e origine

La composizione standalone pubblica su loopback. La route verifica:

- hostname `localhost`, `127.0.0.1` o `[::1]`;
- coerenza fra `Host` e URL della richiesta;
- `Origin` uguale all'origine della route, quando presente;
- assenza di `Sec-Fetch-Site: cross-site`;
- origine esplicita e corretta quando è presente una chiave BYOK.

La UI standalone applica lo stesso vincolo prima di mostrare le impostazioni
BYOK. Questi controlli proteggono una installazione locale; non costituiscono
autenticazione per esporre la route su Internet.

## Credenziali ed errori

Una chiave BYOK viaggia nell'header `x-chatntc-api-key`, abbinato a
`x-chatntc-provider` e `x-chatntc-model`. La chiave non entra nel JSON della
chat, nel retrieval, nell'Evidence Package, nella risposta o nella history.

Gli adapter conservano la chiave in un campo privato, non inoltrano messaggi
grezzi del provider e rifiutano una risposta che rifletta la credenziale. Gli
errori pubblici sono ricostruiti da una allowlist di codici e messaggi: body,
URL, header, cause e credenziali upstream non vengono esposti.

Il runtime non registra prompt o chiavi. La modalità semantic può emettere
solo diagnostiche aggregate di ranking, senza query o contenuto evidence.

## Cosa non fornisce

Il progetto non implementa un servizio SaaS: non include autenticazione,
billing, gestione quote, storage remoto della history o accesso pubblico alla
route. Chi modifica il vincolo loopback deve progettare e verificare
separatamente il proprio perimetro operativo.

## Verifica

```bash
npm --prefix viewer run test:chatntc-server
npm --prefix viewer run test:chatntc-ui
npm --prefix viewer run check
```
