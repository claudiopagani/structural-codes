# Release npm

Structural Codes usa SemVer con prerelease. La versione corrente è
`0.1.0-beta.2`: corpus e software sono pubblicamente ispezionabili, mentre
schema e API possono ancora ricevere cambi breaking dichiarati.
Le versioni degli schemi canonici restano indipendenti dalla versione npm.

## Gate completo

Da un clone pulito con evidence locale disponibile e verificata:

```bash
npm ci
npm run check
npm run release:verify
npm --prefix viewer run pack:verify
npm --prefix viewer run test:consumer
```

Controlli aggiuntivi espliciti:

```bash
npm pack --dry-run
npm --prefix viewer pack --dry-run
```

`release:verify` non pubblica. Valida sorgenti, corpus ed evidence; esegue
typecheck, lint, test e audit; costruisce il package core; confronta dry-run e
tarball reale; installa il tarball in un consumer temporaneo e verifica runtime
e tipi.

Il viewer aggiunge build, test applicativi, controllo del boundary, tarball e
consumer Next reale. Il consumer deve importare:

- `structural-codes-viewer`;
- `structural-codes-viewer/styles.css`;
- `structural-codes-viewer/annotations`;
- `structural-codes-viewer/corpus-data`.

## Inventario dei package

Il tarball `structural-codes` contiene soltanto build ESM/tipi, schema, corpus,
source registry, README, licenza, notice e manifest.

Il tarball `structural-codes-viewer` contiene soltanto `package-dist/`, README,
licenza, notice e manifest. Non deve contenere route/app standalone, server,
`.env`, cache, PDF, test o output di sviluppo.

Nessun package deve dipendere da file `.local`.

## Criteri alpha → beta

La promozione a beta richiede tutti i seguenti elementi:

- schema del corpus sufficientemente stabile e migrazioni breaking residue
  identificate;
- API pubbliche dei due package sufficientemente stabili;
- boundary core/viewer e componenti shared coperti da test;
- release verification completa e ripetibile da clone pulito;
- consumer test reale per viewer, annotazioni e pannello ausiliario;
- documentazione corrente di corpus, viewer e API di integrazione;
- assenza di debiti architetturali critici o contratti pubblici non implementati;
- assenza di secret e di dipendenze da file locali non distribuiti;
- tarball ispezionati e licenze incluse;
- issue bloccanti di release esplicitamente risolte o documentate.

`beta` misura soltanto la stabilità del progetto open-source.

## Stable

Una release stable richiede API, schema e formato dei package governati secondo
SemVer, compatibilità documentata e gate consolidati. La stabilità software non
costituisce certificazione, approvazione ufficiale o fonte normativa.

## Pubblicazione manuale

Dopo login npm, verifica del nome package e autorizzazione esplicita:

```bash
npm publish ./structural-codes-0.1.0-beta.2.tgz --tag beta --access public
npm publish ./structural-codes-viewer-0.1.0-beta.2.tgz --tag beta --access public
```

La pubblicazione non è automatica, non crea una GitHub Release e non modifica
gli stati editoriali del corpus.
