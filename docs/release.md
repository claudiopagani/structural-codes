# Release npm

Structural Codes usa SemVer con prerelease. La release iniziale è
`0.1.0-alpha.1`: distribuisce un corpus ispezionabile con review umana
integrale registrata contro le fonti ufficiali, mantenendo mobili schema/API.

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

- alpha: schema/API ancora soggetti a cambiamenti, anche breaking;
- beta: schema/API sostanzialmente stabilizzati e fase di consolidamento;
- stable: API, schema e formato del package considerati stabili secondo SemVer.

La stabilità SemVer descrive esclusivamente il software e il package. Una
release stable non costituisce certificazione, approvazione ufficiale o fonte
normativa ufficiale.
