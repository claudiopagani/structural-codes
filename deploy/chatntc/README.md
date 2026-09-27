# Stack Docker ChatNTC self-hosted

Questa directory contiene un esempio riproducibile per eseguire viewer e
ChatNTC sulla propria macchina. La porta host è vincolata a `127.0.0.1`; lo
stack non è un servizio Internet e non aggiunge autenticazione o gestione
utenti.

Il percorso standard avvia solo `chatntc`:

```text
browser locale
  → viewer + route ChatNTC
  → lexical retrieval + structural expansion
  → Evidence Package → provider generativo → Citation Validator
```

Il profilo `semantic` aggiunge BGE-M3 in modo sperimentale. Non è necessario
per il normale funzionamento.

## Prerequisiti

- Docker Engine o Docker Desktop con Compose;
- spazio per build e corpus derivato;
- una API key del provider nell'environment locale oppure una chiave inserita
  dalla UI BYOK;
- solo per il profilo semantic: GPU NVIDIA/CUDA compatibile, cache modello e
  indice semantic già generato.

## Configurazione

Da PowerShell, nel root della repository:

```powershell
Copy-Item deploy/chatntc/.env.self-hosted.example deploy/chatntc/.env.self-hosted
notepad deploy/chatntc/.env.self-hosted
```

Il file reale è ignorato da Git. Il default è:

```dotenv
CHATNTC_SEMANTIC_MODE=off
CHATNTC_HOST_PORT=3000
```

Per usare una chiave server-side, impostare provider, chiave e modello nel
file. Per usare BYOK, lasciare vuota la chiave: l'utente potrà inserirla nella
UI e resterà solo nella memoria del browser.

## Build e avvio standard

```powershell
docker compose `
  --env-file deploy/chatntc/.env.self-hosted `
  -f deploy/chatntc/compose.yaml `
  build chatntc

docker compose `
  --env-file deploy/chatntc/.env.self-hosted `
  -f deploy/chatntc/compose.yaml `
  up -d chatntc
```

Aprire `http://127.0.0.1:3000`. Lo stato dei container è visibile con:

```powershell
docker compose --env-file deploy/chatntc/.env.self-hosted -f deploy/chatntc/compose.yaml ps
```

Il container usa un build standalone con `NODE_ENV=production` nel senso
tecnico di build ottimizzato. ChatNTC è abilitato esplicitamente da
`CHATNTC_ENABLED=true` nella composizione.

## Profilo semantic opzionale

Prima di avviarlo:

1. generare e validare l'indice con il tooling documentato in
   [`docs/chatntc-semantic-index.md`](../../docs/chatntc-semantic-index.md);
2. impostare `CHATNTC_SEMANTIC_MODE=shadow` oppure `on`;
3. impostare `BGE_MODEL_CACHE` e `CHATNTC_SEMANTIC_INDEX_HOST_PATH` a directory
   host persistenti;
4. verificare il passthrough GPU.

Avvio:

```powershell
docker compose `
  --profile semantic `
  --env-file deploy/chatntc/.env.self-hosted `
  -f deploy/chatntc/compose.yaml `
  up -d --build
```

`shadow` mantiene il ranking lessicale e registra solo diagnostiche aggregate.
`on` usa RRF quando il servizio semantic risponde con hit compatibili e
degrada al ranking lessicale in caso di risultato vuoto o errore runtime.

## Health check

```powershell
Invoke-RestMethod http://127.0.0.1:3000/api/health | ConvertTo-Json -Depth 6
```

Con il profilo semantic:

```powershell
docker compose --profile semantic --env-file deploy/chatntc/.env.self-hosted -f deploy/chatntc/compose.yaml exec bge-m3-embedding python -c "import json,urllib.request; print(json.dumps(json.load(urllib.request.urlopen('http://127.0.0.1:8000/health')), indent=2))"
```

## Stop

Percorso standard:

```powershell
docker compose --env-file deploy/chatntc/.env.self-hosted -f deploy/chatntc/compose.yaml down
```

Con profilo semantic:

```powershell
docker compose --profile semantic --env-file deploy/chatntc/.env.self-hosted -f deploy/chatntc/compose.yaml down
```

Cache del modello e indice sono esterni/read-only e non vengono rimossi dal
normale stop.

## Boundary di sicurezza

- porta host pubblicata soltanto su loopback;
- route stessa origine e rifiuto cross-site;
- limiti di body, domanda e history;
- timeout e risposta provider limitata;
- errori da allowlist;
- nessun log di prompt o API key;
- nessuna chiave nelle immagini o nei file versionati.

Se si decide di esporre lo stack oltre il loopback, sicurezza di rete, TLS e
controllo degli accessi diventano responsabilità dell'operatore e non sono
forniti da questo esempio.
