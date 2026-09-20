# ChatNTC — STEP 2: DeepSeek e pipeline locale

Lo [STEP 5 e l'aggiunta OpenRouter](chatntc-byok.md) estendono questa pipeline a
cinque provider e BYOK tramite header locali dedicati. OpenRouter accetta ID
manuali senza allowlist, usa prompt-json e la validazione condivisa; il default
`openrouter/auto` può comportare costi. Qui sotto resta documentata la versione
originaria, non la configurazione multi-provider corrente.

Lo [STEP 4](chatntc-history.md) aggiunge `generation.model` ed
`evidence.structuralCodesVersion` ai metadati HTTP per identificare le risposte
storiche. La persistenza resta esclusivamente nel browser dietro ChatHistoryStore.

Lo [STEP 3](chatntc-ui.md) aggiunge una UI standalone opt-in e il campo `context`
facoltativo alla richiesta. Il contratto e le limitazioni qui sotto documentano
la pipeline server originaria; nessuna persistenza viene aggiunta dallo STEP 3.

Lo STEP 2 aggiunge un provider AI e una route server-side senza UI ChatNTC,
persistenza delle conversazioni, altri provider, web search o integrazioni
esterne specifiche.
Il corpus e i generatori editoriali rimangono invariati.

## Architettura

```text
POST /api/chatntc
  → gate locale/debug e validazione input
  → createLocalArtifactRepository
      → createArtifactRepository dello STEP 1
          → stessi indici, motore di ricerca e rimandi del viewer
  → retrieveChatNTCEvidence (domanda + soli messaggi USER recenti)
  → nessun contenuto primario utilizzabile? astensione deterministica
  → altrimenti ChatNTCProvider.generate
      → DeepSeekAdapter (server-only, fetch HTTP)
  → validateChatNTCResponse (anche per le astensioni)
  → al massimo un evidence-expansion/repair retry per errori riparabili
  → risposta strutturata e citazioni validate, oppure errore sanitizzato
```

### Confini fra moduli

- `viewer/shared/chatntc/provider.ts`: contratto generico `ChatNTCProvider`
  (`id`, `capabilities`, `generate`) e input con messaggi, evidence, direttive,
  schema e segnale di cancellazione. Nessuna credenziale o tipo SDK nel core.
- `directives.ts`: istruzioni normative centralizzate e indipendenti dal
  provider, collegate alla policy epistemica dello STEP 1.
- `responseContract.ts`: schema JSON e controllo strutturale runtime condiviso
  da adapter e Citation Validator. Quest'ultimo conserva i controlli di
  integrità, provenienza e copertura delle citazioni.
- `viewer/server/chatntc/deepseek.ts`: unico adapter AI implementato, con marker
  `server-only`. Riceve la configurazione dal confine server `config.ts`.
- `pipeline.ts`: orchestrazione generica; riceve una factory provider e un
  repository. Conserva il pacchetto originale dell'applicazione e ne passa una
  copia al provider. Nessuna dipendenza diretta dall'adapter DeepSeek.
- `localRepository.ts`: lettura degli artefatti da filesystem, con cache per
  richiesta e controllo dei percorsi. Riusa l'adapter dello STEP 1; non ricrea
  search index o relazioni. Non usa l'origin HTTP per caricare il corpus.
- `routeHandler.ts`: limiti HTTP, gate locale/debug, mapping degli errori.
- `viewer/app/api/chatntc/route.ts`: composizione sottile della route Node.

Il codice server non è incluso negli entry point del package shared né nei
bundle browser. La sola dipendenza aggiunta è il marker `server-only`; non sono
installati SDK AI. Per aggiungere un altro provider sarà sufficiente un adapter
server che implementi il contratto e una nuova scelta in `configuredProvider`:
retrieval, evidence e Citation Validator rimarranno indipendenti.

## Documentazione DeepSeek verificata

Verifica effettuata il **15 settembre 2026** su fonti ufficiali:

- [Modelli correnti](https://api-docs.deepseek.com/quick_start/pricing/): default
  `deepseek-flash`; configurabile anche `deepseek-v4-pro`. Il nome del modello
  viene controllato tramite allowlist, evitando vecchi alias ricordati a memoria.
- [Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion/):
  `POST https://api.deepseek.com/chat/completions`, autenticazione Bearer,
  `messages`, risposta in `choices[0].message.content`.
- [JSON Output](https://api-docs.deepseek.com/guides/json_mode/):
  `response_format: {"type":"json_object"}` e istruzioni/esempio JSON nel
  messaggio system. JSON Output non sostituisce la validazione applicativa.
- [Thinking Mode](https://api-docs.deepseek.com/guides/thinking_mode/):
  impostazione esplicita `thinking: {"type":"disabled"}` per questo adapter.

La richiesta usa `stream: false`, `max_tokens: 8192`, `temperature: 0`; non
invia tool o ricerca esterna. Lo schema viene fornito nel system message:
non viene assunto supporto a `response_format: json_schema` su questo endpoint.
La risposta deve avere `finish_reason: stop`; output vuoti, troncati, tool call
e formati inattesi sono errori. Non si inoltra `reasoning_content` al client.
Il basso valore di temperature non garantisce determinismo della generazione.

## Configurazione ambiente

Il file di esempio è `viewer/.env.example`, senza segreti. Copiarlo manualmente
in `viewer/.env.local` oppure impostare le variabili nell'ambiente del processo:

```dotenv
CHATNTC_ENABLED=true
CHATNTC_PROVIDER=deepseek
CHATNTC_DEEPSEEK_API_KEY=<chiave da impostare soltanto sul server>
CHATNTC_DEEPSEEK_MODEL=deepseek-flash
CHATNTC_DEEPSEEK_TIMEOUT_MS=60000
CHATNTC_DEBUG=false
```

- `CHATNTC_ENABLED=true` è sempre necessario, anche in sviluppo.
- Il runtime deve essere `development`/`test`, oppure avere
  `CHATNTC_DEBUG=true` per il debug locale di un build di produzione.
- La chiave proviene esclusivamente da `CHATNTC_DEEPSEEK_API_KEY`; nessun campo
  del body o header del client può configurarla. Non usare prefissi
  `NEXT_PUBLIC_` o `VITE_` per segreti.
- Il timeout predefinito è 60 secondi; sono ammessi interi positivi fino a
  120.000 ms. Copre fetch e lettura del body del provider.
- L'endpoint DeepSeek è fisso; non è configurabile dal client o mediante URL
  arbitrari. I redirect HTTP del provider sono rifiutati.
- Vinext carica le variabili server da `.env.local` secondo la precedenza Next
  già implementata nel progetto. I file `.env` reali sono ignorati da Git.

Avviare dalla root con `npm run viewer:dev`; il comando porta il working
directory in `viewer` e rigenera gli artefatti. La route legge
`viewer/public/data/codes`, senza scaricare o ritrascrivere i PDF.
L'istanza locale deve restare in ascolto su loopback: Vinext usa `localhost`
come default. Il gate debug non è un sistema di autenticazione per deployment
pubblici o reverse proxy; quei deployment devono lasciare ChatNTC disabilitato.

## Contratto HTTP locale v1

### Richiesta

```http
POST /api/chatntc
Content-Type: application/json
```

```json
{
  "question": "7.3.6.1",
  "history": [
    {"role": "user", "content": "Contesto della domanda precedente."},
    {"role": "assistant", "content": "Risposta precedente, non fonte normativa."}
  ]
}
```

`history` è opzionale. Sono ammesse al massimo 3 coppie user/assistant
complete, 2.000 caratteri per messaggio e 8.000 complessivi. La domanda può
contenere fino a 4.000 caratteri; il body è limitato a 65.536 byte effettivamente
letti. Non sono accettati ruoli system/tool, chiavi, modelli, endpoint o altri
campi aggiuntivi. Il timeout di lettura del body è 5 secondi.

Lo storico è inviato al modello come contesto transitorio, non viene salvato e
non è evidence normativa. Il retrieval usa la domanda corrente: la riscrittura
automatica dei follow-up ambigui non è implementata. Servono domande con un
argomento o riferimento sufficiente a effettuare il retrieval.

Sono ammessi `localhost`, `127.0.0.1` e `::1`; un `Origin` presente deve
corrispondere all'origin della richiesta. Le richieste browser cross-site
vengono rifiutate. Non viene abilitato CORS per siti esterni.

Esempio senza UI e senza chiave nel comando HTTP:

```sh
curl http://localhost:3000/api/chatntc \
  -H "Content-Type: application/json" \
  -d '{"question":"7.3.6.1"}'
```

Questo comando, dopo la configurazione, effettua una chiamata reale e può
consumare credito DeepSeek. I test del repository usano invece mock.

### Risposta 200

```ts
{
  ok: true;
  response: ChatNTCResponse;          // answerMarkdown + riferimenti v3
  citations: ChatNTCVerifiedReference[]; // risolti post-hoc sul repository
  evidence: {
    packageId: string;
    corpusFingerprint: string;
    artifactFingerprint: string;
    policyVersion: string;
    reduced: boolean;
    warnings: ChatNTCWarning[];
  };
  generation: {
    provider: string | null;
    outcome: "generated" | "abstained";
  };
  validation: {
    valid: true;
    scope: "integrity-provenance-reference-resolution";
    stage: ChatNTCProcessingStage;
  };
}
```

Entrambi i percorsi, generazione e astensione, passano nella validazione di
integrità e risoluzione canonica.
Il successo non certifica che le citazioni dimostrino semanticamente ogni frase
né sostituisce la review umana del corpus.

Se manca contenuto primario utilizzabile (non solo heading o metadati figura),
la pipeline restituisce un'astensione validata con `no-direct-reference`,
`needsMoreEvidence: true`, nessuna citazione e `provider: null`. Non configura
né chiama DeepSeek, quindi questo caso funziona anche senza API key.
I warning su omissioni, review pendenti e issue rimangono esposti; non vengono
automaticamente trattati come contenuti approvati o rimossi dal corpus e la UI
li mostra separatamente dalla prosa tecnica.

### Degradazione dei riferimenti ed errori

Problemi di risoluzione, canonicalizzazione o bookkeeping non producono una
risposta HTTP di errore. La pipeline risolve i target reali anche fuori dal
retrieval, tenta un solo repair per riferimenti falsi/ambigui e infine rimuove
localmente le sole attribuzioni non verificabili. `referenceWarning` segnala
`some-references-omitted` oppure `no-references-verified`; diagnostica e stage
restano nei metadati tecnici e non vengono mostrati come errore all'utente.

| HTTP | Codici principali |
| --- | --- |
| 400 | `INVALID_REQUEST` |
| 403 | `LOCAL_ONLY`, `ORIGIN_NOT_ALLOWED` |
| 404 | `CHATNTC_DISABLED` |
| 408 | `REQUEST_TIMEOUT`, `REQUEST_ABORTED` |
| 413 | `REQUEST_TOO_LARGE` |
| 415 | `UNSUPPORTED_MEDIA_TYPE` |
| 503 | `PROVIDER_NOT_CONFIGURED`, `API_KEY_MISSING`, `INVALID_PROVIDER_CONFIG` |
| 504 | `PROVIDER_TIMEOUT` |
| 502 | `PROVIDER_ERROR`, `INVALID_PROVIDER_RESPONSE`, `INVALID_PROVIDER_JSON`, `INVALID_RESPONSE_SCHEMA` |
| 500 | `RETRIEVAL_FAILED`, `VALIDATION_FAILED`, `INTERNAL_ERROR` |

Gli errori pubblici sono ricostruiti da un elenco fisso: nessun body upstream,
header, stack, messaggio arbitrario o output non validato viene restituito.
Non vengono loggati prompt, risposte, storico o credenziali. Le risposte HTTP
hanno `Cache-Control: no-store`. La chiave è conservata in un campo privato
dell'adapter, esclusa da system/messages/evidence e dai metadati del risultato.
Un eventuale riflesso della chiave nel risultato upstream viene respinto.
È implementato un solo repair mirato dei riferimenti; non sono effettuati retry
HTTP automatici del provider.

## Test e gate

```sh
npm --prefix viewer run test:chatntc
npm --prefix viewer run test:chatntc-server
npm run check
npm run viewer:test
npm --prefix viewer run typecheck
npm --prefix viewer run lint
```

La suite server usa artifact repository locale, provider/mock fetch e una
chiave sintetica. La suite route importa il build Vinext reale e intercetta
fetch: verifica generazione, blocco delle hallucination, astensione e gate
di produzione. Nessun test chiama realmente DeepSeek. I test controllano anche
l'assenza dell'adapter e della configurazione segreta nei bundle browser/shared.

`tsconfig.chatntc-test.json` compila solo la catena server e le sue dipendenze in
`.chatntc-test/`, ignorata da Git. I test server vengono eseguiti separatamente
con la condizione `react-server`, conservando il comportamento effettivo del
marker `server-only` senza disattivarlo per la UI.

## Rimane per lo STEP 3

La route è pronta per un futuro consumer UI che invii domanda e contesto minimo,
mostri citazioni validate, warning e astensioni, e gestisca gli errori distinti.
La UI principale rimane invariata. Non sono stati avviati UI chat, cronologia,
BYOK, streaming, altri provider, web search o integrazioni esterne specifiche.
Non è stata eseguita una
prova reale con credenziali DeepSeek; il trasporto è verificato tramite mock
sul contratto documentato.
