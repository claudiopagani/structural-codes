/* eslint-disable @typescript-eslint/no-explicit-any, no-useless-escape */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const root = fileURLToPath(new URL("../", import.meta.url));
const sourceId = "gu-so8-2018-ntc";
const workId = "it-mit:dm:2018-01-17:ntc2018";
const expressionId = "it-mit:dm:2018-01-17:ntc2018:original-it";
const ruleVersion = "ntc5-editorial-profile-0.1.0";
const createdAt = "2026-08-09T00:00:00Z";
const asset = (kind: "formula" | "table" | "figure", suffix: string) => `urn:structural-codes:it:asset:${kind}:ntc2018:${suffix}`;
const unitId = (number: string) => `urn:structural-codes:it:unit:ntc2018:${number}`;
const sha256 = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");

type Inline = { kind: "text"; value: string } | { kind: "math"; value: string; latex: string };
type Block = { kind: "heading" | "paragraph" | "list-item" | "formula-ref" | "table-ref" | "figure-ref"; page: number; text?: string; raw?: string; assetId?: string; inline?: Inline[] };
type UnitDef = { number: string; title: string; blocks: Block[] };

function inlineMath(text: string): Inline[] {
    const patterns: Array<[RegExp, string | ((value: string) => string)]> = [
        [/Δσmax = \(σmax − σmin\)/g, "\\Delta\\sigma_{\\max}=(\\sigma_{\\max}-\\sigma_{\\min})"],
        [/Ed ≤ Rd/g, "E_d\\le R_d"], [/Ed ≤ Cd/g, "E_d\\le C_d"], [/D ≤ 1/g, "D\\le1"],
        [/s\/18 con s = 1435 mm/g, "s/18\\text{ con }s=1435\\,\\mathrm{mm}"],
        [/Q_{V2}/g, "Q_{v2}"], [/Q_{V1}/g, "Q_{v1}"], [/QV2/g, "Q_{v2}"], [/QV1/g, "Q_{v1}"], [/Qv2/g, "Q_{v2}"], [/Qv1/g, "Q_{v1}"],
        [/Qvi/g, "Q_{vi}"], [/qvk/g, "q_{vk}"], [/Qh/g, "Q_h"],
        [/Δσmax/g, "\\Delta\\sigma_{\\max}"], [/Ed/g, "E_d"], [/Rd/g, "R_d"], [/Cd/g, "C_d"], [/\bD\b/g, "D"],
        [/α/g, "\\alpha"], [/λ/g, "\\lambda"], [/n₀/g, "n_0"], [/\bno\b/g, "n_0"], [/Qv/g, "Q_v"],
        [/“a”/g, "a"], [/“u”/g, "u"], [/\bs\b/g, "s"],
        [/\d+(?:,\d+)?\s*kN\/m³/g, (value) => value.replace(/\s*kN\/m³/u, "").replace(",", "{,}") + "\\,\\mathrm{kN/m^3}"],
        [/\d+(?:,\d+)?\s*kN\/m²/g, (value) => value.replace(/\s*kN\/m²/u, "").replace(",", "{,}") + "\\,\\mathrm{kN/m^2}"],
        [/\d+(?:,\d+)?\s*kN\/m/g, (value) => value.replace(/\s*kN\/m/u, "").replace(",", "{,}") + "\\,\\mathrm{kN/m}"],
        [/\d+(?:,\d+)?\s*kN/g, (value) => value.replace(/\s*kN/u, "").replace(",", "{,}") + "\\,\\mathrm{kN}"],
        [/\d+(?:,\d+)?\s*km\/h/g, (value) => value.replace(/\s*km\/h/u, "").replace(",", "{,}") + "\\,\\mathrm{km/h}"],
        [/\d+(?:,\d+)?\s*mm/g, (value) => value.replace(/\s*mm/u, "").replace(",", "{,}") + "\\,\\mathrm{mm}"],
        [/\d+(?:,\d+)?\s*m/g, (value) => value.replace(/\s*m/u, "").replace(",", "{,}") + "\\,\\mathrm{m}"],
        [/\d+,\d+/g, (value) => value.replace(",", "{,}")],
        [/\d+(?:,\d+)?%/g, (value) => value.replace("%", "\\%")], [/45°/g, "45^{\\circ}"],
    ];
    const matches: Array<{ start: number; end: number; value: string; latex: string }> = [];
    for (const [pattern, toLatex] of patterns) {
        pattern.lastIndex = 0;
        let match: RegExpExecArray | null;
        while ((match = pattern.exec(text)) !== null) {
            const start = match.index;
            const end = start + match[0].length;
            if (!matches.some((item) => start < item.end && end > item.start)) {
                matches.push({ start, end, value: match[0], latex: typeof toLatex === "function" ? toLatex(match[0]) : toLatex });
            }
        }
    }
    matches.sort((a, b) => a.start - b.start);
    const result: Inline[] = [];
    let cursor = 0;
    for (const match of matches) {
        if (match.start > cursor) result.push({ kind: "text", value: text.slice(cursor, match.start) });
        result.push({ kind: "math", value: match.value, latex: match.latex });
        cursor = match.end;
    }
    if (cursor < text.length) result.push({ kind: "text", value: text.slice(cursor) });
    return result.length ? result : [{ kind: "text", value: text }];
}

const p = (page: number, text: string, raw = text): Block => ({ kind: "paragraph", page, text, raw, inline: inlineMath(text) });
const li = (page: number, text: string, raw = text): Block => ({ kind: "list-item", page, text, raw, inline: inlineMath(text) });
const h = (page: number, number: string, title: string, raw = `${number}. ${title}`): Block => ({ kind: "heading", page, text: `${number} ${title}`, raw });
const ih = (page: number, text: string): Block => ({ kind: "heading", page, text, raw: text });
const ref = (kind: "formula-ref" | "table-ref" | "figure-ref", page: number, suffix: string): Block => ({ kind, page, assetId: asset(kind.replace("-ref", "") as "formula" | "table" | "figure", suffix) });

const units: UnitDef[] = [
    { number: "5.1.4", title: "VERIFICHE DI SICUREZZA", blocks: [
        h(162, "5.1.4", "VERIFICHE DI SICUREZZA"),
        p(162, "Le verifiche di sicurezza sulle varie parti dell’opera devono essere effettuate sulla base dei criteri definiti dalle presenti norme tecniche."),
        p(162, "In particolare devono essere effettuate le verifiche allo stato limite ultimo, ivi compresa la verifica allo stato limite di fatica, ed agli stati limite di esercizio riguardanti gli stati di fessurazione e di deformazione.", "In particolare devono essere effettuate le verifiche allo stato limite ultimo, ivi compresa la verifica allo stato limite di fatica, ed a-\ngli stati limite di esercizio riguardanti gli stati di fessurazione e di deformazione."),
        p(162, "Le combinazioni di carico da considerare ai fini delle verifiche devono essere stabilite in modo da garantire la sicurezza secondo quanto definito nei criteri generali enunciati al Capitolo 2 delle presenti norme tecniche."),
    ]},
    { number: "5.1.4.1", title: "VERIFICHE AGLI STATI LIMITE ULTIMI", blocks: [
        h(162, "5.1.4.1", "VERIFICHE AGLI STATI LIMITE ULTIMI", "5.1.4.1 V ERIFICHE AGLI S TATI LIMITE U LTIMI"),
        p(162, "Si deve verificare che sia: Ed ≤ Rd, dove Ed è il valore di progetto degli effetti delle azioni ed Rd è la corrispondente resistenza di progetto.", "Si deve verificare che sia: Ed ǂ Rd, dove Ed è il valore di progetto degli effetti delle azioni ed Rd è la corrispondente resistenza di\nprogetto."),
    ]},
    { number: "5.1.4.2", title: "STATI LIMITE DI ESERCIZIO", blocks: [
        h(162, "5.1.4.2", "STATI LIMITE DI ESERCIZIO", "5.1.4.2 S TATI L IMITE DI E SERCIZIO"),
        p(162, "Per gli Stati Limite di Esercizio si dovrà verificare che sia: Ed ≤ Cd, dove Cd è un valore nominale o una funzione di certe proprietà materiali legate agli effetti progettuali delle azioni considerate, Ed è il valore di progetto dell’effetto dell’azione determinato sulla base delle combinazioni di carico.", "Per gli Stati Limite di Esercizio si dovrà verificare che sia: Ed ǂ Cd , dove Cd è un valore nominale o una funzione di certe proprie-\ntà materiali legate agli effetti progettuali delle azioni considerate, E d è il valore di progetto dell’effetto dell’azione determinato\nsulla base delle combinazioni di carico."),
    ]},
    { number: "5.1.4.3", title: "VERIFICHE ALLO STATO LIMITE DI FATICA", blocks: [
        h(162, "5.1.4.3", "VERIFICHE ALLO STATO LIMITE DI FATICA", "5.1.4.3 V ERIFICHE ALLO S TATO L IMITE DI FATICA"),
        p(162, "Per strutture, elementi strutturali e dettagli sensibili a fenomeni di fatica devono essere eseguite opportune verifiche."),
        p(162, "Le verifiche devono essere condotte considerando spettri di carico differenziati, a seconda che si conduca una verifica per vita illimitata o una verifica a danneggiamento."),
        p(162, "In assenza di studi specifici, volti alla determinazione dell’effettivo spettro di carico che interessa il ponte, si può far riferimento ai modelli descritti nel seguito."),
        ih(162, "Verifiche per vita illimitata"),
        p(162, "Le verifiche a fatica per vita illimitata possono essere condotte, per dettagli caratterizzati da limite di fatica ad ampiezza costante, controllando che la massima differenza di tensione Δσmax = (σmax − σmin) indotta nel dettaglio stesso dallo spettro di carico significativo risulti minore del limite di fatica del dettaglio stesso. Ai fini del calcolo del Δσmax si possono impiegare, in alternativa, i modelli di carico di fatica 1 e 2, disposti sul ponte nelle due configurazioni che determinano la tensione massima e minima, rispettivamente, nel dettaglio considerato.", "Le verifiche a fatica per vita illimitata possono essere condotte, per dettagli caratterizzati da limite di fatica ad ampiezza costante,\ncontrollando che la massima differenza di tensione  ̇ Η max =(Ηmax -Ηmin) indotta nel dettaglio stesso dallo spettro di carico significa-\ntivo risulti minore del limite di fatica del dettaglio stesso. Ai fini del calcolo del  ̇ Η max si possono impiegare, in alternativa, i mo-\ndelli di carico di fatica 1 e 2, disposti sul ponte nelle due configurazioni che determinano la tensione massima e minima, rispetti-\nvamente, nel dettaglio considerato."),
        ih(162, "Modello di carico 1"),
        p(162, "Il modello di carico di fatica 1 è costituito dallo Schema di Carico 1 assumendo il 70% dei carichi concentrati ed il 30% di quelli distribuiti (vedi fig. 5.1.4), applicati in asse alle corsie convenzionali individuate secondo i criteri individuati al §5.1.3.3.5"),
        p(162, "Per verifiche locali si deve considerare, se più gravoso, il modello costituito dall’asse singolo dello schema di carico 2, isolato e con carico al 70% (vedi fig.5.1.4)."),
        ref("figure-ref", 162, "5.1.4"),
        ih(162, "Modello di carico 2"),
        p(162, "Quando siano necessarie valutazioni più precise, in alternativa al modello di carico di fatica semplificato 1, derivato dal modello di carico principale, si può impiegare il modello di carico di fatica 2, rappresentato nella Tab. 5.1.VII; applicato al centro della corsia convenzionale n. 1, che è quella che determina gli effetti più severi nel dettaglio in esame"),
        ref("table-ref", 163, "5.1.vii"),
        p(162, "Il modello di carico 2 non considera gli effetti di più corsie caricate sull’impalcato in esame. Nel caso in cui siano da prevedere significativi effetti di interazione tra veicoli, per l’applicazione di questo modello si deve disporre di dati supplementari, reperibili o da letteratura tecnica consolidata o a seguito di studi specifici.", "Il modello di carico 2 non considera gli effetti di più corsie caricate sull’impalcato in esame. Nel caso in cui siano da prevedere\nsignificativi effetti di interazione tra veicoli, per l’applicazione di questo modello si deve disporre di dati supplementari, reperibi-\nli o da letteratura tecnica consolidata o a seguito di studi specifici."),
        ih(163, "Verifiche a danneggiamento"),
        p(163, "Le verifiche a danneggiamento consistono nel verificare che nel dettaglio considerato lo spettro di carico produca un danneggiamento D ≤ 1."),
        p(163, "Il danneggiamento D è valutato mediante la legge di Palmgren-Miner, considerando la curva S-N caratteristica del dettaglio e la vita nominale dell’opera."),
        p(163, "Le verifiche devono essere condotte considerando lo spettro di tensione indotto nel dettaglio dal modello di carico di fatica semplificato 3, riportato in Fig. 5.1.5, costituito da un veicolo di fatica simmetrico a 4 assi, ciascuno di peso 120 kN, o, in alternativa, quando siano necessarie valutazioni più precise, dallo spettro di carico equivalente costituente il modello di carico di fatica 4, riportato in Tab. 5.1.VIII, ove è rappresentata anche la percentuale di veicoli da considerare, in funzione del traffico interessante la strada servita dal ponte.", "Le verifiche devono essere condotte considerando lo spettro di tensione indotto nel dettaglio dal modello di carico di fatica sem-\nplificato 3, riportato in Fig. 5.1.5, costituito da un veicolo di fatica simmetrico a 4 assi, ciascuno di peso 120 kN, o, in alternativa,\nquando siano necessarie valutazioni più precise, dallo spettro di carico equivalente costituente il modello di carico di fatica 4, ri-\nportato in Tab. 5.1.VIII, ove è rappresentata anche la percentuale di veicoli da considerare, in funzione del traffico interessante la\nstrada servita dal ponte."),
        ref("figure-ref", 164, "5.1.5"),
        ref("table-ref", 164, "5.1.viii"),
        p(163, "I veicoli dei modelli di carico di fatica 3 o 4 possono essere applicati in asse alle corsie convenzionali determinate in accordo con il §5.1.3.3.5. È possibile, tuttavia, adottare disposizioni più favorevoli dei veicoli, considerando che il flusso avvenga per il 10% sulle corsie convenzionali e per il 90% sulle corsie fisiche. La posizione dei veicoli sulle corsie fisiche dovrà essere tale da determinare gli effetti più severi nel dettaglio in esame."),
        p(163, "I tipi di pneumatico da considerare per i diversi veicoli e le dimensioni delle relative impronte sono riportati nella Tab. 5.1.IX."),
        ref("table-ref", 165, "5.1.ix"),
        p(163, "In assenza di studi specifici, per verifiche di danneggiamento, si deve considerare sulla corsia lenta il flusso annuo di veicoli di peso superiore a 100 kN, rilevanti ai fini della verifica a fatica, dedotto dalla Tab. 5.1.X."),
        ref("table-ref", 165, "5.1.x"),
        p(163, "Nel caso in cui siano da prevedere significativi effetti di interazione tra veicoli, si deve far riferimento a studi specifici o a metodologie consolidate."),
        p(163, "Il modello di carico di fatica 3, considerato in asse alla corsia convenzionale, può essere utilizzato per le verifiche col metodo λ, o metodo dei coefficienti di danneggiamento equivalente. Per la determinazione dei coefficienti di danneggiamento equivalente, che devono essere specificamente calibrati sul predetto modello di carico di fatica 3, si può far riferimento alle norme UNI EN1992-2, UNI EN1993-2 ed UNI EN1994-2.", "Il modello di carico di fatica 3, considerato in asse alla corsia convenzionale, può essere utilizzato per le verifiche col metodo O, o\nmetodo dei coefficienti di danneggiamento equivalente. Per la determinazione dei coefficienti di danneggiamento equivalente,\nche devono essere specificamente calibrati sul predetto modello di carico di fatica 3, si può far riferimento alle norme UNI\nEN1992-2, UNI EN1993-2 ed UNI EN1994-2."),
    ]},
    { number: "5.1.4.4", title: "VERIFICHE ALLO STATO LIMITE DI FESSURAZIONE", blocks: [
        h(165, "5.1.4.4", "VERIFICHE ALLO STATO LIMITE DI FESSURAZIONE"),
        p(165, "Per assicurare la funzionalità e la durata delle strutture viene prefissato uno stato limite di fessurazione, commisurato alle condizioni ambientali e di sollecitazione, nonché alla sensibilità delle armature alla corrosione.", "Per assicurare la funzionalità e la durata delle strutture viene prefissato uno stato limite di fessurazione, commisurato alle condi-\nzioni ambientali e di sollecitazione, nonché alla sensibilità delle armature alla corrosione."),
        ih(165, "Strutture in calcestruzzo armato ordinario"),
        p(165, "Per le strutture in calcestruzzo armato ordinario, devono essere rispettate le limitazioni di cui alla Tab. 4.1.IV per armatura poco sensibile."),
        ih(165, "Strutture in calcestruzzo armato precompresso"),
        p(165, "Valgono le limitazioni della Tab. 4.1.IV per armature sensibili."),
    ]},
    { number: "5.1.4.5", title: "VERIFICHE ALLO STATO LIMITE DI DEFORMAZIONE", blocks: [
        h(165, "5.1.4.5", "VERIFICHE ALLO STATO LIMITE DI DEFORMAZIONE"),
        p(165, "L’assetto di una struttura, da valutarsi in base alle combinazioni di carico precedentemente indicate, deve risultare compatibile con la geometria della struttura stessa in relazione alle esigenze del traffico, nonché con i vincoli ed i dispositivi di giunto previsti in progetto."),
        p(165, "Le deformazioni della struttura non devono arrecare disturbo al transito dei carichi mobili alle velocità di progetto della strada."),
    ]},
    { number: "5.1.4.6", title: "VERIFICHE DELLE AZIONI SISMICHE", blocks: [
        h(165, "5.1.4.6", "VERIFICHE DELLE AZIONI SISMICHE"),
        p(165, "Le verifiche nei riguardi delle azioni sismiche vanno svolte secondo i criteri ed i metodi esposti nelle relative sezioni delle presenti Norme.", "Le verifiche nei riguardi delle azioni sismiche vanno svolte secondo i criteri ed i metodi esposti nelle relative sezioni delle presen-\nti Norme."),
    ]},
    { number: "5.1.4.7", title: "VERIFICHE IN FASE DI COSTRUZIONE", blocks: [
        h(166, "5.1.4.7", "VERIFICHE IN FASE DI COSTRUZIONE"),
        p(166, "Le verifiche di sicurezza vanno svolte anche per le singole fasi di costruzione dell’opera, tenendo conto dell’evoluzione dello schema statico e dell’influenza degli effetti differiti nel tempo.", "Le verifiche di sicurezza vanno svolte anche per le singole fasi di costruzione dell’opera, tenendo conto dell’evoluzione dello\nschema statico e dell’influenza degli effetti differiti nel tempo."),
        p(166, "Vanno verificate anche le eventuali centine e le altre attrezzature provvisionali previste per la realizzazione dell’opera."),
    ]},
    { number: "5.1.5", title: "STRUTTURE PORTANTI", blocks: [h(166, "5.1.5", "STRUTTURE PORTANTI") ] },
    { number: "5.1.5.1", title: "IMPALCATO", blocks: [h(166, "5.1.5.1", "IMPALCATO")] },
    { number: "5.1.5.1.1", title: "SPESSORI MINIMI", blocks: [
        h(166, "5.1.5.1.1", "SPESSORI MINIMI"),
        p(166, "Gli spessori minimi delle diverse parti costituenti l’impalcato devono tener conto dell’influenza dei fattori ambientali sulla durabilità dell’opera e rispettare le prescrizioni delle norme relative ai singoli elementi strutturali.", "Gli spessori minimi delle diverse parti costituenti l’impalcato devono tener conto dell’influenza dei fattori ambientali sulla dura-\nbilità dell’opera e rispettare le prescrizioni delle norme relative ai singoli elementi strutturali."),
    ]},
    { number: "5.1.5.1.2", title: "STRUTTURE AD ELEMENTI PREFABBRICATI", blocks: [
        h(166, "5.1.5.1.2", "STRUTTURE AD ELEMENTI PREFABBRICATI"),
        p(166, "Nelle strutture costruite in tutto o in parte con elementi prefabbricati, al fine di evitare sovratensioni, distorsioni o danneggiamenti dovuti a difetti esecutivi o di montaggio, deve essere assicurata la compatibilità geometrica tra le diverse parti assemblate, tenendo anche conto delle tolleranze costruttive.", "Nelle strutture costruite in tutto o in parte con elementi prefabbricati, al fine di evitare sovratensioni, distorsioni o danneggia-\nmenti dovuti a difetti esecutivi o di montaggio, deve essere assicurata la compatibilità geometrica tra le diverse parti assemblate,\ntenendo anche conto delle tolleranze costruttive."),
        p(166, "Gli elementi di connessione tra le parti collegate devono essere conformati in modo da garantire la corretta trasmissione degli sforzi."),
        p(166, "Nel caso di elementi in calcestruzzo armato normale e precompresso e di strutture miste acciaio-calcestruzzo vanno considerate le redistribuzioni di sforzo differite nel tempo che si manifestano tra parti realizzate o sottoposte a carico in tempi successivi e le analoghe redistribuzioni che derivano da variazioni dei vincoli.", "Nel caso di elementi in calcestruzzo armato normale e precompresso e di strutture miste acciaio-calcestruzzo vanno considerate\nle redistribuzioni di sforzo differite nel tempo che si manifestano tra parti realizzate o sottoposte a carico in tempi successivi e le\nanaloghe redistribuzioni che derivano da variazioni dei vincoli."),
    ]},
    { number: "5.1.5.2", title: "PILE", blocks: [h(166, "5.1.5.2", "PILE", "5.1.5.2 P ILE")] },
    { number: "5.1.5.2.1", title: "SPESSORI MINIMI", blocks: [
        h(166, "5.1.5.2.1", "SPESSORI MINIMI"),
        p(166, "Vale quanto già indicato al comma precedente per le strutture dell’impalcato."),
    ]},
    { number: "5.1.5.2.2", title: "SCHEMATIZZAZIONE E CALCOLO", blocks: [
        h(166, "5.1.5.2.2", "SCHEMATIZZAZIONE E CALCOLO"),
        p(166, "Nella verifica delle pile snelle, particolare attenzione deve essere rivolta alla valutazione delle effettive condizioni di vincolo, specialmente riguardo l’interazione con le opere di fondazione.", "Nella verifica delle pile snelle, particolare attenzione deve essere rivolta alla valutazione delle effettive condizioni di vincolo, spe-\ncialmente riguardo l’interazione con le opere di fondazione."),
        p(166, "Le sommità delle pile deve essere verificata nei confronti degli effetti locali derivanti dalle azioni concentrate trasmesse dagli apparecchi di appoggio.", "Le sommità delle pile deve essere verificata nei confronti degli effetti locali derivanti dalle azioni concentrate trasmesse dagli ap-\parecchi di appoggio."),
        p(166, "Si deve verificare che gli spostamenti consentiti dagli apparecchi di appoggio siano compatibili con gli spostamenti massimi alla sommità delle pile, provocati dalle combinazioni delle azioni più sfavorevoli e, nelle pile alte, dalla differenza di temperatura tra le facce delle pile stesse.", "Si deve verificare che gli spostamenti consentiti dagli apparecchi di appoggio siano compatibili con gli spostamenti massimi alla\nsommità delle pile, provocati dalle combinazioni delle azioni più sfavorevoli e, nelle pile alte, dalla differenza di temperatura tra le\facce delle pile stesse."),
    ]},
    { number: "5.1.6", title: "VINCOLI", blocks: [
        h(166, "5.1.6", "VINCOLI"),
        p(166, "I dispositivi di vincolo dell’impalcato alle sottostrutture (pile, spalle, fondazioni) devono possedere le caratteristiche previste dallo schema statico e cinematico assunto in sede di progetto, sia con riferimento alle azioni, sia con riferimento alle distorsioni.", "I dispositivi di vincolo dell’impalcato alle sottostrutture (pile, spalle, fondazioni) devono possedere le caratteristiche previste dal-\nlo schema statico e cinematico assunto in sede di progetto, sia con riferimento alle azioni, sia con riferimento alle distorsioni."),
        p(166, "Per strutture realizzate in più fasi, i vincoli devono assicurare un corretto comportamento statico e cinematico in ogni fase dell’evoluzione dello schema strutturale, adeguandosi, se del caso, ai cambiamenti di schema."),
        p(166, "Le singole parti del dispositivo di vincolo ed i relativi ancoraggi devono essere dimensionati in base alle forze vincolari trasmesse."),
        p(166, "I dispositivi di vincolo devono essere tali da consentire tutti gli spostamenti previsti con un margine di sicurezza maggiore rispetto a quello assunto per gli altri elementi strutturali.", "I dispositivi di vincolo devono essere tali da consentire tutti gli spostamenti previsti con un margine di sicurezza maggiore rispet-\nto a quello assunto per gli altri elementi strutturali."),
        p(166, "Particolare attenzione va rivolta al funzionamento dei vincoli in direzione trasversale rispetto all’asse longitudinale dell’impalcato, la cui configurazione deve corrispondere ad uno schema statico e cinematico ben definito."),
        p(166, "La scelta e la disposizione dei vincoli nei ponti a pianta speciale (ponti in curva, ponti in obliquo, ponti con geometria in pianta irregolare) devono derivare da un adeguato studio di capacità statica e di compatibilità cinematica.", "La scelta e la disposizione dei vincoli nei ponti a pianta speciale (ponti in curva, ponti in obliquo, ponti con geometria in pianta irre-\golare) devono derivare da un adeguato studio di capacità statica e di compatibilità cinematica."),
    ]},
    { number: "5.1.6.1", title: "PROTEZIONE DEI VINCOLI", blocks: [
        h(166, "5.1.6.1", "PROTEZIONE DEI VINCOLI", "5.1.6.1 P ROTEZIONE DEI VINCOLI"),
        p(166, "Le varie parti dei dispositivi di vincolo devono essere adeguatamente protette, al fine di garantirne il regolare funzionamento per il periodo di esercizio previsto."),
    ]},
    { number: "5.1.6.2", title: "CONTROLLO, MANUTENZIONE E SOSTITUZIONE", blocks: [
        h(166, "5.1.6.2", "CONTROLLO, MANUTENZIONE E SOSTITUZIONE"),
        p(166, "I vincoli del ponte devono essere accessibili al fine di consentirne il controllo, la manutenzione e l’eventuale sostituzione senza eccessiva difficoltà."),
    ]},
    { number: "5.1.6.3", title: "VINCOLI IN ZONA SISMICA", blocks: [
        h(167, "5.1.6.3", "VINCOLI IN ZONA SISMICA"),
        p(167, "Per i ponti in zona sismica, i vincoli devono essere progettati in modo che, tenendo conto del comportamento dinamico dell’opera, risultino idonei:"),
        li(167, "a trasmettere le forze conseguenti alle azioni sismiche", "- a trasmettere le forze conseguenti alle azioni sismiche"),
        li(167, "ad evitare sconnessioni tra gli elementi componenti il dispositivo di vincolo", "- ad evitare sconnessioni tra gli elementi componenti il dispositivo di vincolo"),
        li(167, "ad evitare la fuoriuscita dei vincoli dalle loro sedi.", "- ad evitare la fuoriuscita dei vincoli dalle loro sedi."),
    ]},
    { number: "5.1.7", title: "OPERE ACCESSORIE", blocks: [
        h(167, "5.1.7", "OPERE ACCESSORIE"),
        p(167, "Le opere di impermeabilizzazione e di pavimentazione, i giunti e tutte le opere accessorie, devono essere eseguiti con materiali di qualità e con cura esecutiva tali da garantire la massima durata e tali da ridurre interventi di manutenzione e rifacimenti."),
    ]},
    { number: "5.1.7.1", title: "IMPERMEABILIZZAZIONE", blocks: [
        h(167, "5.1.7.1", "IMPERMEABILIZZAZIONE"),
        p(167, "Le opere di impermeabilizzazione devono essere tali da evitare che infiltrazioni d’acqua possano arrecare danno alle strutture portanti."),
    ]},
    { number: "5.1.7.2", title: "PAVIMENTAZIONI", blocks: [
        h(167, "5.1.7.2", "PAVIMENTAZIONI", "5.1.7.2 P AVIMENTAZIONI"),
        p(167, "La pavimentazione stradale deve essere tale da sottrarre all’usura ed alla diretta azione del traffico l’estradosso del ponte e gli strati di impermeabilizzazione che proteggono le strutture portanti."),
    ]},
    { number: "5.1.7.3", title: "GIUNTI", blocks: [
        h(167, "5.1.7.3", "GIUNTI"),
        p(167, "In corrispondenza delle interruzioni strutturali si devono adottare dispositivi di giunto atti ad assicurare la continuità del piano viabile. Le caratteristiche dei giunti e le modalità del loro collegamento alla struttura devono essere tali da ridurre il più possibile le sovrasollecitazioni di natura dinamica dovute ad irregolarità locali e da assicurare la migliore qualità dei transiti.", "In corrispondenza delle interruzioni strutturali si devono adottare dispositivi di giunto atti ad assicurare la continuità del piano\nviabile. Le caratteristiche dei giunti e le modalità del loro collegamento alla struttura devono essere tali da ridurre il più possibile le\nsovrasollecitazioni di natura dinamica dovute ad irregolarità locali e da assicurare la migliore qualità dei transiti."),
        p(167, "In corrispondenza dei giunti si deve impedire la percolazione delle acque meteoriche o di lavaggio attraverso i giunti stessi. Nel caso di giunti che consentano il passaggio delle acque, queste devono confluire in appositi dispositivi di raccolta, collocati immediatamente sotto il giunto, e devono essere convogliate a scaricarsi senza possibilità di ristagni o dilavamenti che interessino le strutture."),
    ]},
    { number: "5.1.7.4", title: "SMALTIMENTO DEI LIQUIDI PROVENIENTI DALL’IMPALCATO", blocks: [
        h(167, "5.1.7.4", "SMALTIMENTO DEI LIQUIDI PROVENIENTI DALL’IMPALCATO", "5.1.7.4 S MALTIMENTO DEI LIQUIDI PROVENIENTI DALL’IMPALCATO"),
        p(167, "Lo smaltimento dei liquidi provenienti dall’impalcato deve effettuarsi in modo da non arrecare danni o pregiudizio all’opera stessa, alla sicurezza del traffico e ad eventuali opere ed esercizi sottostanti il ponte. A tale scopo il progetto del ponte deve essere corredato dallo schema delle opere di convogliamento e di scarico. Per opere di particolare importanza, o per la natura dell’opera stessa o per la natura dell’ambiente circostante, si deve prevedere la realizzazione di un apposito impianto di depurazione e/o di decantazione.", "Lo smaltimento dei liquidi provenienti dall’impalcato deve effettuarsi in modo da non arrecare danni o pregiudizio all’opera\nstessa, alla sicurezza del traffico e ad eventuali opere ed esercizi sottostanti il ponte. A tale scopo il progetto del ponte deve essere\ncorredato dallo schema delle opere di convogliamento e di scarico. Per opere di particolare importanza, o per la natura dell’opera\nstessa o per la natura dell’ambiente circostante, si deve prevedere la realizzazione di un apposito impianto di depurazione e/o di\ndecantazione."),
    ]},
    { number: "5.1.7.5", title: "DISPOSITIVI PER L’ISPEZIONABILITÀ E LA MANUTENZIONE DELLE OPERE", blocks: [
        h(167, "5.1.7.5", "DISPOSITIVI PER L’ISPEZIONABILITÀ E LA MANUTENZIONE DELLE OPERE", "5.1.7.5 D ISPOSITIVI PER L’ISPEZIONABILITÀ E LA MANUTENZIONE DELLE OPERE"),
        p(167, "In sede di progettazione e di esecuzione devono essere previste opere di camminamento (piattaforme, scale, passi d’uomo, ecc.) commisurate all’importanza del ponte e tali da consentire l’accesso alle parti più importanti sia ai fini ispettivi, sia ai fini manutentivi. Le zone nell’intorno di parti destinate alla sostituzione periodica, quali ad esempio gli appoggi, devono essere corredate di punti di forza, chiaramente individuabili e tali da consentire le operazioni di sollevamento e di vincolamento provvisorio.", "In sede di progettazione e di esecuzione devono essere previste opere di camminamento (piattaforme, scale, passi d’uomo, ecc.)\ncommisurate all’importanza del ponte e tali da consentire l’accesso alle parti più importanti sia ai fini ispettivi, sia ai fini manu-\ntentivi. Le zone nell’intorno di parti destinate alla sostituzione periodica, quali ad esempio gli appoggi, devono essere corredate\ndi punti di forza, chiaramente individuabili e tali da consentire le operazioni di sollevamento e di vincolamento provvisorio."),
    ]},
    { number: "5.1.7.6", title: "VANI PER CONDOTTE E CAVIDOTTI", blocks: [
        h(167, "5.1.7.6", "VANI PER CONDOTTE E CAVIDOTTI", "5.1.7.6 V ANI PER CONDOTTE E CAVIDOTTI"),
        p(167, "La struttura del ponte dovrà comunque prevedere la possibilità di passaggio di cavi e di una condotta di acquedotto; le dimensioni dei vani dovranno essere rapportate alle prevedibili esigenze da valutare con riferimento a quanto presente in prossimità del ponte.", "La struttura del ponte dovrà comunque prevedere la possibilità di passaggio di cavi e di una condotta di acquedotto; le dimen-\nsioni dei vani dovranno essere rapportate alle prevedibili esigenze da valutare con riferimento a quanto presente in prossimità\ndel ponte."),
    ]},
    { number: "5.2", title: "PONTI FERROVIARI", blocks: [
        h(167, "5.2", "PONTI FERROVIARI"),
        p(167, "Le presenti norme si applicano per la progettazione e l’esecuzione dei nuovi ponti ferroviari."),
        p(167, "Il gestore dell’infrastruttura in base alle caratteristiche funzionali e strategiche delle diverse infrastrutture ferroviarie stabilisce i parametri indicati al Capitolo 2: vita nominale, classe d’uso.", "Il gestore dell’infrastruttura in base alle caratteristiche funzionali e strategiche delle diverse infrastrutture ferroviarie stabilisce i\nparametri indicati al Capitolo 2: vita nominale, classe d’uso."),
    ]},
    { number: "5.2.1", title: "PRINCIPALI CRITERI PROGETTUALI E MANUTENTIVI", blocks: [
        h(167, "5.2.1", "PRINCIPALI CRITERI PROGETTUALI E MANUTENTIVI"),
        p(167, "La progettazione dei manufatti sotto binario deve essere eseguita in modo da conseguire il migliore risultato globale dal punto di vista tecnico-economico, con particolare riguardo alla durabilità dell’opera stessa."),
    ]},
    { number: "5.2.1.1", title: "ISPEZIONABILITÀ E MANUTENZIONE", blocks: [
        h(167, "5.2.1.1", "ISPEZIONABILITÀ E MANUTENZIONE"),
        p(167, "Fin dalla fase di progettazione deve essere posta la massima cura nella concezione generale dell’opera e nella definizione delle geometrie e dei particolari costruttivi in modo da rendere possibile l’accessibilità e l’ispezionabilità, nel rispetto delle norme di sicurezza, di tutti gli elementi strutturali. Deve essere garantita la piena ispezionabilità degli apparecchi d’appoggio e degli eventuali organi di ritegno. Deve inoltre essere prevista la possibilità di sostituire questi elementi con la minima interferenza con l’esercizio ferroviario; a tale scopo i disegni di progetto devono fornire tutte le indicazioni al riguardo (numero, posizione e portata dei martinetti per il sollevamento degli impalcati, procedure da seguire anche per la sostituzione degli stessi apparecchi, ecc.).", "Fin dalla fase di progettazione deve essere posta la massima cura nella concezione generale dell’opera e nella definizione delle geometrie e dei particolari costruttivi in modo da rendere possibile l’accessibilità e l’ispezionabilità, nel rispetto delle norme di sicurezza, di tutti gli elementi strutturali. Deve essere garantita la piena ispezionabilità degli apparecchi d’appoggio e degli even-\ntuali organi di ritegno. Deve inoltre essere prevista la possibilità di sostituire questi elementi con la minima interferenza con\nl’esercizio ferroviario; a tale scopo i disegni di progetto devono fornire tutte le indicazioni al riguardo (numero, posizione e porta-\nta dei martinetti per il sollevamento degli impalcati, procedure da seguire anche per la sostituzione degli stessi apparecchi, ecc.)."),
    ]},
    { number: "5.2.1.2", title: "COMPATIBILITÀ IDRAULICA", blocks: [
        h(168, "5.2.1.2", "COMPATIBILITÀ IDRAULICA"),
        p(168, "Si rimanda integralmente al paragrafo 5.1.2.3."),
    ]},
    { number: "5.2.1.3", title: "ALTEZZA LIBERA", blocks: [
        h(168, "5.2.1.3", "ALTEZZA LIBERA", "5.2.1.3 A LTEZZA LIBERA"),
        p(168, "Si rimanda integralmente al paragrafo 5.1.2.2."),
    ]},
    { number: "5.2.2", title: "AZIONI SULLE OPERE", blocks: [
        h(168, "5.2.2", "AZIONI SULLE OPERE"),
        p(168, "Nell’ambito della presente norma sono indicate tutte le azioni che devono essere considerate nella progettazione dei ponti ferroviari, secondo le combinazioni indicate nei successivi paragrafi.", "Nell’ambito della presente norma sono indicate tutte le azioni che devono essere considerate nella progettazione dei ponti ferro-\nviari, secondo le combinazioni indicate nei successivi paragrafi."),
        p(168, "Le azioni definite in questo documento si applicano alle linee ferroviarie a scartamento normale e ridotto."),
    ]},
    { number: "5.2.2.1", title: "AZIONI PERMANENTI", blocks: [
        h(168, "5.2.2.1", "AZIONI PERMANENTI", "5.2.2.1 A ZIONI PERMANENTI"),
        p(168, "Le azioni permanenti che devono essere considerate sono: pesi propri, carichi permanenti portati, spinta delle terre, spinte idrauliche, ecc."),
    ]},
    { number: "5.2.2.1.1", title: "CARICHI PERMANENTI PORTATI", blocks: [
        h(168, "5.2.2.1.1", "CARICHI PERMANENTI PORTATI"),
        p(168, "Ove non si eseguano valutazioni più dettagliate, la determinazione dei carichi permanenti portati relativi al peso della massicciata, dell’armamento e della impermeabilizzazione (inclusa la protezione) potrà effettuarsi assumendo, convenzionalmente, per linea in rettifilo, un peso di volume pari a 18,0 kN/m³ applicato su tutta la larghezza media compresa fra i muretti paraballast, per una altezza media fra piano del ferro (P.F.) ed estradosso impalcato pari a 0,80 m. Per ponti su linee in curva, oltre al peso convenzionale sopraindicato va aggiunto il peso di tutte le parti di massicciata necessarie per realizzare il sovralzo, valutato con la sua reale distribuzione geometrica e con un peso di volume pari a 20 kN/m³.", "Ove non si eseguano valutazioni più dettagliate, la determinazione dei carichi permanenti portati relativi al peso della massiccia-\nta, dell’armamento e della impermeabilizzazione (inclusa la protezione) potrà effettuarsi assumendo, convenzionalmente, per li-\nnea in rettifilo, un peso di volume pari a 18,0 kN/m³ applicato su tutta la larghezza media compresa fra i muretti paraballast, per\nuna altezza media fra piano del ferro (P.F.) ed estradosso impalcato pari a 0,80 m. Per ponti su linee in curva, oltre al peso con-\nvenzionale sopraindicato va aggiunto il peso di tutte le parti di massicciata necessarie per realizzare il sovralzo, valutato con la\nsua reale distribuzione geometrica e con un peso di volume pari a 20 kN/m³."),
        p(168, "Nel caso di armamento senza massicciata devono essere valutati i pesi dei singoli componenti e le relative distribuzioni."),
        p(168, "Nella progettazione di nuovi ponti ferroviari dovranno essere sempre considerati i pesi, le azioni e gli ingombri associati all’introduzione delle barriere antirumore, anche nei casi in cui non sia originariamente prevista la realizzazione di questo genere di elementi."),
        p(168, "Sono da considerare tra i carichi permanenti portati anche il peso delle eventuali finiture, il sistema di smaltimento acque, etc.."),
    ]},
    { number: "5.2.2.2", title: "AZIONI VARIABILI VERTICALI", blocks: [h(168, "5.2.2.2", "AZIONI VARIABILI VERTICALI")] },
    { number: "5.2.2.2.1", title: "MODELLI DI CARICO", blocks: [
        h(168, "5.2.2.2.1", "MODELLI DI CARICO"),
        p(168, "I carichi verticali associati al transito dei convogli ferroviari sono definiti per mezzo di diversi modelli di carico rappresentativi delle diverse tipologie di traffico ferroviario: normale e pesante."),
        p(168, "I valori dei suddetti carichi dovranno essere moltiplicati per un coefficiente di adattamento “α”, variabile in ragione della tipologia dell’infrastruttura (ferrovie ordinarie, ferrovie leggere, metropolitane, ecc.). Per le ferrovie ordinarie il valore del coefficiente di adattamento “α” da adottarsi per i diversi modelli di carico è definito nei relativi paragrafi; per le ferrovie leggere, metropolitane, ecc., il valore del coefficiente “α” è definito in funzione della specificità dell’infrastruttura stessa. Sono considerate tre tipologie di carico i cui valori caratteristici sono definiti nei successivi paragrafi. Nel seguito, i riferimenti ai modelli di carico LM 71, SW/0 e SW/2 ed alle loro componenti si intendono, in effetti, pari al prodotto dei coefficienti α per i carichi indicati nelle Fig. 5.2.1 e Fig. 5.2.2.", "I valori dei suddetti carichi dovranno essere moltiplicati per un coefficiente di adattamento “D”, variabile in ragione della tipologia dell’infrastruttura (ferrovie ordinarie, ferrovie leggere, metropolitane, ecc.). Per le ferrovie ordinarie il valore del coefficiente di adat-\ntamento “D” da adottarsi per i diversi modelli di carico è definito nei relativi paragrafi; per le ferrovie leggere, metropolitane, ecc., il\nvalore del coefficiente “D” è definito in funzione della specificità dell’infrastruttura stessa. Sono considerate tre tipologie di carico i\ncui valori caratteristici sono definiti nei successivi paragrafi. Nel seguito, i riferimenti ai modelli di carico LM 71, SW/0 e SW/2 ed alle\nloro componenti si intendono, in effetti, pari al prodotto dei coefficienti ΅ per i carichi indicati nelle Fig. 5.2.1 e Fig. 5.2.2."),
    ]},
    { number: "5.2.2.2.1.1", title: "MODELLO DI CARICO LM 71", blocks: [
        h(168, "5.2.2.2.1.1", "MODELLO DI CARICO LM 71"),
        p(168, "Questo modello di carico schematizza gli effetti statici prodotti dal traffico ferroviario normale come mostrato nella Fig. 5.2.1 e risulta costituito da:"),
        ref("figure-ref", 168, "5.2.1"),
        li(168, "quattro assi da 250 kN disposti ad interasse di 1,60 m;", "- quattro assi da 250 kN disposti ad interasse di 1,60 m;"),
        li(168, "carico distribuito di 80 kN/m in entrambe le direzioni, a partire da 0,8 m dagli assi d’estremità e per una lunghezza illimitata.", "- carico distribuito di 80 kN/m in entrambe le direzioni, a partire da 0,8 m dagli assi d’estremità e per una lunghezza illimitata."),
        p(169, "Per questo modello di carico è prevista una eccentricità del carico rispetto all’asse del binario, dipendente dallo scartamento s, per tenere conto dello spostamento dei carichi; pertanto, essa è indipendente dal tipo di struttura e di armamento. Tale eccentricità è calcolata sulla base del rapporto massimo fra i carichi afferenti a due ruote appartenenti al medesimo asse"),
        ref("formula-ref", 169, "5.2.1"),
        p(169, "essendo QV1 e QV2 i carichi verticali delle ruote di un medesimo asse, e risulta quindi pari a s/18 con s = 1435 mm; questa eccentricità deve essere considerata nella direzione più sfavorevole.", "essendo Q V1 e Q V2 i carichi verticali delle ruote di un medesimo asse, e risulta quindi pari a s/18 con s= 1435 mm; questa eccentri-\ncità deve essere considerata nella direzione più sfavorevole."),
        p(169, "Il carico distribuito presente alle estremità del treno tipo LM 71 deve segmentarsi al di sopra dell’opera andando a caricare solo quelle parti che forniscono un incremento del contributo ai fini della verifica dell’elemento per l’effetto considerato. Questa operazione di segmentazione non va effettuata per i successivi modelli di carico SW che devono essere considerati sempre agenti per tutta la loro estensione. Il valore del coefficiente di adattamento “α” da adottarsi per il modello di carico LM71 nella progettazione di ferrovie ordinarie è pari a 1,1.", "Il carico distribuito presente alle estremità del treno tipo LM 71 deve segmentarsi al di sopra dell’opera andando a caricare solo\nquelle parti che forniscono un incremento del contributo ai fini della verifica dell’elemento per l’effetto considerato. Questa ope-\nrazione di segmentazione non va effettuata per i successivi modelli di carico SW che devono essere considerati sempre agenti per\ntutta la loro estensione. Il valore del coefficiente di adattamento “D” da adottarsi per il modello di carico LM71 nella progettazio-\nne di ferrovie ordinarie è pari a 1,1."),
    ]},
    { number: "5.2.2.2.1.2", title: "MODELLI DI CARICO SW", blocks: [
        h(169, "5.2.2.2.1.2", "MODELLI DI CARICO SW"),
        ref("figure-ref", 169, "5.2.2"),
        p(169, "Il modello di carico SW è illustrato in Fig. 5.2.2; per tale modello di carico, sono considerate due distinte configurazioni denominate SW/0 ed SW/2."),
        p(169, "Il modello di carico SW/0 schematizza gli effetti statici prodotti dal traffico ferroviario normale per travi continue (esso andrà utilizzato solo per le travi continue qualora più sfavorevole dell’LM71)."),
        p(169, "Il modello di carico SW/2 schematizza gli effetti statici prodotti dal traffico ferroviario pesante."),
        p(169, "Le caratterizzazioni di entrambe queste configurazioni sono indicate in Tab. 5.2.I."),
        ref("table-ref", 169, "5.2.i"),
        p(169, "Il valore del coefficiente di adattamento “α” da adottarsi nella progettazione delle ferrovie ordinarie è pari, rispettivamente, a 1,1 per il modello di carico SW/0 ed a 1,0 per il modello di carico SW/2."),
    ]},
    { number: "5.2.2.2.1.3", title: "TRENO SCARICO", blocks: [
        h(169, "5.2.2.2.1.3", "TRENO SCARICO"),
        p(169, "Per alcune particolari verifiche è previsto un ulteriore particolare modello di carico denominato “Treno scarico” rappresentato da un carico uniformemente distribuito pari a 10,0 kN/m."),
    ]},
    { number: "5.2.2.2.1.4", title: "RIPARTIZIONE LOCALE DEI CARICHI", blocks: [
        h(169, "5.2.2.2.1.4", "RIPARTIZIONE LOCALE DEI CARICHI", "5.2.2.2.1.4 R ipartizione locale dei carichi."),
        ih(169, "Distribuzione longitudinale del carico per mezzo del binario"),
        p(169, "Un carico assiale Qvi può essere distribuito su tre traverse consecutive poste ad interasse uniforme “a”, ripartendolo fra la traversa che la precede, quella su cui insiste e quella successiva, nelle seguenti proporzioni 25%, 50%, 25% (Fig. 5.2.3).", "Un carico assiale Qvi può essere distribuito su tre traverse consecutive poste ad interasse uniforme “a”, ripartendolo fra la traver-\nsa che la precede, quella su cui insiste e quella successiva, nelle seguenti proporzioni 25%, 50%, 25% (Fig. 5.2.3)."),
        ref("figure-ref", 169, "5.2.3"),
        ih(169, "Distribuzione longitudinale del carico per mezzo delle traverse e del ballast"),
        p(169, "In generale, i carichi assiali del modello di carico LM71 possono essere distribuiti uniformemente nel senso longitudinale."),
        ref("figure-ref", 170, "5.2.4"),
        p(170, "Tuttavia, per il progetto di particolari elementi strutturali quali le solette degli impalcati da ponte, la distribuzione longitudinale del carico assiale al di sotto delle traverse è indicata in Fig. 5.2.4 ove, per superficie di riferimento è da intendersi la superficie di appoggio del ballast."),
        p(170, "Per la ripartizione nella struttura sottostante valgono gli usuali criteri progettuali."),
        p(170, "In particolare, per le solette, salvo diverse e più accurate determinazioni, potrà considerarsi una ripartizione a 45° dalla superficie di estradosso fino al piano medio delle stesse."),
        ih(170, "Distribuzione trasversale delle azioni per mezzo delle traverse e del ballast"),
        p(170, "Salvo più accurate determinazioni, per ponti con armamento su ballast in rettifilo, le azioni possono distribuirsi trasversalmente secondo lo schema di Fig. 5.2.5."),
        ref("figure-ref", 170, "5.2.5"),
        p(170, "Per ponti con armamento su ballast in curva, con sovralzo “u”, le azioni possono distribuirsi trasversalmente secondo lo schema di Fig. 5.2.6."),
        ref("figure-ref", 170, "5.2.6"),
    ]},
    { number: "5.2.2.2.1.5", title: "DISTRIBUZIONE DEI CARICHI VERTICALI PER I RILEVATI A TERGO DELLE SPALLE", blocks: [
        h(170, "5.2.2.2.1.5", "DISTRIBUZIONE DEI CARICHI VERTICALI PER I RILEVATI A TERGO DELLE SPALLE"),
        p(170, "In assenza di calcoli più accurati, il carico verticale a livello del piano di regolamento (posto a circa 0,70 m al di sotto del piano del ferro) su rilevato a tergo della spalla può essere assunto uniformemente distribuito su una larghezza di 3,0 m.", "In assenza di calcoli più accurati, il carico verticale a livello del piano di regolamento (posto a circa 0,70 m al di sotto del piano del\nferro) su rilevato a tergo della spalla può essere assunto uniformemente distribuito su una larghezza di 3,0 m."),
        p(170, "Per questo tipo di carico distribuito non deve applicarsi l’incremento dinamico."),
    ]},
    { number: "5.2.2.2.2", title: "CARICHI SUI MARCIAPIEDI", blocks: [
        h(171, "5.2.2.2.2", "CARICHI SUI MARCIAPIEDI"),
        p(171, "I marciapiedi non aperti al pubblico possono essere utilizzati solo dal personale autorizzato."),
        p(171, "I carichi accidentali devono essere schematizzati da un carico uniformemente ripartito del valore di 10 kN/m². Questo carico non deve considerarsi contemporaneo al transito dei convogli ferroviari e deve essere applicato sopra i marciapiedi in modo da dare luogo agli effetti locali più sfavorevoli.", "I carichi accidentali devono essere schematizzati da un carico uniformemente ripartito del valore di 10 kN/m². Questo carico non\ndeve considerarsi contemporaneo al transito dei convogli ferroviari e deve essere applicato sopra i marciapiedi in modo da dare\nluogo agli effetti locali più sfavorevoli."),
        p(171, "Per questo tipo di carico distribuito non deve applicarsi l’incremento dinamico."),
    ]},
];

const pageRecords = new Map<number, any>();
for (const page of Array.from({ length: 10 }, (_, index) => index + 162)) {
    const filename = join(root, "evidence", sourceId, "pages", `page-${String(page).padStart(4, "0")}.json`);
    pageRecords.set(page, JSON.parse(await readFile(filename, "utf8")));
}
function region(page: number) {
    const record = pageRecords.get(page);
    return { coordinateSystem: "pdf-points-top-left", x: 73, y: 75, width: 455, height: record?.page?.height ? Math.min(680, record.page.height - 100) : 670 };
}
function transformations(raw: string, normalized: string): any[] {
    if (raw === normalized) return [];
    return [
        { operation: "remove-control-character", ruleVersion, note: "Rimossi caratteri di controllo privi di resa visuale." },
        { operation: "remove-discretionary-hyphen", ruleVersion, note: "Unite le parole divise esclusivamente dall’andata a capo tipografica." },
        { operation: "join-line-wrap", ruleVersion, note: "Rimosse le andate a capo di impaginazione, conservando capoversi ed elenchi." },
        { operation: "manual-correction", ruleVersion, note: "Ripristinati i glifi matematici e i caratteri riconoscibili nel render ufficiale." },
        { operation: "normalize-whitespace", ruleVersion, note: "Uniformati gli spazi dopo la ricomposizione delle righe." },
        { operation: "unicode-nfc", ruleVersion, note: "Testo normalizzato in Unicode NFC." },
    ];
}
function makeBlock(number: string, index: number, def: Block): any {
    const id = `${unitId(number)}#block-${def.kind === "heading" && index === 0 ? "heading" : `editorial-${String(index).padStart(3, "0")}`}`;
    if (def.kind.endsWith("-ref")) return {
        blockId: id, kind: def.kind, origin: "official", assetId: def.assetId,
        evidence: { sourceId, pdfPage: def.page, printedPage: String(def.page - 4), region: region(def.page), extraction: { method: "manual-transcription", tool: "codex-source-transcription", toolVersion: ruleVersion }, transformations: [{ operation: "manual-correction", ruleVersion, note: "Asset collocato nel punto normativo originario; resta da revisionare puntualmente." }], rawSha256: sha256(def.assetId ?? id), normalizedSha256: sha256(def.assetId ?? id) },
    };
    const normalized = def.text ?? "";
    const raw = def.raw ?? normalized;
    return { blockId: id, kind: def.kind, origin: "official", text: { raw, normalized, normalizationVersion: ruleVersion, inline: def.inline }, evidence: { sourceId, pdfPage: def.page, printedPage: String(def.page - 4), region: region(def.page), extraction: { method: "pdf-text", tool: "pdfjs-dist", toolVersion: "4.10.38" }, transformations: transformations(raw, normalized), rawSha256: sha256(raw), normalizedSha256: sha256(normalized) } };
}
function parent(number: string): string | null { const parts = number.split("."); return parts.length === 1 ? null : parts.slice(0, -1).join("."); }
function ancestors(number: string): string[] { const parts = number.split("."); return Array.from({ length: parts.length - 1 }, (_, index) => unitId(parts.slice(0, index + 1).join("."))); }
function kind(number: string): string { const depth = number.split(".").length; return depth === 1 ? "chapter" : depth === 2 ? "section" : depth === 3 ? "paragraph" : "subparagraph"; }
function makeUnit(def: UnitDef): any {
    const blocks = def.blocks.map((block, index) => makeBlock(def.number, index, block));
    const ids = { formulaIds: blocks.filter((b) => b.assetId?.includes(":formula:")).map((b) => b.assetId), tableIds: blocks.filter((b) => b.assetId?.includes(":table:")).map((b) => b.assetId), figureIds: blocks.filter((b) => b.assetId?.includes(":figure:")).map((b) => b.assetId) };
    const parentId = parent(def.number);
    const issues: any[] = [{ issueId: `ntc2018-${def.number.replaceAll(".", "-")}-source-review`, type: "normalization-review", severity: "blocking", note: "Record trascritto dall’evidence ufficiale ma non ancora confrontato integralmente da un revisore umano con il render della fonte." }];
    if (Object.values(ids).some((items) => items.length)) issues.push({ issueId: `ntc2018-${def.number.replaceAll(".", "-")}-assets`, type: "asset-review", severity: "blocking", note: "Formule, tabelle e figure sono collocate nel punto originario; resta obbligatorio il confronto umano puntuale con la fonte ufficiale." });
    if (def.number === "5.1.4.3") issues.push({ issueId: "ntc2018-5-1-4-3-table-graphics", type: "other", severity: "blocking", note: "Le Tabelle 5.1.VII, 5.1.VIII e 5.1.IX contengono sagome e schemi grafici nelle celle. Il modello asset corrente conserva le celle e i dati testuali/numerici ma non rappresenta immagini incorporate: completare la revisione con il PDF ufficiale prima della pubblicazione." });
    return { $schema: "urn:structural-codes:schema:canonical-unit:v2", schemaVersion: "2.0.0-alpha.2", recordType: "canonical-unit", id: unitId(def.number), workId, expressionId, kind: kind(def.number), numbering: { official: def.number, sortKey: def.number.split(".").map((part) => part.padStart(3, "0")).join(".") }, title: def.title, titleBlockId: `${unitId(def.number)}#block-heading`, hierarchy: { parentId: parentId ? unitId(parentId) : null, ancestorIds: ancestors(def.number), position: Number(def.number.split(".").at(-1)) }, validity: { from: "2018-03-22", to: null, status: "in-force", asOf: "2026-08-09" }, blocks, citations: [], relations: [], assets: ids, workflow: { status: "extracted", createdBy: { actorId: "codex:ntc5-step2", kind: "automated-agent", toolVersion: ruleVersion }, createdAt, reviews: [], openIssues: issues } };
}

function inferredCellLatex(text: string): string | undefined {
    if (!/^\d+(?:,\d+)?(?:\n\d+(?:,\d+)?)*$/u.test(text)) return undefined;
    const values = text.split("\n").map((value) => value.replace(",", "{,}"));
    return values.length === 1 ? values[0] : `\\begin{gathered}${values.join("\\\\")}\\end{gathered}`;
}
const cell = (text: string, extra: Record<string, unknown> = {}) => {
    const inferred = inferredCellLatex(text);
    return { text, ...(inferred ? { latex: inferred } : {}), ...extra };
};
const table = (suffix: string, number: string, page: number, caption: string, headers: any[][], rows: any[][], notes: string[] = []) => ({ id: asset("table", suffix), unitId: unitId("5.1.4.3"), officialNumber: number, pdfPage: page, caption, columnCount: Math.max(...headers.concat(rows).map((row) => row.length)), headers, rows, notes });
const assetManifest: any = {
    $schema: "urn:structural-codes:schema:asset-manifest:v2", schemaVersion: "2.0.0-alpha.1", recordType: "asset-manifest", document: "ntc2018", section: "5.1-step2", sourceId, status: "transcribed-unreviewed",
    formulas: [{ id: asset("formula", "5.2.1"), unitId: unitId("5.2.2.2.1.1"), officialNumber: "5.2.1", pdfPage: 169, latex: "\\frac{Q_{v2}}{Q_{v1}}=1{,}25" }],
    tables: [
        table("5.1.vii", "5.1.VII", 163, "Tab. 5.1.VII - Modello di carico di fatica 2 – veicoli frequenti", [[cell("Sagoma del veicolo"), cell("Distanza tra gli assi (m)", { latex: "\\text{Distanza tra gli assi }(\\mathrm{m})" }), cell("Carico frequente per asse (kN)", { latex: "\\text{Carico frequente per asse }(\\mathrm{kN})" }), cell("Tipo di ruota (Tab. 5.1.IX)")]], [
            [cell(""), cell("4,50"), cell("90\n190"), cell("A\nB")], [cell(""), cell("4,20\n1,30"), cell("80\n140\n140"), cell("A\nB\nB")], [cell(""), cell("3,20\n5,20\n1,30\n1,30"), cell("90\n180\n120\n120\n120"), cell("A\nB\nC\nC\nC")], [cell(""), cell("3,40\n6,00\n1,80"), cell("90\n190\n140\n140"), cell("A\nB\nB\nB")], [cell(""), cell("4,80\n3,60\n4,40\n1,30"), cell("90\n180\n120\n110\n110"), cell("A\nB\nC\nC\nC")],
        ], ["La prima colonna contiene la sagoma grafica ufficiale del veicolo; il modello corrente non supporta immagini incorporate nelle celle."]),
        table("5.1.viii", "5.1.VIII", 164, "Tab. 5.1.VIII - Modello di carico di fatica 4 – veicoli equivalenti", [[cell("Sagoma del veicolo"), cell("Tipo di pneumatico (Tab. 5.1.IX)"), cell("Interassi [m]", { latex: "\\text{Interassi }[\\mathrm{m}]" }), cell("Valori equivalenti dei carichi per asse [kN]", { latex: "\\text{Valori equivalenti dei carichi per asse }[\\mathrm{kN}]" }), cell("Lunga percorrenza"), cell("Media percorrenza"), cell("Traffico locale")]], [
            [cell(""), cell("A\nB"), cell("4,50"), cell("70\n130"), cell("20,0"), cell("40,0"), cell("80,0")], [cell(""), cell("A\nB\nB"), cell("4,20\n1,30"), cell("70\n120\n120"), cell("5,0"), cell("10,0"), cell("5,0")], [cell(""), cell("A\nB\nC\nC\nC"), cell("3,20\n5,20\n1,30\n1,30"), cell("70\n150\n90\n90\n90"), cell("50,0"), cell("30,0"), cell("5,0")], [cell(""), cell("A\nB\nB\nB"), cell("3,40\n6,00\n1,80"), cell("70\n140\n90\n90"), cell("15,0"), cell("15,0"), cell("5,0")], [cell(""), cell("A\nB\nC\nC\nC"), cell("4,80\n3,60\n4,40\n1,30"), cell("70\n130\n90\n80\n80"), cell("10,0"), cell("5,0"), cell("5,0")],
        ], ["La prima colonna contiene la sagoma grafica ufficiale del veicolo; il modello corrente non supporta immagini incorporate nelle celle."]),
        table("5.1.ix", "5.1.IX", 165, "Tab. 5.1.IX - Dimensioni degli assi e delle impronte per i veicoli equivalenti", [[cell("Tipo di pneumatico"), cell("Dimensioni dell’asse e delle impronte")]], [[cell("A"), cell("")], [cell("B"), cell("")], [cell("C"), cell("")]], ["La seconda colonna contiene i disegni quotati ufficiali delle dimensioni degli assi e delle impronte; il modello corrente non supporta immagini incorporate nelle celle."]),
        table("5.1.x", "5.1.X", 165, "Tab. 5.1.X – Flusso annuo di veicoli pesanti sulla corsia di marcia lenta", [[cell("Categorie di traffico"), cell("Flusso annuo di veicoli di peso superiore a 100 kN sulla corsia di marcia lenta", { latex: "\\text{Flusso annuo di veicoli di peso superiore a }100\\,\\mathrm{kN}\\text{ sulla corsia di marcia lenta}" })]], [
            [cell("1 - Strade ed autostrade con 2 o più corsie per senso di marcia, caratterizzate da intenso traffico pesante"), cell("2,0 × 10⁶", { latex: "2{,}0\\times 10^6" })],
            [cell("2 - Strade ed autostrade caratterizzate da traffico pesante di media intensità"), cell("0,5 × 10⁶", { latex: "0{,}5\\times 10^6" })],
            [cell("3 - Strade principali caratterizzate da traffico pesante di modesta intensità"), cell("0,125 × 10⁶", { latex: "0{,}125\\times 10^6" })],
            [cell("4 - Strade locali caratterizzate da traffico pesante di intensità molto ridotta"), cell("0,05 × 10⁶", { latex: "0{,}05\\times 10^6" })],
        ]),
        { id: asset("table", "5.2.i"), unitId: unitId("5.2.2.2.1.2"), officialNumber: "5.2.I", pdfPage: 169, caption: "Tab. 5.2.I - Caratteristiche Modelli di Carico SW", columnCount: 4, headers: [[cell("Tipo di Carico"), cell("qvk [kN/m]", { latex: "q_{vk}\\;[\\mathrm{kN/m}]" }), cell("a [m]", { latex: "a\\;[\\mathrm{m}]" }), cell("c [m]", { latex: "c\\;[\\mathrm{m}]" })]], rows: [[cell("SW/0"), cell("133"), cell("15,0"), cell("5,3")], [cell("SW/2"), cell("150"), cell("25,0"), cell("7,0")]], notes: [] },
    ],
    figures: [
        { id: asset("figure", "5.1.4"), unitId: unitId("5.1.4.3"), officialNumber: "5.1.4", pdfPage: 162, caption: "Fig. 5.1.4 - Modello di carico di fatica 1", alt: "Modello di carico di fatica 1", imagePath: "figures/ntc2018/fig5.1.4.png", region: { coordinateSystem: "pdf-points-top-left", x: 170, y: 490, width: 260, height: 145 }, sha256: "" },
        { id: asset("figure", "5.1.5"), unitId: unitId("5.1.4.3"), officialNumber: "5.1.5", pdfPage: 164, caption: "Fig. 5.1.5 - Modello di carico di fatica. 3", alt: "Modello di carico di fatica 3", imagePath: "figures/ntc2018/fig5.1.5.png", region: { coordinateSystem: "pdf-points-top-left", x: 150, y: 70, width: 300, height: 150 }, sha256: "" },
        { id: asset("figure", "5.2.1"), unitId: unitId("5.2.2.2.1.1"), officialNumber: "5.2.1", pdfPage: 168, caption: "Fig. 5.2.1 - Modello di carico LM71", alt: "Modello di carico LM71", imagePath: "figures/ntc2018/fig5.2.1.png", region: { coordinateSystem: "pdf-points-top-left", x: 125, y: 575, width: 350, height: 105 }, sha256: "" },
        { id: asset("figure", "5.2.2"), unitId: unitId("5.2.2.2.1.2"), officialNumber: "5.2.2", pdfPage: 169, caption: "Fig. 5.2.2 - Modelli di carico SW", alt: "Modelli di carico SW", imagePath: "figures/ntc2018/fig5.2.2.png", region: { coordinateSystem: "pdf-points-top-left", x: 135, y: 240, width: 350, height: 50 }, sha256: "" },
        { id: asset("figure", "5.2.3"), unitId: unitId("5.2.2.2.1.4"), officialNumber: "5.2.3", pdfPage: 169, caption: "Fig. 5.2.3 - Distribuzione longitudinale dei carichi assiali", alt: "Distribuzione longitudinale dei carichi assiali", imagePath: "figures/ntc2018/fig5.2.3.png", region: { coordinateSystem: "pdf-points-top-left", x: 100, y: 535, width: 320, height: 90 }, sha256: "" },
        { id: asset("figure", "5.2.4"), unitId: unitId("5.2.2.2.1.4"), officialNumber: "5.2.4", pdfPage: 170, caption: "Fig. 5.2.4 - Distribuzione longitudinale dei carichi attraverso il ballast", alt: "Distribuzione longitudinale dei carichi attraverso il ballast", imagePath: "figures/ntc2018/fig5.2.4.png", region: { coordinateSystem: "pdf-points-top-left", x: 80, y: 75, width: 430, height: 125 }, sha256: "" },
        { id: asset("figure", "5.2.5"), unitId: unitId("5.2.2.2.1.4"), officialNumber: "5.2.5", pdfPage: 170, caption: "Fig. 5.2.5 - Distribuzione trasversale in rettifilo delle azioni per mezzo delle traverse e del ballast. In figura, Qh rappresenta la forza centrifuga definita al successivo §5.2.2.3.1", alt: "Distribuzione trasversale in rettifilo delle azioni per mezzo delle traverse e del ballast", imagePath: "figures/ntc2018/fig5.2.5.png", region: { coordinateSystem: "pdf-points-top-left", x: 45, y: 315, width: 500, height: 125 }, sha256: "" },
        { id: asset("figure", "5.2.6"), unitId: unitId("5.2.2.2.1.4"), officialNumber: "5.2.6", pdfPage: 170, caption: "Fig. 5.2.6 - Distribuzione trasversale in curva delle azioni per mezzo delle traverse e del ballast. In figura, Qh rappresenta la forza centrifuga definita al successivo §5.2.2.3.1", alt: "Distribuzione trasversale in curva delle azioni per mezzo delle traverse e del ballast", imagePath: "figures/ntc2018/fig5.2.6.png", region: { coordinateSystem: "pdf-points-top-left", x: 45, y: 500, width: 500, height: 150 }, sha256: "" },
    ],
};

const unitOutput = join(root, "corpus", "units", "ntc2018");
const assetOutput = join(root, "corpus", "assets", "ntc2018", "5.1-step2.json");
await mkdir(unitOutput, { recursive: true });
for (const figure of assetManifest.figures) figure.sha256 = sha256(await readFile(join(root, "corpus", "assets", figure.imagePath)));
for (const def of units) await writeFile(join(unitOutput, `${def.number}.json`), `${JSON.stringify(makeUnit(def), null, 2)}\n`, "utf8");
await writeFile(assetOutput, `${JSON.stringify(assetManifest, null, 2)}\n`, "utf8");
console.log(`NTC5 step2: ${units.length} unità e manifest asset scritto.`);
