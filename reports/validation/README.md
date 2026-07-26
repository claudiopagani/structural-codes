# Report di validazione

`baseline.json` è la fotografia macchina deterministica del corpus legacy;
`baseline.md` ne è la sintesi leggibile. Entrambe vengono generate da:

```bash
npm run baseline
```

Per controllare che inventario e difetti non siano cambiati:

```bash
npm run baseline:check
```

Il controllo non afferma che la baseline sia corretta: afferma soltanto che lo
stato osservato coincide con quello registrato. Errori dei validator e test
mancanti restano visibili nel report.

Le baseline vanno rigenerate intenzionalmente quando cambia uno dei file sotto
`content/`, `assets/`, `mappings/` o il registro `sources/sources.json`.
L'aggiornamento deve essere accompagnato dalla motivazione nella pull request.
