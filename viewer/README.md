# Structural Codes Viewer

Visualizzatore web in sola lettura del corpus canonico v2 di
`strutture-normative`.

Il sito non modifica il corpus e non contiene una seconda sorgente editoriale:
`npm run sync:corpus` genera `public/data/corpus.json` dai record in
`../corpus/units` e dal report di migrazione.

## Comandi

```bash
npm run dev
npm run build
npm test
```

Il visualizzatore espone:

- ricerca nel numero, titolo e testo;
- indice separato per NTC 2018 e Circolare 7/2019;
- testo normalizzato e raw;
- pagina, fonte, trasformazioni e fingerprint;
- issue bloccanti e relazioni proposte;
- piano editoriale per arrivare alla pubblicazione.

## Revisione editoriale

Le correzioni si fanno direttamente nei record JSON di `../corpus/units`,
tenendo aperto il visualizzatore come riscontro. Dopo ogni modifica:

```bash
npm run sync:corpus
npm test
```

Il comando `npm run corpus:core:build` nella radice è uno strumento di
migrazione: non va rilanciato sopra correzioni manuali, perché rigenera i record
canonici e può sovrascriverle.
