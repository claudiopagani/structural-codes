# ChatNTC production-like Docker stack (B6)

Questa composizione prepara il packaging riproducibile per un host OCFEM, senza
definire un deployment cloud. Avvia il server Vinext/ChatNTC e il microservizio
BGE-M3 sulla stessa rete Docker. Solo ChatNTC pubblica una porta, limitata al
loopback dell'host; il browser non può raggiungere direttamente BGE-M3.

```text
browser -> 127.0.0.1:3000 -> chatntc
                                  |
                                  | http://bge-m3-embedding:8000
                                  v
                             BGE-M3 (GPU)
```

## Prerequisiti

- Docker Engine/Desktop con Docker Compose moderno;
- NVIDIA Container Toolkit o GPU passthrough già verificato con
  `docker run --gpus all ...`;
- una directory host persistente e scrivibile per la cache Hugging Face;
- un indice FlagEmbedding validato contenente `index.json` e `vectors.f32`;
- per risposte ChatNTC complete, le credenziali del provider generativo scelto.

Il modello e l'indice non entrano nelle immagini. Il primo avvio può scaricare
`BAAI/bge-m3` nella cache host e richiedere diversi minuti; gli avvii successivi
riusano la stessa cache.

## Configurazione

Da PowerShell, nella radice del repository:

```powershell
Copy-Item deploy/chatntc/.env.production.example deploy/chatntc/.env.production
notepad deploy/chatntc/.env.production
```

Impostare almeno path host assoluti:

```text
BGE_MODEL_CACHE=/srv/ocfem/models/huggingface
CHATNTC_SEMANTIC_INDEX_HOST_PATH=/srv/ocfem/chatntc-semantic
```

Su Docker Desktop è valido anche un path Windows condiviso, per esempio
`D:/path/to/models/huggingface`. La directory indice viene montata read-only come
`/app/data/chatntc-semantic`; la cache modello viene montata come
`/models/huggingface`.

Il server riceve internamente questa configurazione fissa:

```text
CHATNTC_SEMANTIC_MODE=on
CHATNTC_EMBEDDING_PROVIDER=flagembedding-http
CHATNTC_EMBEDDING_URL=http://bge-m3-embedding:8000
CHATNTC_SEMANTIC_INDEX_PATH=/app/data/chatntc-semantic
CHATNTC_EMBEDDING_TIMEOUT_MS=120000
CHATNTC_EMBEDDING_BATCH_SIZE=32
```

Le credenziali generative restano nel file `.env.production` locale oppure nel
secret store del futuro ambiente; non devono essere inserite nell'immagine.

## Build e avvio

```powershell
docker compose --env-file deploy/chatntc/.env.production -f deploy/chatntc/compose.yaml config
docker compose --env-file deploy/chatntc/.env.production -f deploy/chatntc/compose.yaml build
docker compose --env-file deploy/chatntc/.env.production -f deploy/chatntc/compose.yaml up -d
```

`chatntc` attende che l'healthcheck BGE-M3 sia verde. Il proprio endpoint di
readiness esegue inoltre il preflight runtime già esistente: connessione al
provider, metadata embedding, indice, fingerprint del corpus e inventario
unità. Un indice assente/incompatibile o un servizio embedding irraggiungibile
mantiene ChatNTC unhealthy con un errore diagnostico esplicito.

Controlli operativi:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/health | ConvertTo-Json -Depth 5
docker compose --env-file deploy/chatntc/.env.production -f deploy/chatntc/compose.yaml exec bge-m3-embedding python -c "import json,urllib.request; print(json.dumps(json.load(urllib.request.urlopen('http://127.0.0.1:8000/health')), indent=2))"
docker compose --env-file deploy/chatntc/.env.production -f deploy/chatntc/compose.yaml ps
```

Le righe server-side `[chatntc:semantic]` riportano soltanto stato, conteggi,
`rrfK`, ranking applicato e fallback; non includono il testo della query. Una
failure embedding durante una query conserva il fallback lexical del
`retrievalCoordinator`. Non esiste fallback automatico a Ollama.

Stop e rimozione dei container:

```powershell
docker compose --env-file deploy/chatntc/.env.production -f deploy/chatntc/compose.yaml down
```

La cache modello e l'indice sono bind mount host e non vengono rimossi da
`down`.

## Aggiornare l'indice

L'indice non viene generato allo startup e può essere sostituito senza rebuild
dell'immagine ChatNTC. La procedura operativa è intenzionalmente separata:

```text
corpus cambia
-> rigenerare l'indice semantic con il tooling versionato
-> validare metadata, fingerprint e vettori
-> distribuire insieme index.json + vectors.f32 nella directory host
-> riavviare/aggiornare chatntc
```

Preparare i due file in una directory di staging, validarli, quindi sostituire
la directory/versione montata come singola release. Infine:

```powershell
docker compose --env-file deploy/chatntc/.env.production -f deploy/chatntc/compose.yaml restart chatntc
```

## Tre modalità d'uso

### Sviluppo normale

Usare i comandi viewer esistenti senza variabili semantic. Il default resta
`CHATNTC_SEMANTIC_MODE=off`: niente Docker, GPU, modello o indice.

### Sviluppo semantic locale

Usare `services/bge-m3-embedding/compose.yaml`, la porta locale
`127.0.0.1:8091` e l'indice sotto `viewer/.local/`, come descritto nel README
del viewer. Questo percorso resta distinto dallo stack B6.

### Stack production-like

Usare questa composizione. BGE-M3 è raggiungibile solo sulla rete Docker con
hostname `bge-m3-embedding`; ChatNTC è esposto soltanto su loopback. La route
ChatNTC corrente è deliberatamente local/debug-only, quindi questo stack usa
`CHATNTC_DEBUG=true` insieme al bind loopback.

### Deployment reale

Ingress pubblico, autenticazione, TLS, secret manager, registry, rollout e
configurazione cloud sono fuori scope di B6 e devono essere progettati prima di
esporre ChatNTC a utenti remoti.
