# Stato di attuazione della roadmap

Aggiornamento: 2026-07-26.

Questo documento distingue la pubblicazione open source del repository dalla
pubblicazione di unità normative canoniche. “Completata” non significa che il
corpus normativo sia già verificato.

| Fase | Stato | Evidenza | Gate ancora aperti |
|---|---|---|---|
| 0 — Quarantena e baseline | completata | `corpus-status.json`, baseline, release guard | nessuno sul perimetro tecnico |
| 1 — Fonti e perimetro | completata | registro v2, tre PDF byte-identical, D.M. 2023, policy LGPL | nessuno |
| 2 — Contratto dati | applicato al primo lotto | schema alpha, ADR, fixture e 333 unità NTC/Circolare | stabilizzazione prima della pubblicazione |
| 3 — Evidence | estesa al primo lotto | acquisizione e 130 pagine con coordinate, render, hash e regressioni | estensione ai capitoli successivi |
| 4 — Normalizzazione e review | strumenti pronti | normalizzatore, diff, gate di stato, checklist, registro privato dei reviewer | due atti di review umana reali |
| 5 — Pilota §3.3/C3.3 | estrazione completata | evidence completa, heading coperti, anchor visuali, unità canoniche e inventario asset | segmentazione asset e review |
| 6 — Migrazione controllata | avviata | generatore riproducibile, alias legacy e report di migrazione | review del lotto e pensionamento progressivo del legacy |
| 7–8 — Ricostruzione NTC/Circolare | primo lotto estratto | capitoli 1, 2, 3 e 4.1: 333 unità, 700 blocchi e 89 relazioni proposte | asset, review e capitoli restanti |
| 9–10 — Asset e grafo | avviate come inventario | 122 unità con candidati asset; relazioni omologhe proposte | segmentazione/verifica asset e conferma relazioni |
| 11 — Integrazione software | avviata | manifest v1, 12 export verificati, 7 mapping proposti | conferma mapping su corpus canonico e revisione pulita del provider |
| 12–14 | non avviate | — | dipendono dalle fasi precedenti |

## Risultati del pilota finora

- NTC §3.3: pagine PDF 56–60, 11 heading attesi rilevati su 11.
- Circolare C3.3: pagine PDF 54–75, 34 heading coperti su 34.
- L'estrazione rileva direttamente 31 heading. I numeri
  `C3.3.8.1.4`, `C3.3.8.1.5` e `C3.3.8.1.7` sono corrotti nel layer
  testuale ma sono stati confermati sui render. È stata confermata
  visualmente anche la spaziatura corretta di `C3.3.8.5 PRESSIONI INTERNE`.
- I pattern hanno trovato candidati per formule, tabelle e figure, ma i
  conteggi non sono ancora asset verificati.
- Gli 11 mapping top-level Circolare → NTC sono soltanto proposti.
- L'inventario visuale conta 8 formule numerate, 3 tabelle e 3 figure nelle
  NTC; 12 formule numerate, 19 tabelle e 28 figure nella Circolare. Le formule
  non numerate sono incluse nel perimetro ma non ancora segmentate.
- Il manifest verso l'attuale `strutture-js` è stato verificato contro il
  commit `dbad8c8593e26d60e960b29a03ce486700745de5`: il modulo vento coincide
  con il blob Git registrato, mentre il worktree complessivo del provider è
  sporco per modifiche estranee al pilot.

Il dettaglio riproducibile è in
`reports/pilot/section-3.3.inventory.json` e la sintesi in
`reports/pilot/section-3.3.inventory.md`. L'audit dei render è in
`reports/pilot/section-3.3.visual-audit.json`.

## Primo lotto canonico

Il generatore `scripts/build-canonical-core.ts` ha migrato nel modello v2,
usando il legacy soltanto per numerazioni e alias:

- NTC 2018, capitoli 1, 2, 3 e § 4.1: 194 unità e 398 blocchi;
- Circolare 7/2019, C1, C2, C3 e C4.1: 139 unità e 302 blocchi;
- 89 relazioni Circolare → NTC sono proposte e non ancora confermate;
- 12 heading con glyph corrotti nel layer testuale della Circolare sono stati
  individuati sul render e registrati con correzione tracciata.

Tutte le 333 unità restano in stato `extracted`. Il report riproducibile è in
`reports/migration/core-concrete-corpus.md`.

## Valutazione del capitolo 7

Il capitolo 7 non è incluso nel primo lotto. Nelle NTC il capitolo occupa le
pagine PDF 211–293 e dispone di un layer testuale utilizzabile. Nella Circolare,
invece, C7 occupa le pagine PDF 197–252 (pagine stampate 193–248): il render
contiene il testo, ma l'estrazione restituisce quasi soltanto intestazioni e
piè di pagina. C8 riprende regolarmente a pagina PDF 253.

Estendere a C7 la pipeline corrente produrrebbe quindi unità apparentemente
valide ma prive del corpo ufficiale. Il lotto è rinviato a una pipeline OCR
tracciata, con confronto visuale e review rafforzata; non viene importato dal
legacy per colmare il layer mancante.

## Difetto di determinismo intercettato

La regressione ha mostrato che i nomi font interni assegnati da PDF.js
dipendevano dall'ordine delle pagine caricate, cambiando l'hash dello stesso
record pagina. La pipeline `0.1.2` sostituisce tali nomi con riferimenti
locali alla pagina. È stato verificato che la pagina 58 NTC e la pagina 55
della Circolare producono lo stesso hash sia estratte singolarmente sia
dentro l'intero range del pilota.

## Condizione di pubblicazione

Il repository è destinato alla pubblicazione pubblica immediata con licenza
`LGPL-2.1-or-later`. Il legacy resta `quarantined-unverified`; i record in
`corpus/` sono separati dal legacy ma ancora `extracted`, e nessuna unità è
stata promossa a `published`.
Il `release:guard` deve continuare a fallire finché tutti i gate del corpus
canonico non sono soddisfatti.

Il revisore umano designato dal proprietario è registrato solo nell'audit
locale. Nel repository pubblico le review useranno l'identificatore
pseudonimo `reviewer:internal:001`.
