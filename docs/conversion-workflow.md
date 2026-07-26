# Workflow di conversione

> **Workflow legacy sospeso.** Non usarlo per conversioni massive prima della
> definizione della pipeline v2 e del completamento del pilota previsto dalla
> roadmap di rifondazione.

Pipeline a stati. Ogni unità normativa attraversa questi stati; i gate umani
sono obbligatori e distinti dal lavoro dell'LLM.

| Stato | Attivita' | Controlli | Responsabile | Artefatto |
|-------|-----------|-----------|--------------|-----------|
| `source-acquired` | registrazione fonte | hash PDF, URL | umano | `sources.json` |
| `extracted` | estrazione testo/immagini | copertura pagine | script | `extracted/` |
| `segmented` | taglio per paragrafi | nessun paragrafo saltato | script+LLM | segmenti |
| `converted` | conversione MDX | schema Zod, ID univoci | LLM | MDX bozza |
| `automatically-validated` | suite `validate-*` | zero errori bloccanti | CI | report |
| `needs-review` | contiene marcatori o `suggested` | — | — | coda review |
| `technically-reviewed` | solo note/derivati, MAI OfficialText senza riconversione | diff OfficialText invariato | ing. strutturista | firma |
| `approved` | approvazione finale | CODEOWNERS | maintainer | merge |
| `published` | build indice | CI verde | CI | indice |
| `deprecated` | soppressione | redirect, link aggiornati | maintainer | redirects |

## Regole operative

- **L'LLM (DeepSeek) lavora solo in `converted`** e produce bozze marcate
  `convertedBy: { kind: "llm", model: "..." }`. Non imposta mai
  `confirmation: "confirmed"` sui mapping e non calcola hash.
- **La conferma dei mapping NTC-Circolare è solo umana** (ingegnere).
- **Modifica di `<OfficialText>` dopo `approved`** → hash mismatch → CI
  fallisce → retrocessione automatica a `needs-review`.
- `validate-schema` blocca: unità `approved`/`published` con `openIssues`
  non vuoto; testo libero fuori dai componenti; schema non conforme.
- `validate-ids` segnala: ID/slug duplicati (errore); refsOut/asset mancanti
  e buchi di numerazione (warning, attesi durante la conversione parziale).

## Stato corrente (2026-07-25)

- Fase 0: completata (scaffold, schema, validazione, PoC `p3.3.7` in
  `needs-review` con marcatori intenzionali).
- Fase 1: completata (fonti registrate con hash, testo estratto e misurato).
- Fase 2: da avviare — vedi `docs/handoff-fase2.md`.
