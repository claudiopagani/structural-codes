# ADR 0001 — Corpus canonico unico

- Stato: accettata
- Data: 2026-07-28
- Ambito: repository

## Contesto

La prima importazione aveva lasciato nel repository due modelli concorrenti:
un albero MDX non verificato e il corpus JSON con evidence a livello di blocco.
Baseline, alias e script di migrazione continuavano a far dipendere la CI dal
modello superato.

## Decisione

`corpus/` è l'unica fonte editoriale versionata.

- Le unità normative sono record JSON conformi allo schema corrente.
- Formule, tabelle e figure sono asset canonici referenziati dalle unità.
- Il viewer e ogni altro formato di consultazione sono derivati.
- Evidence e PDF locali non sono versionati, ma restano verificabili tramite il
  registro delle fonti e gli hash.
- Non sono mantenuti parser, baseline, alias o generatori relativi al corpus
  precedente.

## Conseguenze

- la CI controlla soltanto la pipeline canonica;
- non esiste una sincronizzazione tra due corpus;
- ogni correzione normativa avviene in `corpus/` e richiede evidence;
- la cronologia Git conserva comunque la provenienza delle importazioni passate.
