# ADR 0002 — JSON canonico e output derivati

- Stato: accettata
- Data: 2026-07-26
- Ambito: Fase 2

## Contesto

Dato canonico e presentazione devono restare separati per rendere verificabili
le trasformazioni e impedire che un errore del renderer modifichi la norma.

## Decisione

La fonte canonica del nuovo corpus è un record JSON per unità normativa,
conforme a `schemas/corpus-v2.schema.json`. MDX, Markdown, HTML, JSONL,
indici di ricerca e grafi sono esclusivamente output generati.

L'unità canonica contiene:

- identità dell'opera e dell'espressione;
- collocazione gerarchica e validità temporale;
- blocchi ufficiali o editoriali esplicitamente distinti;
- evidence per ogni blocco ufficiale;
- citazioni e relazioni tipizzate;
- riferimenti agli asset;
- stato, issue e review;
- hash di integrità quando l'unità è pubblicabile.

Un blocco di testo ufficiale conserva sia il testo diplomatico `raw` sia il
testo `normalized`. Le annotazioni editoriali non possono essere incluse in
nessuno dei due campi.

## Conseguenze

- ogni output può essere rigenerato e confrontato;
- un errore nel renderer non modifica il dato canonico;
- non sono accettate correzioni manuali negli output;
- i generatori devono essere deterministici e registrare la versione del
  contratto;

## Evoluzione

La versione `2.0.0-alpha.2` non è ancora stabile. Ogni modifica richiede
fixture aggiornate, nota di compatibilità e una
nuova versione:

- patch: chiarimento compatibile o vincolo che non cambia i record validi;
- minor: campo o vocabolario aggiunto in modo compatibile;
- major: modifica incompatibile o mutamento semantico.

La promozione da `alpha` richiede schema consolidato e review del perimetro
destinato alla prima release.
