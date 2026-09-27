# Semantic retrieval sperimentale

Il semantic retrieval è un'estensione opzionale e sperimentale di ChatNTC.
Non è necessario per il percorso standard e non è incluso nei tarball come
indice, modello o dipendenza runtime.

## Modalità

`CHATNTC_SEMANTIC_MODE` accetta:

- `off` — default; solo lexical retrieval ed espansione strutturale;
- `shadow` — esegue semantic retrieval e RRF per diagnostica, ma mantiene il
  ranking lessicale come input dell'Evidence Package;
- `on` — usa il ranking fuso quando il semantic restituisce hit validi e
  degrada al ranking lessicale se il servizio fallisce o non trova risultati.

In `off` il runtime non legge l'indice, non costruisce un provider embedding e
non richiede Docker, GPU, BGE-M3 o Ollama.

## Indice

Il formato corrente usa:

- chunking block-aware deterministico;
- tokenizer fissato a `BAAI/bge-m3` con revision registrata;
- vettori `float32-le` in `vectors.f32`;
- metadata, inventario e hash in `index.json`;
- fingerprint del corpus e degli input;
- compatibilità esplicita fra provider, modello e dimensioni.

Indice e cache sono artefatti locali ignorati da Git. Il reader verifica
versione formato, checksum dei vettori, corpus fingerprint, inventario unità,
chunking e descrizione del provider prima dell'uso.

## Tooling

Da `viewer/`:

```bash
npm run chatntc:semantic:tokenizer:setup
npm run chatntc:semantic:audit-lengths
npm run chatntc:semantic:audit-chunks
npm run chatntc:semantic:index
npm run chatntc:semantic:validate
npm run chatntc:retrieval:benchmark
```

Gli script compilano in directory `.local/` ignorate. La configurazione locale
tipica usa un path esplicito, per esempio
`.local/chatntc-semantic-flagembedding`; nessun path `.local` è richiesto dal
package o dal runtime con modalità `off`.

## Provider embedding

Sono presenti adapter sperimentali per:

- servizio HTTP FlagEmbedding/BGE-M3;
- Ollama con modello, dimensioni e contesto configurati esplicitamente.

Il servizio BGE-M3 opzionale è in
[`services/bge-m3-embedding/`](../services/bge-m3-embedding/README.md). Lo stack
[`deploy/chatntc/`](../deploy/chatntc/README.md) lo avvia solo con il profilo
Compose `semantic`.

Variabili runtime principali:

```dotenv
CHATNTC_SEMANTIC_MODE=shadow
CHATNTC_EMBEDDING_PROVIDER=flagembedding-http
CHATNTC_EMBEDDING_URL=http://127.0.0.1:8091
CHATNTC_SEMANTIC_INDEX_PATH=<directory indice>
CHATNTC_EMBEDDING_TIMEOUT_MS=120000
CHATNTC_EMBEDDING_BATCH_SIZE=32
```

## Rank fusion e fallback

Il coordinator conserva separati hit lessicali e semantic, quindi applica RRF
con parametri versionati. Le diagnostiche aggregate includono overlap, cambi
di rank, fallback e codice di failure; non contengono query, prompt o contenuto
evidence.

`shadow` non modifica mai il risultato lessicale. `on` usa il ranking fuso
solo quando esistono hit semantic; timeout, indice incompatibile, servizio non
disponibile o risultato vuoto producono fallback lessicale controllato.

## Benchmark e validazione

I casi in `viewer/benchmarks/chatntc-retrieval-cases.json` confrontano target,
ranking e casi senza risposta diretta. Il benchmark non promuove automaticamente
la modalità `on`: i risultati vanno valutati e versionati come decisione
deliberata del progetto.

```bash
npm --prefix viewer run test:chatntc-semantic
npm --prefix viewer run test:chatntc-server
npm --prefix viewer run test:chatntc-retrieval-benchmark
```

BGE-M3 resta sperimentale anche quando i test passano; il percorso lessicale e
strutturale è il comportamento standard supportato.
