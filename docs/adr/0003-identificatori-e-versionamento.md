# ADR 0003 — Identificatori, alias e versionamento

- Stato: accettata per il pilota
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

## Alias e deprecazione

Gli ID legacy sono registrati in `legacyAliases`. Un alias:

- deve risolvere verso un solo ID canonico;
- non può essere riutilizzato;
- resta risolvibile dopo la migrazione;
- non trasferisce al nuovo record l'affidabilità del contenuto legacy.

Se la granularità cambia, il vecchio ID diventa alias dell'unità
semanticamente equivalente. Se non esiste equivalenza univoca, si pubblica
una risoluzione esplicita `split`, `merged` o `retired`; non si sceglie un
target arbitrario.

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

I validator devono rifiutare duplicati, target inesistenti e collisioni tra
alias. I consumer non devono costruire ID concatenando stringhe non validate.
