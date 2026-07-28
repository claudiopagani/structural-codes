# ADR 0003 — Identificatori e versionamento

- Stato: accettata
- Data: 2026-07-26
- Ambito: Fase 2

## Decisione

Gli identificatori canonici sono opachi per i consumer, stabili e separati
dalla posizione fisica dei file.

### Opere, espressioni e manifestazioni

- `workId` identifica l'atto astratto, per esempio
  `it-mit:dm:2018-01-17:ntc2018`;
- `expressionId` identifica una versione linguistica e temporale del work;
- `sourceId` identifica una manifestazione verificata, per esempio lo
  specifico PDF della Gazzetta Ufficiale.

Una modifica normativa è un work autonomo collegato al work modificato. Non
si sovrascrive l'espressione originale e non si dichiara ufficiale una
consolidazione editoriale.

### Unità e componenti

Le unità usano la forma:

`urn:structural-codes:it:unit:<corpus>:<numerazione>`

I frammenti della stessa unità usano suffissi:

- `#block-<slug>`;
- `#citation-<NNN>`;
- `#relation-<NNN>`.

Gli asset usano:

`urn:structural-codes:it:asset:<formula|table|figure>:<chiave>`

Il numero ufficiale è conservato separatamente in `numbering.official`; il
campo `numbering.sortKey` serve solo all'ordinamento. Né titoli né percorsi
di file fanno parte dell'identità.

## Versionamento temporale

La validità del contenuto è distinta dalla versione dello schema:

- `validity.from` e `validity.to` descrivono l'intervallo giuridico;
- `validity.asOf` dichiara la data fino alla quale la valutazione è stata
  effettuata;
- `workflow.status` descrive la maturità editoriale;
- `schemaVersion` descrive il contratto dati.

Un cambio di testo o validità crea una nuova espressione o un nuovo record
versionato secondo la modellazione adottata; non modifica retroattivamente
la traccia verificata.

## Vincoli

I validator devono rifiutare duplicati e target inesistenti. I consumer non
devono costruire ID concatenando stringhe non validate.
