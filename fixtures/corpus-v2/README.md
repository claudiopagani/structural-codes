# Fixture del corpus v2

La convenzione dei nomi è:

- `*.valid.json`: deve superare JSON Schema e validazione semantica;
- `*.invalid.json`: deve essere rifiutato da JSON Schema.

La fixture NTC corrente contiene soltanto metadati e intestazione verificata
del §3.3.7. Le regioni delle fixture reali provengono dalla pipeline evidence,
ma i record restano intenzionalmente `draft` con issue bloccanti: sono
campioni parziali, non paragrafi completi o pubblicabili.
