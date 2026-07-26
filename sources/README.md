# Fonti

Il registro di riferimento per la rifondazione è:

- `registry/sources.v2.json` — work, espressioni, manifestazioni, relazioni ed
  effetti temporali;
- `manifests/verification-2026-07-26.json` — confronto tra PDF ufficiali
  remoti e file locali;
- `sources.json` — registro v1 mantenuto per compatibilità con gli strumenti
  legacy.

I PDF originali sono in `raw-sources/` e non sono versionati in Git. Il loro
contenuto è identificato tramite SHA-256, byte count e numero di pagine.

## Verifica

```bash
npm run validate:sources:v2
npm run verify:sources:online
```

Il primo comando non richiede rete e controlla schema, relazioni, manifest,
file locali, hash, dimensioni e pagine. Il secondo riscarica in streaming le
fonti ufficiali e confronta byte e SHA-256 senza sovrascrivere gli originali.

Il registro v2 non ammette placeholder. Una verifica automatica non equivale a
review giuridica o editoriale.
