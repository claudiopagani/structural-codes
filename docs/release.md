# Release npm

Structural Codes usa SemVer con prerelease. La versione corrente è
`0.1.0-alpha.2`: corpus e software sono pubblicamente ispezionabili, mentre
schema e API possono ancora ricevere cambi breaking dichiarati.

## Gate completo

Da un clone pulito con evidence locale disponibile e verificata:

```bash
npm ci
npm run check
npm run viewer:check
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

Il viewer aggiunge build, test applicativi e ChatNTC, controllo del boundary,
tarball e consumer Next reale. Il consumer deve importare:

- `structural-codes-viewer`;
- `structural-codes-viewer/chatntc`;
- `structural-codes-viewer/chatntc/viewer-artifacts`;
- `structural-codes-viewer/chatntc-ui`;
- `structural-codes-viewer/chatntc-history`.

## Inventario dei package

Il tarball `structural-codes` contiene soltanto build ESM/tipi, schema, corpus,
source registry, README, licenza, notice e manifest.

Il tarball `structural-codes-viewer` contiene soltanto `package-dist/`, README,
licenza, notice e manifest. Non deve contenere route/app standalone, server,
adapter provider, `.env`, cache, indice semantic, modelli, PDF, test o output di
sviluppo.

Nessun package deve dipendere da file `.local` o richiedere BGE-M3. Un clone o
consumer pulito deve funzionare con semantic mode `off`.

## Criteri alpha → beta

La promozione a beta richiede tutti i seguenti elementi:

- schema del corpus sufficientemente stabile e migrazioni breaking residue
  identificate;
- API pubbliche dei due package sufficientemente stabili;
- boundary core/viewer e shared/server coperti da test;
- release verification completa e ripetibile da clone pulito;
- consumer test reale per viewer ed export ChatNTC;
- documentazione corrente di corpus, self-hosting, BYOK, history e semantic;
- assenza di debiti architetturali critici o contratti pubblici non implementati;
- assenza di secret e di dipendenze da file locali non distribuiti;
- tarball ispezionati e licenze incluse;
- issue bloccanti di release esplicitamente risolte o documentate.

`beta` misura soltanto la stabilità del progetto open-source e self-hosted.

## Stable

Una release stable richiede API, schema e formato dei package governati secondo
SemVer, compatibilità documentata e gate consolidati. La stabilità software non
costituisce certificazione, approvazione ufficiale o fonte normativa.

## Pubblicazione manuale

Dopo login npm, verifica del nome package e autorizzazione esplicita:

```bash
npm publish ./structural-codes-0.1.0-alpha.2.tgz --tag alpha --access public
npm publish ./structural-codes-viewer-0.1.0-alpha.2.tgz --tag alpha --access public
```

La pubblicazione non è automatica, non crea una GitHub Release e non modifica
gli stati editoriali del corpus.
