# BGE-M3 dense embedding service (STEP B1)

Microservizio HTTP locale e autonomo per dense embeddings con
`BAAI/bge-m3`, `FlagEmbedding` e GPU CUDA. Non è collegato a ChatNTC e non
modifica il semantic index.

Il modello viene caricato una sola volta per processo. Il servizio usa un solo
worker Uvicorn e serializza le inferenze GPU. Per `inputType: "query"` usa
`encode_queries`; per `inputType: "document"` usa `encode_corpus`. In entrambi
i casi richiede esclusivamente `dense_vecs`, normalizzati, con sparse e ColBERT
disabilitati.

## Prerequisiti

- Windows 11 con Docker Desktop e backend WSL2;
- Docker Compose 2.30 o successivo (`gpus: all`);
- GPU NVIDIA, driver host compatibile con CUDA 12.6 e passthrough GPU attivo;
- spazio libero nella directory cache esterna per il primo download di
  `BAAI/bge-m3`.

Una verifica rapida del passthrough, se necessaria:

```powershell
docker run --rm --gpus all nvidia/cuda:12.6.3-base-ubuntu22.04 nvidia-smi
```

## Configurazione

Da PowerShell, nella directory del servizio:

```powershell
Set-Location services/bge-m3-embedding
Copy-Item .env.example .env
notepad .env
```

Impostare `BGE_MODEL_CACHE` a una directory persistente dell'host. Esempio
generico:

```dotenv
BGE_MODEL_CACHE=D:/path/to/models/huggingface
```

Il file `.env` è ignorato da Git. La cache viene montata in
`/models/huggingface`; `HF_HOME` e `HF_HUB_CACHE` puntano al volume montato.
Il modello non entra quindi nell'immagine, nel repository o nel filesystem
effimero del container.

Le impostazioni principali sono:

| Variabile | Default | Descrizione |
| --- | ---: | --- |
| `BGE_MODEL_NAME` | `BAAI/bge-m3` | Modello Hugging Face |
| `BGE_DEVICE` | `cuda:0` | Device CUDA esplicito; nessun fallback CPU |
| `BGE_MAX_LENGTH` | `1024` | Limite token per query e documenti |
| `BGE_MAX_BATCH_SIZE` | `32` | Numero massimo di testi per richiesta |
| `BGE_MAX_TEXT_CHARACTERS` | `100000` | Protezione preliminare per testo |
| `BGE_FP16` | `true` | Inferenza FP16 |

## Build e avvio

```powershell
docker compose build
docker compose up -d
docker compose logs -f bge-m3-embedding
```

Al primo avvio FlagEmbedding scarica il modello nella cache esterna. Uvicorn
completa lo startup solo dopo il caricamento del modello e il controllo CUDA;
durante il download il container può risultare `starting`. Se `cuda:0` non è
disponibile, il processo termina con un errore esplicito e non passa alla CPU.

La sola porta pubblicata è `127.0.0.1:8091`; nel container il servizio ascolta
su `0.0.0.0:8000`.

## Test di `/health`

```powershell
Invoke-RestMethod -Method Get -Uri 'http://127.0.0.1:8091/health' |
    ConvertTo-Json -Depth 5
```

La risposta espone stato, provider, modello, dimensioni, max length, FP16,
disponibilità CUDA, nome GPU e versioni runtime di FlagEmbedding, Torch e CUDA.

## Test di `/embed`

```powershell
$body = @{
    texts = @('testo uno', 'testo due')
    inputType = 'document'
} | ConvertTo-Json

Invoke-RestMethod `
    -Method Post `
    -Uri 'http://127.0.0.1:8091/embed' `
    -ContentType 'application/json' `
    -Body $body |
    ConvertTo-Json -Depth 4
```

Usare `inputType = 'query'` per le query. Prima dell'inferenza il tokenizer
calcola la lunghezza senza truncation: un testo oltre `BGE_MAX_LENGTH` produce
HTTP 422 e nessun embedding. Il servizio non registra il contenuto dei testi,
ma solo conteggio, tipo input, durata e dimensioni.

## Test automatici senza GPU o modello

I test usano un backend finto e non installano né importano FlagEmbedding o
Torch:

```powershell
python -m venv .venv
& .\.venv\Scripts\python.exe -m pip install -r requirements-test.txt
$env:PYTHONPATH = (Get-Location).Path
& .\.venv\Scripts\python.exe -m pytest
```

## Stop e rimozione

Arrestare e rimuovere il container e la rete Compose:

```powershell
docker compose down
```

Rimuovere anche l'immagine locale del servizio:

```powershell
docker compose down --rmi local
```

La directory indicata da `BGE_MODEL_CACHE` è esterna e non viene rimossa da
questi comandi. Per eliminare il modello occorre cancellarlo esplicitamente
dalla cache host, operazione non necessaria per il normale stop del servizio.
