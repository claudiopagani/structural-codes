# Structural Codes Viewer

Visualizzatore web in sola lettura del corpus canonico.

Il sito non modifica il corpus e non contiene una seconda sorgente editoriale:
`npm run sync:corpus` genera `public/data/corpus.json` direttamente da
`../corpus/manifest.json`, `../corpus/units` e `../corpus/assets`.

## Comandi

```bash
npm run dev
npm run build
npm test
```

Il visualizzatore espone ricerca, indice NTC/Circolare, testo normalizzato e
raw, evidence, trasformazioni, asset, issue e relazioni.

Le correzioni si fanno nei record JSON canonici. `npm run dev` sincronizza
automaticamente il payload; `npm test` ne verifica anche figure e fingerprint.
