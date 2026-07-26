# ADR 0002 — JSON canonico e output derivati

- Stato: accettata per il pilota
- Data: 2026-07-26
- Ambito: Fase 2

## Contesto

Il corpus legacy usa file MDX sia come dato sia come presentazione. Questa
sovrapposizione rende fragile il parsing, nasconde differenze tra testo
ufficiale e apparato editoriale e non consente di dimostrare quale
trasformazione abbia prodotto un output.

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
- il legacy MDX resta una sorgente di migrazione, non una fonte normativa.

## Evoluzione

La versione `2.0.0-alpha.1` è vincolante per il pilota ma non è ancora
stabile. Ogni modifica richiede fixture aggiornate, nota di migrazione e una
nuova versione:

- patch: chiarimento compatibile o vincolo che non cambia i record validi;
- minor: campo o vocabolario aggiunto in modo compatibile;
- major: modifica incompatibile o mutamento semantico.

La promozione da `alpha` richiede il completamento del pilota previsto dalla
Fase 5.
