# Trasparenza di ChatNTC

## Scopo e perimetro

ChatNTC è un componente opzionale basato su un provider LLM. Structural Codes e
il viewer restano utilizzabili senza abilitarlo. Questa pagina descrive il
comportamento AI di ChatNTC per sviluppatori, deployer e utenti tecnici; non è
una certificazione di conformità all'AI Act.

## Provider generativo

Gli adapter inclusi sono DeepSeek, OpenAI, Anthropic, Google Gemini e
OpenRouter. Provider e modello effettivi dipendono dalla configurazione locale
del server o dalla selezione BYOK della singola richiesta. Le caratteristiche
di generazione e di eventuale provenance del testo dipendono dal servizio e dal
modello scelti, compreso quello sottostante a OpenRouter.

## Pipeline di generazione e verifica

```text
query
  → retrieval
  → structural expansion
  → Evidence Package
  → provider LLM
  → canonicalizzazione dei riferimenti
  → Citation Validator
  → risposta finale
```

Il modello produce un JSON strutturato, ma non decide quali riferimenti siano
canonici. ChatNTC risolve i riferimenti contro il corpus e il Citation
Validator controlla integrità del pacchetto, provenance del corpus e
risoluzione dei riferimenti. Un riferimento verificato non prova da solo che
la conclusione sia tecnicamente corretta o sostenuta semanticamente dalla
disposizione citata.

Se emergono riferimenti esterni al contesto iniziale, la pipeline può ampliare
l'Evidence Package e chiedere una nuova risposta. Per problemi della risposta
sono previsti un repair e, se necessario, una rigenerazione conservativa finale.
Ogni tentativo restituisce un oggetto JSON completo. Se l'ultima risposta non
supera la verifica, la richiesta termina con un errore pubblico controllato.

## Preservazione del testo generato

```ts
FINAL.response.answerMarkdown
  ===
lastAcceptedProviderOutput.answerMarkdown
```

Dopo l'ultima generazione accettata, ChatNTC non riscrive, parafrasa, taglia o
normalizza linguisticamente `answerMarkdown`. Una correzione testuale richiede
una nuova generazione completa dal provider. Parsing del JSON,
canonicalizzazione dei riferimenti e aggiunta di metadati non modificano la
stringa `answerMarkdown`.

## Marking e provenance del provider

Alcuni provider possono applicare meccanismi propri di marking, watermarking o
provenance. La preservazione del testo evita che ChatNTC alteri intenzionalmente
eventuali segnali testuali dopo la generazione. ChatNTC non aggiunge un proprio
watermark testuale e non rileva né certifica la presenza di quello del provider.
Disponibilità e caratteristiche di questi meccanismi dipendono dal provider e
dal modello configurati.

## Informazione nell'interfaccia

La UI ChatNTC mostra il seguente avviso:

> ChatNTC è un sistema di IA e può commettere errori. Verifica sempre le fonti normative. Non sostituisce il giudizio professionale.

L'avviso appartiene all'interfaccia e non viene inserito nella risposta
generata dal modello.

## Provenance della risposta

Il risultato di trasporto include `generation.provider`, `generation.model`,
`generation.outcome` e `generation.aiGenerated: true`; include inoltre
`evidence.packageId`, versione Structural Codes, fingerprint di corpus e
artefatti, versione della policy, citazioni e stato della validazione. Con la
history abilitata, la UI mostra data della risposta, provider/modello,
versione Structural Codes e fingerprint del corpus. La history locale conserva
il timestamp e una proiezione della provenance, senza salvare l'Evidence
Package completo.

Questi metadati descrivono il percorso di generazione e verifica di ChatNTC;
`aiGenerated` non attesta un watermark del provider.

## Dati inviati al provider

Il provider riceve domanda dell'utente, history recente limitata, direttive
ChatNTC, schema di output ed Evidence Package. Le API key non entrano nel body
della chat, nella history, nell'Evidence Package o nell'output. La chiave BYOK
resta nel boundary di credenziali descritto in [provider e BYOK](chatntc-byok.md)
e [server self-hosted](chatntc-server.md). Privacy, trattamento dei dati e
termini applicabili dipendono anche dal provider configurato.

## Limiti

- Il modello può commettere errori o generare affermazioni non supportate.
- Il Citation Validator non verifica la correttezza ingegneristica generale.
- Il corpus Structural Codes non è una fonte normativa ufficiale: occorre
  verificare la fonte ufficiale e applicare il giudizio professionale.
- Provider e modelli diversi possono produrre risultati diversi.
- ChatNTC non verifica direttamente marking o watermarking.

## Responsabilità del deployment

Chi riutilizza o distribuisce ChatNTC deve valutare separatamente provider e
modello, modalità di deployment, privacy e protezione dei dati, requisiti
normativi applicabili e obblighi di trasparenza verso i propri utenti. Le
modifiche che trasformano il testo generato o cambiano il security boundary
richiedono una nuova verifica tecnica delle garanzie descritte qui.

## Documentazione collegata

- [ChatNTC: overview e contratti](chatntc-core.md)
- [Server e boundary](chatntc-server.md)
- [Provider e BYOK](chatntc-byok.md)
- [History locale](chatntc-history.md)
- [README principale](../README.md)
