## Perimetro della modifica

- Tipo: software / documentazione / corpus / asset / relazione / release
- Documento, capitolo e unità (se editoriali):
- Pagine PDF contigue (se editoriali):
- File fuori perimetro cambiati: nessuno / elenco motivato

## Modifica

Descrivere problema, decisione e impatto. Per il corpus, indicare la differenza
puntuale rispetto alla fonte senza interpretare la norma.

## Verifica

- [ ] Ho seguito `AGENTS.md`.
- [ ] Non ho modificato output generati sotto `viewer/public/`.
- [ ] Ho aggiunto o aggiornato i test di regressione.
- [ ] `npm run check` passa.
- [ ] `npm run viewer:test` passa.
- [ ] Se modifico il corpus, ho confrontato il PDF ufficiale registrato e tutte le pagine dello step.
- [ ] Se modifico il corpus, ho aggiornato evidence, trasformazioni, hash e generatori pertinenti.
- [ ] Se modifico il corpus, ho controllato tutte le unità modificate nel viewer.
- [ ] Se modifico relazioni, non le ho inferite dalla sola numerazione.
- [ ] Ogni dubbio editoriale residuo è dichiarato come issue bloccante.
- [ ] Per una release, `npm run release:verify` passa e ho ispezionato il tarball.

## Privacy

- [ ] La pull request non contiene PDF, credenziali, dati di audit o identità
      reali dei revisori.
