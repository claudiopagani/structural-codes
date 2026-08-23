# Release npm

Structural Codes usa SemVer con prerelease. La release iniziale è
`0.1.0-alpha.1`: distribuisce un corpus ispezionabile ma non completamente
revisionato e mantiene mobili schema/API.

## Gate

Da una working tree controllata:

```bash
npm ci
npm run viewer:install
npm run release:verify
npm pack --dry-run
npm pack
```

`release:verify` non pubblica. Il tarball deve contenere soltanto:

- `dist/` con JavaScript ESM e dichiarazioni;
- `schemas/`, `corpus/`, `sources/registry/` e `integration/`;
- `README.md`, `LICENSE`, `NOTICE` e `package.json`.

Viewer, sorgenti TypeScript, script, test, PDF, evidence, audit privato,
configurazioni locali e artefatti temporanei sono vietati.

## Pubblicazione manuale

Dopo login npm, controllo del nome package e autorizzazione esplicita:

```bash
npm publish ./structural-codes-0.1.0-alpha.1.tgz --tag alpha --access public
```

Il tag `alpha` evita di presentare la prerelease come `latest`. Il publish non
crea una GitHub Release e non cambia gli stati editoriali del corpus.

## Versioning

- alpha: corpus incompleto/non interamente revisionato, API e schema mobili;
- beta: struttura sufficientemente stabile, review ancora in corso;
- stable: perimetro dichiarato e adeguatamente revisionato.

La stabilità SemVer descrive il package. Non costituisce certificazione legale
o dichiarazione automatica di conformità normativa.
