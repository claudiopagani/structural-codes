# Baseline del corpus legacy

> Stato: **quarantined-unverified**  
> Report deterministico: rigenerare con `npm run baseline`  
> Fingerprint: `e92cc0b439ee8c4597a630a230d9ad249d2f383fa4a161b97f6416fd68eb2f20`

Questa fotografia non certifica il corpus. Registra in modo riproducibile il
legacy e i fallimenti noti, così ogni cambiamento diventa esplicito.

## Ambiente

- Node.js: `v24.11.0`
- Piattaforma: `win32-x64`
- Package manager: `npm/11.6.1 node/v24.11.0 win32 x64 workspaces/false`

## Inventario

- File MDX: 333
- ID dichiarati: 333
- ID univoci: 332
- Gruppi di ID duplicati: 1
- Frontmatter parsati dal parser legacy: 267
- Frontmatter non parsati dal parser legacy: 66
- Unità conformi allo schema legacy: 225
- Unità non conformi tra quelle parsate: 42
- Affidabilità dichiarata `unverified`: 333

## Riferimenti e mapping

- Riferimenti complessivi: 245
- Riferimenti pendenti: 72
- `refsOut`: 133, di cui 61 pendenti
- Relazioni: 112, di cui 11 pendenti
- Mapping NTC ↔ Circolare: 31 link / 62 endpoint
- Endpoint di mapping pendenti: 23
- Mapping confermati: 0

## Asset

| Tipo | ID univoci nel frontmatter | ID usati nel body | Unione | Descrittori |
|---|---:|---:|---:|---:|
| Formule | 117 | 98 | 121 | 1 |
| Tabelle | 34 | 31 | 34 | 1 |
| Figure | 30 | 26 | 30 | 0 |

Le differenze tra frontmatter e body sono mantenute visibili: l'unione non
implica che tutti gli elementi siano corretti o realmente presenti nella fonte.

## Fonti locali

| Fonte | File presente | Hash corrisponde | Dimensione corrisponde | Verifica manuale |
|---|---|---|---|---|
| `gu-so8-2018-ntc` | sì | sì | sì | no |
| `circ-7-2019` | sì | sì | sì | no |
| `gu-sg69-2023-dm-ntc-amendment` | sì | sì | sì | no |

## Controlli esistenti

| Controllo | Esito | Exit code | Sintesi |
|---|---|---:|---|
| `validate:schema` | FAIL | 1 | files: 340, errors: 120, warnings: 22 |
| `validate:ids` | FAIL | 1 | units: 225, errors: 2, warnings: 301 |
| `test` | PASS | 0 | tests: 49, passed: 49, failed: 0 |
| `typecheck` | PASS | 0 | — |
| `lint` | PASS | 0 | — |

I fallimenti sono attesi nello stato corrente e costituiscono parte della
baseline. Una futura pipeline pubblicabile dovrà trasformarli in gate verdi,
non rimuoverli o ignorarli.
