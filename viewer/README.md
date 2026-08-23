# Structural Codes Viewer

Consumer web in sola lettura del corpus canonico. Non è un editor e non è
incluso nel package runtime `structural-codes`.

## Modalità

- **NTC 2018**: carica indice e chunk NTC necessari;
- **Circolare 7/2019**: carica indice e chunk Circolare necessari;
- **NTC 2018 + Circolare**: mantiene la struttura NTC e inserisce 0..n unità
  Circolare correlate tramite le sole relazioni esplicite del corpus.

I collegamenti `proposed` sono marcati come da revisionare. La corrispondenza
della numerazione genera soltanto `relation-diagnostics.json` e non alimenta
la vista combinata.

## Artefatti statici

`npm run sync:corpus` genera sotto `public/data/codes/`:

```text
manifest.json
relations.json
relation-diagnostics.json
search-index.json
ntc2018/index.json
ntc2018/chunks/*.json
circ2019/index.json
circ2019/chunks/*.json
```

Il manifest contiene versione package/schema, fingerprint canonico e
fingerprint degli artefatti. Gli indici consentono deep-link e navigazione; i
chunk contengono unità e soli asset referenziati. L'indice di ricerca viene
caricato al primo utilizzo. PDF.js e il PDF ufficiale vengono importati solo
dopo il comando “Apri PDF ufficiale”. Figure e worker sono copie derivate e
ignorate da Git.

## Comandi

```bash
npm run dev
npm run build
npm run lint
npm test
```

Le correzioni si fanno in `../corpus/` o nei generatori pertinenti. I test
verificano conteggi, workflow, inventario chunk, limite di dimensione, asset,
hash delle figure, relazioni esplicite e separazione della diagnostica.
