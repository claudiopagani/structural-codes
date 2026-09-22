# ChatNTC production-like Docker stack

Questa composizione prepara il packaging riproducibile per un host OCFEM, senza
definire un deployment cloud. Il percorso production predefinito avvia soltanto
ChatNTC e usa:

```text
query → lexical retrieval → structural expansion
      → Evidence Package + hierarchy → LLM → Citation Validator
```

BGE-M3, indice semantic e RRF restano disponibili tramite il profilo Compose
`semantic` e una modalità `shadow` o `on` esplicita. I test end-to-end non hanno
mostrato un miglioramento qualitativo sufficientemente consistente da
giustificare BGE-M3/RRF come dipendenza production predefinita.

Solo ChatNTC pubblica una porta, limitata al loopback dell'host. Anche quando il
profilo semantic è attivo, il browser non raggiunge direttamente BGE-M3.

## Prerequisiti

### Production standard

- Docker Engine/Desktop con Docker Compose moderno;
- per risposte complete, le credenziali del provider generativo scelto.

Non servono GPU, modello embedding o indice semantic.

### Semantic sperimentale

Servono inoltre:

- NVIDIA Container Toolkit o GPU passthrough già verificato;
- una cache host contenente il modello BGE-M3, oppure una directory persistente
  nella quale il servizio possa installarlo;
- un indice FlagEmbedding validato contenente `index.json` e `vectors.f32`.

Il modello e l'indice non entrano nelle immagini. La procedura normale non li
scarica e non rigenera l'indice.

## Configurazione

Da PowerShell, nella radice del repository:

```powershell
Copy-Item deploy/chatntc/.env.production.example deploy/chatntc/.env.production
notepad deploy/chatntc/.env.production
```

Il file di esempio imposta:

```text
CHATNTC_SEMANTIC_MODE=off
```

Le credenziali generative restano nel file `.env.production` locale oppure nel
secret store dell'ambiente; non devono essere inserite nell'immagine.

Per `shadow` o `on`, impostare esplicitamente anche i path host assoluti:

```text
CHATNTC_SEMANTIC_MODE=on
BGE_MODEL_CACHE=/srv/ocfem/models/huggingface
CHATNTC_SEMANTIC_INDEX_HOST_PATH=/srv/ocfem/chatntc-semantic
```

Su Docker Desktop è valido anche un path Windows condiviso, per esempio
`D:/path/to/models/huggingface`. L'indice viene montato read-only come
`/app/data/chatntc-semantic`; la cache modello viene montata come
`/models/huggingface`.

Le altre variabili semantic rimangono configurabili:

```text
CHATNTC_EMBEDDING_PROVIDER=flagembedding-http
CHATNTC_EMBEDDING_URL=http://bge-m3-embedding:8000
CHATNTC_SEMANTIC_INDEX_PATH=/app/data/chatntc-semantic
CHATNTC_EMBEDDING_TIMEOUT_MS=120000
CHATNTC_EMBEDDING_BATCH_SIZE=32
```

Ollama è disponibile solo tramite selezione esplicita del provider; non è un
fallback automatico di FlagEmbedding.

## Production standard: build e avvio

```powershell
docker compose `
  --env-file deploy/chatntc/.env.production `
  -f deploy/chatntc/compose.yaml `
  config

docker compose `
  --env-file deploy/chatntc/.env.production `
  -f deploy/chatntc/compose.yaml `
  up -d
```

Senza override, il profilo `semantic` non è attivo: BGE-M3 non viene creato né
avviato. ChatNTC non attende il servizio embedding e `/api/health` restituisce
semantic `mode: off`, `ready: true`, `provider: null`. Il volume semantic vuoto
usato come fallback non viene letto dal runtime OFF.

Controlli operativi:

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/health | ConvertTo-Json -Depth 5
docker compose --env-file deploy/chatntc/.env.production -f deploy/chatntc/compose.yaml ps
```

## Semantic sperimentale

Dopo avere impostato `CHATNTC_SEMANTIC_MODE=on` oppure `shadow` e i due path
host nel file `.env.production`, avviare esplicitamente il profilo:

```powershell
docker compose `
  --profile semantic `
  --env-file deploy/chatntc/.env.production `
  -f deploy/chatntc/compose.yaml `
  up -d
```

La dipendenza Compose da BGE-M3 è opzionale per il profilo standard, ma quando
il servizio semantic è selezionato ChatNTC ne attende l'healthcheck. Il proprio
endpoint di readiness mantiene invariato il preflight esistente: connessione al
provider, metadata embedding, indice, fingerprint del corpus e inventario
unità. Un indice assente/incompatibile o un servizio irraggiungibile mantiene
ChatNTC unhealthy con un errore diagnostico esplicito.

Controllo aggiuntivo BGE-M3:

```powershell
docker compose --profile semantic --env-file deploy/chatntc/.env.production -f deploy/chatntc/compose.yaml exec bge-m3-embedding python -c "import json,urllib.request; print(json.dumps(json.load(urllib.request.urlopen('http://127.0.0.1:8000/health')), indent=2))"
```

Le righe server-side `[chatntc:semantic]` riportano soltanto stato, conteggi,
`rrfK`, ranking applicato e fallback; non includono il testo della query.

## Stop

Production standard:

```powershell
docker compose --env-file deploy/chatntc/.env.production -f deploy/chatntc/compose.yaml down
```

Se è stato usato il profilo semantic:

```powershell
docker compose --profile semantic --env-file deploy/chatntc/.env.production -f deploy/chatntc/compose.yaml down
```

Cache modello e indice bind-mounted non vengono rimossi da `down`.

## Aggiornare l'indice sperimentale

L'indice non viene generato allo startup e può essere sostituito senza rebuild
dell'immagine ChatNTC. La procedura resta intenzionalmente separata:

```text
corpus cambia
→ rigenerare l'indice semantic con il tooling versionato
→ validare metadata, fingerprint e vettori
→ distribuire insieme index.json + vectors.f32 nella directory host
→ riavviare/aggiornare chatntc
```

Questa procedura non fa parte dell'avvio production standard.

## Modalità d'uso

- **Production standard:** `off`; nessun provider embedding, indice, GPU o RRF.
- **Shadow sperimentale:** calcola semantic/RRF e diagnostica, ma conserva
  l'Evidence Package lexical.
- **ON sperimentale:** applica lexical + semantic + RRF prima
  dell'espansione strutturale.
- **Sviluppo semantic locale:** può usare `services/bge-m3-embedding/compose.yaml`
  e l'indice ignorato sotto `viewer/.local/`, come descritto nel README viewer.

Ingress pubblico, autenticazione, TLS, secret manager, registry, rollout e
configurazione cloud restano fuori scope. La route ChatNTC corrente è
deliberatamente local/debug-only e il bind host resta sul loopback.
