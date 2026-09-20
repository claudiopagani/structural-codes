# Corpus canonico

Questa directory è l'unica fonte editoriale del progetto.

- `manifest.json` descrive perimetro e stato del corpus;
- `units/` contiene un record JSON per unità normativa;
- `assets/` contiene manifest, formule, tabelle e ritagli ufficiali.

Il perimetro corrente copre:

- NTC 2018: capitoli 1, 2, 3 e § 4.1;
- Circolare 7/2019: C1, C2, C3 e C4.1.

La review umana integrale del testo delle NTC 2018 e della Circolare 7/2019 è
stata completata contro le rispettive fonti ufficiali. Tutte le unità canoniche
sono `review.status: "verified"`; la provenance tecnica resta nei blocchi
evidence e la regione è opzionale. Questa verifica non costituisce una seconda
review indipendente, non è uno stato di pubblicazione e non rende il corpus una
fonte normativa ufficiale.

Il payload del viewer è un derivato e viene rigenerato da questi file.
