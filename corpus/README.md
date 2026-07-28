# Corpus canonico

Questa directory è l'unica fonte editoriale del progetto.

- `manifest.json` descrive perimetro e stato del corpus;
- `units/` contiene un record JSON per unità normativa;
- `assets/` contiene manifest, formule, tabelle e ritagli ufficiali.

Il perimetro corrente copre:

- NTC 2018: capitoli 1, 2, 3 e § 4.1;
- Circolare 7/2019: C1, C2, C3 e C4.1.

Le unità sono ancora in stato `extracted`: testo, pagina, regione e hash
derivano dall'evidence ufficiale, ma le review umane restano bloccanti.

Il payload del viewer è un derivato e viene rigenerato da questi file.
