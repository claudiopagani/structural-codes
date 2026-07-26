# ADR 0005 — Identità, licenza e pubblicazione

- Stato: accettata
- Data: 2026-07-26
- Ambito: governance del repository

## Decisioni

- Il nome definitivo del repository è `structural-codes`.
- Il progetto è autonomo e collegato a `structural-checks-ts`, nome futuro
  dell'attuale `strutture-js`.
- Il repository è open source e deve essere pubblico anche durante lo
  sviluppo.
- Software, schemi, indici e apparato editoriale sono distribuiti con licenza
  `LGPL-2.1-or-later`.
- Non sono pubblicati elenchi di autori o crediti individuali.
- Le identità dei revisori sono conservate esclusivamente nell'audit interno;
  i record pubblici usano identificatori pseudonimi.
- La visibilità pubblica del repository non promuove automaticamente il
  legacy o le bozze a corpus canonico.
- Il pilot comprende integralmente NTC §3.3 e Circolare C3.3, inclusi testo,
  formule, tabelle e figure.

## Proprietario GitHub

Il proprietario desiderato è denominato `ocfem`. Prima della creazione del
repository deve essere verificato che l'organizzazione appartenga al
proprietario del progetto: il namespace GitHub `OCFEM` risulta già occupato da
un'organizzazione esterna e l'account autenticato non vi appartiene.

## Conseguenze

Il repository può essere reso pubblico in stato di lavoro, purché il
disclaimer, la quarantena del legacy e i gate macchina restino visibili. Le
unità canoniche possono essere marcate `published` soltanto dopo evidence,
review e integrità.
