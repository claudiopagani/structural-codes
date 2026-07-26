# ADR 0001 — Quarantena del corpus legacy

- Stato: accettata
- Data: 2026-07-26
- Ambito: `content/`, `assets/`, `mappings/`

## Contesto

L'audit iniziale ha rilevato errori sistemici di schema, identificazione,
provenienza, fedeltà, collegamento e copertura. I file esistenti sono utili
come materiale di confronto, ma non forniscono garanzie sufficienti per
essere considerati corpus canonico o pubblicabile.

Correggere direttamente centinaia di MDX manterrebbe inoltre come fondamento
il parser YAML/regex e un modello che non rappresenta adeguatamente evidence
a livello di blocco, versioni degli atti e trasformazioni del testo.

## Decisione

Il corpus corrente viene classificato come `quarantined-unverified`.

1. Il contenuto resta nella posizione attuale durante la fase di fondazione,
   per non rompere riferimenti e non perdere la storia Git.
2. `corpus-status.json` è la dichiarazione macchina dello stato.
3. `reports/validation/baseline.json` fotografa in modo riproducibile
   inventario, difetti e controlli esistenti.
4. Il package è privato e il `prepack` è bloccato finché lo stato non viene
   esplicitamente promosso con una futura decisione architetturale.
5. Le modifiche al legacy non ricevono automaticamente maggiore affidabilità:
   ogni dato migrato nel modello v2 dovrà acquisire evidence e review proprie.
6. MDX e gli altri formati di consultazione saranno output derivati; la scelta
   definitiva della fonte canonica v2 è demandata a un ADR successivo.

## Conseguenze

- I validator correnti possono e devono continuare a fallire: il fallimento è
  parte della baseline, non una certificazione positiva.
- Il repository può evolvere senza cancellare il lavoro precedente.
- Ogni variazione del legacy rende obsoleta la baseline e deve essere
  accettata esplicitamente rigenerandola.
- Non è possibile creare un pacchetto distribuibile per errore.
- La futura migrazione dovrà produrre una mappa tra vecchi e nuovi ID.

## Criterio di superamento

La quarantena potrà essere rimossa solo quando:

- esiste una fonte canonica versionata;
- i gate di schema, provenienza, link, asset e review sono bloccanti;
- una release candidate è ricostruibile dalle fonti registrate;
- un audit indipendente ha approvato il perimetro pubblicato;
- un nuovo ADR autorizza espressamente il cambio di stato.
