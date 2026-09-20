# ChatNTC — semantic index e retrieval server-side (STEP 2–3)

Lo STEP 2 introduce il tooling per produrre, validare e leggere un indice
semantico server-side. Lo STEP 3 usa lo stesso reader per osservare un ranking
semantico in isolamento, senza usarlo nel ranking canonico ChatNTC. Il percorso
locale normale continua a usare exact-reference, ricerca lessicale, espansione
strutturale ed Evidence Package senza richiedere questi file o un modello
embedding.

## Input deterministico

Il comando rigenera prima gli artifact del viewer dal corpus canonico e legge
`manifest.json`, gli indici documento e i chunk. Per ogni unità, nell'ordine
canonico degli indici, costruisce il testo `chatntc-unit-text-v1`:

```text
document: ntc2018
numbering: 7.3.6.1
title: <titolo canonico>
text:
<blocchi text.normalized utili, nell'ordine della fonte>
```

Il title block non viene duplicato nel corpo. Asset, raw text, provenance e
contenuti esterni non vengono trasformati in descrizioni inventate. Un SHA-256
di tutte le coppie `unitId + testo embedding` viene salvato come
`inputFingerprint`; il `corpusFingerprint` proviene dal manifest degli artifact.

## Formato su disco

La directory contiene due file:

```text
index.json
vectors.f32
```

`index.json` contiene `formatVersion`, provider e modello embedding,
versione/digest dichiarati, dimensioni, normalizzazione `l2`, parametri del
provider, fingerprint corpus/input, numero e ordine degli `unitId`, encoding,
byte length e SHA-256 del file binario. `vectors.f32` è una matrice row-major
`unitCount × dimensions`, codificata IEEE-754 Float32 little-endian.

La dimensione binaria esatta è:

```text
unitCount × dimensions × 4 byte
```

Le dimensioni non sono hardcoded: devono coincidere con il modello e con
l'eventuale opzione `--dimensions`. Il lettore rifiuta fingerprint errati,
unità duplicate/sconosciute/mancanti, modelli o configurazioni non dichiarati,
dimensioni e byte length incoerenti, hash errati, NaN/Infinity e vettori non
normalizzati.

## Generazione locale con Ollama

Ollama è soltanto un adapter CLI di sviluppo. Il formato e il generatore usano
l'interfaccia provider-neutral `ChatNTCEmbeddingProvider`; non esistono
dipendenze npm da Ollama o da modelli. L'adapter usa `GET /api/tags` per
registrare il digest installato e `POST /api/embed` con `truncate: false`,
secondo la documentazione ufficiale [List models](https://docs.ollama.com/api/tags)
e [Generate embeddings](https://docs.ollama.com/api/embed).

Con Ollama già avviato e il modello già installato:

```bash
npm --prefix viewer run chatntc:semantic:index -- \
  --model <modello-embedding> \
  --dimensions <dimensioni-opzionali>
```

Opzioni disponibili: `--ollama-url`, `--batch-size`, `--timeout-ms` e
`--output`. Per sicurezza `--output` deve restare sotto `viewer/.local/`.
Il default è `viewer/.local/chatntc-semantic/`.

Validazione separata, senza chiamare il modello:

```bash
npm --prefix viewer run chatntc:semantic:validate
```

## Perché l'indice non è versionato

`viewer/.local/` è ignorata da Git. Gli embedding sono derivati rigenerabili,
possono essere voluminosi e dipendono esattamente da corpus, modello, digest e
parametri. La repository non contiene embedding reali né distribuisce un
modello.

Corpus e query devono essere embeddizzati con lo stesso modello, versione o
digest, dimensioni, normalizzazione e parametri. Una query prodotta con una
configurazione diversa non è confrontabile in modo affidabile con la matrice.

Quando cambia il corpus, eseguire nuovamente il comando di generazione. Il
vecchio indice viene comunque respinto perché il `corpusFingerprint` e/o
`inputFingerprint` non corrisponde più. Anche un cambio di modello, digest,
dimensioni o parametri richiede una rigenerazione completa.

## Retrieval osservazionale dello STEP 3

Il modulo server `semanticRetriever.ts` esegue:

```text
query → ChatNTCEmbeddingProvider → embedding L2 → indice validato
      → dot product/cosine lineare → top-K semantico
```

Poiché sia matrice sia query sono normalizzate L2, il dot product è equivalente
alla cosine similarity. A parità di score prevale l'ordine canonico delle righe
dell'indice, poi `unitId`. Il loader mantiene in memoria la snapshot già
validata e può essere invalidato esplicitamente; non usa database vettoriali o
ANN.

Gli hit semantici (`unitId`, documento, numbering, rank e similarity) restano
server-side. In modalità `shadow` vengono confrontati con il top-K lessicale,
ma non sostituiscono `primaryCandidates`, non entrano nell'Evidence Package e
non cambiano la risposta. Anche `on`, fino allo STEP 4, conserva il ranking
legacy e non simula una fusion provvisoria.

## Fuori perimetro fino allo STEP 4

- rank fusion lessicale/semantica e normalizzazione degli score;
- uso degli hit semantici nel ranking o nell'Evidence Package;
- configurazione/deployment production e Docker;
- ANN, vector database, reranker o semantic entailment validation.
