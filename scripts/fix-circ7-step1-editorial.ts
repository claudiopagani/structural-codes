import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

type InlineKind = "text" | "em" | "strong" | "math";
type Inline = { kind: InlineKind; value: string; latex?: string };
type Block = {
    blockId: string;
    kind: string;
    listMarker?: "bullet" | "dash" | "none";
    text?: { normalized: string; inline?: Inline[] };
    evidence?: { pdfPage?: number };
};
type Unit = { blocks: Block[] };
type Asset = { officialNumber: string; caption: string; captionInline?: Inline[]; pdfPage?: number };
type Manifest = { figures: Asset[]; tables: Asset[] };
type Format = Exclude<Inline, { kind: "text" }>;

const root = fileURLToPath(new URL("../", import.meta.url));
const unitDirectory = join(root, "corpus", "units", "circ2019");
const assetPath72 = join(root, "corpus", "assets", "circ2019", "7.2.json");
const assetPath73 = join(root, "corpus", "assets", "circ2019", "7.3.json");
const assetPath74 = join(root, "corpus", "assets", "circ2019", "7.4.json");
const assetPath75 = join(root, "corpus", "assets", "circ2019", "7.5.json");
const assetPath76 = join(root, "corpus", "assets", "circ2019", "7.6.json");
const assetPath710 = join(root, "corpus", "assets", "circ2019", "7.10.json");

function assertInline(inline: Inline[], expected: string): void {
    assert.equal(inline.map(({ value }) => value).join(""), expected, "Inline non allineato al testo normalizzato");
}

function inline(text: string, formats: Format[]): Inline[] {
    const result: Inline[] = [];
    let cursor = 0;
    while (cursor < text.length) {
        let next: { at: number; format: Format } | undefined;
        for (const format of formats) {
            const at = text.indexOf(format.value, cursor);
            if (at < 0) continue;
            if (!next || at < next.at || (at === next.at && format.value.length > next.format.value.length)) {
                next = { at, format };
            }
        }
        if (!next) {
            result.push({ kind: "text", value: text.slice(cursor) });
            break;
        }
        if (next.at > cursor) result.push({ kind: "text", value: text.slice(cursor, next.at) });
        result.push(next.format);
        cursor = next.at + next.format.value.length;
    }
    assertInline(result, text);
    return result;
}

async function readUnit(name: string): Promise<{ path: string; unit: Unit }> {
    const path = join(unitDirectory, `${name}.json`);
    return { path, unit: JSON.parse(await readFile(path, "utf8")) as Unit };
}

function findBlock(unit: Unit, prefix: string): Block & { text: NonNullable<Block["text"]> } {
    const block = unit.blocks.find((candidate) => candidate.text?.normalized.startsWith(prefix));
    assert.ok(block?.text, `Blocco non trovato: ${prefix}`);
    return block as Block & { text: NonNullable<Block["text"]> };
}

function format(block: Block & { text: NonNullable<Block["text"]> }, formats: Format[]): void {
    block.text.inline = inline(block.text.normalized, formats);
}

async function save(path: string, value: unknown): Promise<void> {
    await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function updateUnits(): Promise<void> {
    {
        const { path, unit } = await readUnit("c7");
        format(findBlock(unit, "Le indicazioni relative"), [
            { kind: "strong", value: "sono additive e non sostitutive" },
            { kind: "math", value: "§ 7.11", latex: "\\S 7.11" },
        ]);
        format(findBlock(unit, "Ampio spazio"), [
            { kind: "math", value: "§ 7.10", latex: "\\S 7.10" },
        ]);
        format(findBlock(unit, "La norma fa sistematico"), [
            { kind: "math", value: "§ 7.1", latex: "\\S 7.1" },
            { kind: "math", value: "§ 7.2", latex: "\\S 7.2" },
            { kind: "math", value: "§ 7.3", latex: "\\S 7.3" },
        ]);
        for (const block of unit.blocks.filter((candidate) => candidate.kind === "list-item")) block.listMarker = "dash";
        await save(path, unit);
    }

    {
        const { path, unit } = await readUnit("c7.1");
        format(findBlock(unit, "La norma indica"), [{ kind: "math", value: "§ 7.1", latex: "\\S 7.1" }]);
        format(findBlock(unit, "Riferendosi agli Stati"), [{ kind: "math", value: "§ 3.2.1", latex: "\\S 3.2.1" }]);
        format(findBlock(unit, "L’insieme delle verifiche"), [{ kind: "math", value: "§ 7.3.6", latex: "\\S 7.3.6" }]);
        await save(path, unit);
    }

    {
        const { path, unit } = await readUnit("c7.2");
        format(findBlock(unit, "Questo paragrafo"), [{ kind: "math", value: "§ 7.2.1", latex: "\\S 7.2.1" }]);
        format(findBlock(unit, "Per quanto riguarda"), [{ kind: "math", value: "§ 7.2.2", latex: "\\S 7.2.2" }]);
        await save(path, unit);
    }

    {
        const { path, unit } = await readUnit("c7.2.1");
        format(findBlock(unit, "Con riferimento"), [
            { kind: "math", value: "§ 7.2.1", latex: "\\S 7.2.1" },
            { kind: "math", value: "10%", latex: "10\\%" },
            { kind: "math", value: "30%", latex: "30\\%" },
        ]);
        await save(path, unit);
    }

    {
        const { path, unit } = await readUnit("c7.2.2");
        for (const block of unit.blocks.filter((candidate) => candidate.kind === "list-item")) block.listMarker = block.text?.normalized.startsWith("a)") || block.text?.normalized.startsWith("b)") ? "none" : "dash";
        format(findBlock(unit, "Per quanto riguarda gli effetti"), [{ kind: "math", value: "§ 7.2.2", latex: "\\S 7.2.2" }]);
        format(findBlock(unit, "L’insieme delle prescrizioni"), [{ kind: "em", value: "“progettazione in capacità”" }]);
        format(findBlock(unit, "Nell’ambito del comportamento"), [
            { kind: "em", value: "elevata capacità dissipativa" },
            { kind: "em", value: "media capacità dissipativa" },
        ]);
        format(findBlock(unit, "La norma definisce i criteri"), [{ kind: "em", value: "“progettazione in capacità”" }]);
        format(findBlock(unit, "Per conseguire gli obiettivi"), [
            { kind: "math", value: "γ_Rd", latex: "\\gamma_{Rd}" },
        ]);
        format(findBlock(unit, "Le NTC prescrivono"), [
            { kind: "math", value: "γ_Rd ≥ 1,25", latex: "\\gamma_{Rd}\\ge1{,}25" },
        ]);
        format(findBlock(unit, "Proprio per questa ragione"), [
            { kind: "math", value: "γ_Rd", latex: "\\gamma_{Rd}" },
            { kind: "math", value: "1,3", latex: "1{,}3" },
        ]);
        await save(path, unit);
    }

    {
        const { path, unit } = await readUnit("c7.2.3");
        for (const block of unit.blocks.filter((candidate) => candidate.kind === "list-item")) {
            if ((block.evidence?.pdfPage ?? 0) <= 205) block.listMarker = "none";
            else delete block.listMarker;
        }
        format(findBlock(unit, "Gli elementi strutturali secondari"), [
            { kind: "math", value: "§ 7.3", latex: "\\S 7.3" },
            { kind: "math", value: "§ 7.2.3", latex: "\\S 7.2.3" },
        ]);
        format(findBlock(unit, "Nella formula [7.2.1]"), [
            { kind: "math", value: "S_a", latex: "S_a" },
            { kind: "math", value: "T_a", latex: "T_a" },
        ]);
        format(findBlock(unit, "S_i(T_i) è"), [
            { kind: "math", value: "S_i(T_i)", latex: "S_i(T_i)" },
            { kind: "math", value: "g", latex: "g" },
            { kind: "math", value: "q", latex: "q" },
        ]);
        format(findBlock(unit, "Γ_i è"), [{ kind: "math", value: "Γ_i", latex: "\\Gamma_i" }]);
        format(findBlock(unit, "α è il rapporto"), [
            { kind: "math", value: "α", latex: "\\alpha" },
            { kind: "math", value: "a_gS", latex: "a_gS" },
            { kind: "math", value: "g", latex: "g" },
            { kind: "math", value: "§ 3.2.1", latex: "\\S 3.2.1" },
        ]);
        format(findBlock(unit, "S è il coefficiente"), [
            { kind: "math", value: "S", latex: "S" },
            { kind: "math", value: "§ 3.2.3.2.1", latex: "\\S 3.2.3.2.1" },
        ]);
        const glossarySymbols: Array<[string, string, string]> = [
            ["T_a è", "T_a", "T_{a}"],
            ["T_1 è", "T_1", "T_{1}"],
            ["z è", "z", "z"],
            ["H è", "H", "H"],
            ["a, b, a_p sono", "a, b, a_p", "a, b, a_{p}"],
        ];
        for (const [prefix, value, latex] of glossarySymbols) {
            const block = findBlock(unit, prefix);
            format(block, [{ kind: "math", value, latex }]);
        }
        for (const prefix of [
            "Spettri di risposta di piano",
            "Formulazione semplificata, a diverse quote",
            "Formulazione semplificata per costruzioni con struttura a telai",
        ]) format(findBlock(unit, prefix), [{ kind: "em", value: findBlock(unit, prefix).text.normalized }]);
        await save(path, unit);
    }

    {
        const { path, unit } = await readUnit("c7.2.6");
        for (const prefix of ["Modellazione della struttura", "Modellazione dell’azione sismica"]) {
            const block = findBlock(unit, prefix);
            format(block, [{ kind: "strong", value: block.text.normalized }]);
        }
        await save(path, unit);
    }

    {
        const { path, unit } = await readUnit("c7.3.4.2");
        for (const block of unit.blocks.filter((candidate) => candidate.kind === "list-item")) {
            block.listMarker = (block.evidence?.pdfPage ?? 0) === 210 ? "bullet" : "dash";
        }
        for (const prefix of ["Metodo A", "Metodo B"]) {
            const block = findBlock(unit, prefix);
            format(block, [{ kind: "em", value: block.text.normalized }]);
        }
        format(findBlock(unit, "Metodo A, basato"), [{ kind: "em", value: "Metodo A" }]);
        format(findBlock(unit, "Metodo B, basato"), [{ kind: "em", value: "Metodo B" }]);
        await save(path, unit);
    }

    {
        const { path, unit } = await readUnit("c7.4");
        format(findBlock(unit, "Nel caso di comportamento strutturale non dissipativo"), [
            { kind: "em", value: "comportamento strutturale non dissipativo" },
            { kind: "math", value: "§ 4.1", latex: "\\S 4.1" },
        ]);
        format(findBlock(unit, "Nel caso di comportamento strutturale dissipativo"), [
            { kind: "em", value: "comportamento strutturale dissipativo" },
        ]);
        await save(path, unit);
    }

    {
        const { path, unit } = await readUnit("c7.4.5.1");
        format(findBlock(unit, "La norma prevede che altre tipologie"), [
            { kind: "em", value: "altre tipologie possano essere utilizzate giustificando i fattori di comportamento adottati e impiegando regole di dettaglio tali da garantire i requisiti generali di sicurezza di cui alle presenti norme." },
            { kind: "math", value: "§ 7.3.1", latex: "\\S 7.3.1" },
            { kind: "math", value: "q_0", latex: "q_0" },
        ]);
        await save(path, unit);
    }

    {
        const { path, unit } = await readUnit("c7.5.2.1");
        for (const block of unit.blocks.filter((candidate) => candidate.kind === "list-item" && candidate.evidence?.pdfPage === 222)) block.listMarker = "dash";
        format(findBlock(unit, "Una tipologia dissipativa"), [
            { kind: "math", value: "q_0", latex: "q_0" },
            { kind: "math", value: "5α_u/α_1", latex: "5\\alpha_u/\\alpha_1" },
            { kind: "math", value: "2α_u/α_1", latex: "2\\alpha_u/\\alpha_1" },
        ]);
        format(findBlock(unit, "In genere nel calcolo"), [
            { kind: "math", value: "α_u/α_1", latex: "\\alpha_u/\\alpha_1" },
            { kind: "math", value: "§ 7.5.2.2", latex: "\\S 7.5.2.2" },
            { kind: "math", value: "§ 7.3.4.1", latex: "\\S 7.3.4.1" },
            { kind: "math", value: "§ 7.3.4.2", latex: "\\S 7.3.4.2" },
            { kind: "math", value: "1,6", latex: "1{,}6" },
        ]);
        await save(path, unit);
    }

    {
        const { path, unit } = await readUnit("c7.6.4.5");
        for (const block of unit.blocks.filter((candidate) => candidate.kind === "list-item" && candidate.evidence?.pdfPage === 225)) block.listMarker = "dash";
        await save(path, unit);
    }

    {
        const { path, unit } = await readUnit("c7.6.4.5.1");
        for (const block of unit.blocks.filter((candidate) => candidate.kind === "list-item" && candidate.evidence?.pdfPage === 226)) block.listMarker = "dash";
        for (const prefix of ["meccanismo 1", "meccanismo 2", "meccanismo 3"]) {
            const block = findBlock(unit, prefix);
            format(block, [{ kind: "strong", value: prefix }]);
        }
        for (const block of unit.blocks.filter((candidate) => candidate.kind === "list-item" && candidate.evidence?.pdfPage === 228)) {
            block.listMarker = /^[abc]\)/.test(block.text?.normalized ?? "") ? "none" : "dash";
        }
        await save(path, unit);
    }

    {
        const { path, unit } = await readUnit("c7.6.8");
        for (const block of unit.blocks.filter((candidate) => candidate.kind === "list-item")) block.listMarker = "dash";
        format(findBlock(unit, "L’elemento di connessione"), [
            { kind: "math", value: "e ≤ 2M_l,Rd/V_l,Rd", latex: "e\\le 2M_{l,Rd}/V_{l,Rd}" },
        ]);
        format(findBlock(unit, "nel caso in cui si consideri lo sviluppo di una sola"), [
            { kind: "math", value: "e ≤ M_l,Rd/V_l,Rd", latex: "e\\le M_{l,Rd}/V_{l,Rd}" },
        ]);
        format(findBlock(unit, "dove M_l,Rd"), [
            { kind: "math", value: "M_l,Rd", latex: "M_{l,Rd}" },
            { kind: "math", value: "V_l,Rd", latex: "V_{l,Rd}" },
            { kind: "math", value: "§7.5.6", latex: "\\S 7.5.6" },
        ]);
        await save(path, unit);
    }

    {
        const { path, unit } = await readUnit("c7.7.4");
        for (const block of unit.blocks.filter((candidate) => candidate.kind === "list-item")) block.listMarker = "dash";
        await save(path, unit);
    }

    {
        const { path, unit } = await readUnit("c7.7.5.3");
        for (const block of unit.blocks.filter((candidate) => candidate.kind === "list-item" && candidate.evidence?.pdfPage === 232)) block.listMarker = "bullet";
        await save(path, unit);
    }

    {
        const { path, unit } = await readUnit("c7.8.1.2");
        format(findBlock(unit, "Le limitazioni indicate"), [
            { kind: "math", value: "55%", latex: "55\\%" },
            { kind: "math", value: "a_gS", latex: "a_gS" },
            { kind: "math", value: "0,075 g", latex: "0{,}075\\,g" },
            { kind: "math", value: "45%", latex: "45\\%" },
            { kind: "math", value: "§ 7.8.1.2", latex: "\\S 7.8.1.2" },
        ]);
        await save(path, unit);
    }

    {
        const { path, unit } = await readUnit("c7.8.1.5.4");
        for (const block of unit.blocks.filter((candidate) => candidate.kind === "list-item")) block.listMarker = "dash";
        format(findBlock(unit, "L’analisi statica non lineare"), [{ kind: "math", value: "§ 3.2.1", latex: "\\S 3.2.1" }]);
        format(findBlock(unit, "SLC: il minore"), [{ kind: "strong", value: "SLC:" }]);
        format(findBlock(unit, "quello corrispondente ad un taglio"), [{ kind: "math", value: "80%", latex: "80\\%" }]);
        format(findBlock(unit, "SLV: spostamento"), [{ kind: "strong", value: "SLV:" }, { kind: "math", value: "3/4", latex: "3/4" }]);
        format(findBlock(unit, "SLD: spostamento"), [{ kind: "strong", value: "SLD:" }, { kind: "math", value: "§ 7.3.6.1", latex: "\\S 7.3.6.1" }]);
        format(findBlock(unit, "SLO: spostamento"), [{ kind: "strong", value: "SLO:" }, { kind: "math", value: "2/3", latex: "2/3" }, { kind: "math", value: "§ 7.3.6.1", latex: "\\S 7.3.6.1" }]);
        await save(path, unit);
    }

    {
        const { path, unit } = await readUnit("c7.8.1.6");
        format(findBlock(unit, "Nel caso dell’analisi statica"), [
            { kind: "math", value: "§ C.7.3.4.2", latex: "\\S C.7.3.4.2" },
            { kind: "math", value: "q*≤4", latex: "q^{*}\\le4" },
            { kind: "math", value: "q*=4", latex: "q^{*}=4" },
            { kind: "math", value: "q*=3", latex: "q^{*}=3" },
        ]);
        await save(path, unit);
    }

    for (const number of ["c7.8.2.2.1", "c7.8.3.2.1"]) {
        const { path, unit } = await readUnit(number);
        const prefix = "Si sottolinea che la capacità";
        const value = number === "c7.8.2.2.1" ? "1.0%" : "1.6%";
        format(findBlock(unit, prefix), [
            { kind: "math", value, latex: `${value.slice(0, -1)}\\%` },
            { kind: "math", value: "ν = σ_0/f_d", latex: "\\nu=\\sigma_0/f_d" },
            { kind: "math", value: "ν ≤ 0.2", latex: "\\nu\\le0.2" },
            { kind: "math", value: "ν > 0.2", latex: "\\nu>0.2" },
        ]);
        await save(path, unit);
    }

    const symbolCorrections: Array<[string, string, string, string]> = [
        ["c7.8.2.2.2", "In questo §, il simbolo", "f_y", "f_v"],
        ["c7.8.2.2.4", "Nella equazione", "f_bd", "f_hd"],
        ["c7.8.3.2.2", "In questo §, il simbolo", "f_y", "f_v"],
    ];
    for (const [number, prefix, first, second] of symbolCorrections) {
        const { path, unit } = await readUnit(number);
        format(findBlock(unit, prefix), [
            { kind: "math", value: first, latex: first.replace("_", "_") },
            { kind: "math", value: second, latex: second.replace("_", "_") },
        ]);
        await save(path, unit);
    }

    {
        const { path, unit } = await readUnit("c7.8.4");
        for (const block of unit.blocks.filter((candidate) => candidate.kind === "list-item")) block.listMarker = "dash";
        format(findBlock(unit, "La capacità di spostamento"), [
            { kind: "math", value: "1.2%", latex: "1.2\\%" },
            { kind: "math", value: "ν ≤ 0.2", latex: "\\nu\\le0.2" },
            { kind: "math", value: "0.5%", latex: "0.5\\%" },
        ]);
        format(findBlock(unit, "in cui ν è"), [{ kind: "math", value: "ν = σ_0/f_d=N/(A f_d)", latex: "\\nu=\\sigma_0/f_d=N/(A f_d)" }]);
        format(findBlock(unit, "Per valori di ν superiori"), [
            { kind: "math", value: "ν", latex: "\\nu" },
            { kind: "math", value: "1.5%", latex: "1.5\\%" },
            { kind: "math", value: "(1-ν)", latex: "(1-\\nu)" },
        ]);
        await save(path, unit);
    }

    {
        const { path, unit } = await readUnit("c7.9.5");
        format(findBlock(unit, "Per garantire alle pile"), [{ kind: "em", value: "“prc”" }]);
        await save(path, unit);
    }

    {
        const { path, unit } = await readUnit("c7.9.5.1.1");
        format(findBlock(unit, "La figura C7.9.1"), [
            { kind: "math", value: "L_zd", latex: "L_{zd}" },
            { kind: "math", value: "L_zd-sez", latex: "L_{zd-sez}" },
            { kind: "math", value: "L_zd-M", latex: "L_{zd-M}" },
            { kind: "math", value: "M_prc", latex: "M_{prc}" },
            { kind: "math", value: "§ 7.9.6.1.3", latex: "\\S 7.9.6.1.3" },
            { kind: "math", value: "§ 7.9.5", latex: "\\S 7.9.5" },
        ]);
        await save(path, unit);
    }

    {
        const { path, unit } = await readUnit("c7.10.1");
        for (const block of unit.blocks.filter((candidate) => candidate.kind === "list-item")) block.listMarker = "none";
        format(findBlock(unit, "Per realizzare l’isolamento"), [
            { kind: "em", value: "isolamento sismico" },
            { kind: "strong", value: "sovrastruttura" },
            { kind: "strong", value: "sottostruttura" },
        ]);
        format(findBlock(unit, "Molti degli isolatori"), [{ kind: "math", value: "5%", latex: "5\\%" }, { kind: "em", value: "“dispositivi ausiliari”" }]);
        format(findBlock(unit, "Considerando una porzione"), [{ kind: "math", value: "T_bf", latex: "T_{bf}" }]);
        await save(path, unit);
    }

    {
        const { path, unit } = await readUnit("c7.10.4");
        for (const block of unit.blocks.filter((candidate) => candidate.kind === "list-item")) block.listMarker = "none";
        format(findBlock(unit, "La prima è ottenibile"), [{ kind: "math", value: "20-40%", latex: "20\u201340\\%" }]);
        await save(path, unit);
    }

    {
        const { path, unit } = await readUnit("c7.10.5.3.2");
        for (const block of unit.blocks.filter((candidate) => candidate.kind === "list-item")) block.listMarker = "none";
        format(findBlock(unit, "ξ = valore"), [
            { kind: "math", value: "ξ", latex: "\\xi" },
            { kind: "math", value: "T_1", latex: "T_1" },
            { kind: "math", value: "T_2", latex: "T_2" },
        ]);
        await save(path, unit);
    }

    {
        const { path, unit } = await readUnit("c7.10.8");
        for (const block of unit.blocks.filter((candidate) => candidate.kind === "list-item")) block.listMarker = "none";
        await save(path, unit);
    }

    {
        const { path, unit } = await readUnit("c7.11.3.1.2");
        for (const block of unit.blocks.filter((candidate) => candidate.kind === "list-item")) block.listMarker = "dash";
        await save(path, unit);
    }

    {
        const { path, unit } = await readUnit("c7.11.3.1.2.3");
        for (const block of unit.blocks.filter((candidate) => candidate.kind === "list-item")) block.listMarker = "dash";
        format(findBlock(unit, "Nelle analisi semplificate"), [{ kind: "math", value: "1-2%", latex: "1\u20132\\%" }]);
        await save(path, unit);
    }

    {
        const { path, unit } = await readUnit("c7.11.3.4");
        format(findBlock(unit, "Se la condizione relativa"), [
            { kind: "em", value: findBlock(unit, "Se la condizione relativa").text.normalized },
            { kind: "math", value: "0,1g", latex: "0{,}1g" },
        ]);
        format(findBlock(unit, "Nelle analisi puntuali"), [
            { kind: "math", value: "CRR = τ_f/σ’_v0", latex: "CRR=\\tau_f/\\sigma'_{v0}" },
            { kind: "math", value: "CSR = τ_media/σ’_v0", latex: "CSR=\\tau_{media}/\\sigma'_{v0}" },
            { kind: "math", value: "τ_max", latex: "\\tau_{max}" },
            { kind: "math", value: "V_s", latex: "V_s" },
        ]);
        format(findBlock(unit, "Nelle verifiche globali"), [{ kind: "math", value: "I_L", latex: "I_L" }]);
        await save(path, unit);
    }

    {
        const { path, unit } = await readUnit("c7.11.3.5");
        for (const block of unit.blocks.filter((candidate) => candidate.kind === "list-item")) block.listMarker = "dash";
        format(findBlock(unit, "Nei metodi pseudostatici"), [
            { kind: "math", value: "FS", latex: "FS" },
            { kind: "math", value: "F_S=τ_s/τ_m", latex: "F_S=\\tau_s/\\tau_m" },
        ]);
        format(findBlock(unit, "In terreni saturi"), [
            { kind: "math", value: "a_max>0.15·g", latex: "a_{max}>0.15\\cdot g" },
            { kind: "math", value: "Δu", latex: "\\Delta u" },
            { kind: "math", value: "δ_cu", latex: "\\delta_{cu}" },
        ]);
        await save(path, unit);
    }

    {
        const { path, unit } = await readUnit("c7.11.5.3.2");
        for (const block of unit.blocks.filter((candidate) => candidate.kind === "list-item")) block.listMarker = "dash";
        for (const prefix of ["Gruppi di pali", "Fondazioni miste"]) {
            const block = findBlock(unit, prefix);
            format(block, [{ kind: "strong", value: block.text.normalized }]);
        }
        await save(path, unit);
    }

    {
        const { path, unit } = await readUnit("c7.11.6.3");
        format(findBlock(unit, "Per tener conto"), [
            { kind: "math", value: "a_h", latex: "a_h" },
            { kind: "math", value: "β", latex: "\\beta" },
        ]);
        format(findBlock(unit, "Il coefficiente β"), [{ kind: "math", value: "β", latex: "\\beta" }, { kind: "math", value: "β<1", latex: "\\beta<1" }]);
        format(findBlock(unit, "Qualora l’accelerazione massima"), [{ kind: "math", value: "β = 1", latex: "\\beta=1" }, { kind: "math", value: "α", latex: "\\alpha" }]);
        await save(path, unit);
    }
}

async function updateAssets(): Promise<void> {
    const manifest = JSON.parse(await readFile(assetPath72, "utf8")) as Manifest;
    const figures = new Map(manifest.figures.map((figure) => [figure.officialNumber, figure]));
    for (const number of ["C7.2.1", "C7.2.2"]) {
        const figure = figures.get(number);
        assert.ok(figure, `Figura assente: ${number}`);
        figure.captionInline = [
            { kind: "strong", value: `Figura ${number}` },
            { kind: "text", value: " – " },
            { kind: "em", value: figure.caption.slice(`Figura ${number} – `.length) },
        ];
        assertInline(figure.captionInline, figure.caption);
    }
    for (const number of ["C7.2.3", "C7.2.5"]) {
        const figure = figures.get(number);
        assert.ok(figure, `Figura assente: ${number}`);
        figure.captionInline = [
            { kind: "strong", value: `Figura ${number}` },
            { kind: "text", value: " – " },
            { kind: "em", value: figure.caption.slice(`Figura ${number} – `.length) },
        ];
        assertInline(figure.captionInline, figure.caption);
    }
    const c724 = figures.get("C7.2.4");
    assert.ok(c724, "Figura C7.2.4 assente");
    c724.captionInline = [
        { kind: "strong", value: "Figura C7.2.4" },
        { kind: "text", value: " – " },
        { kind: "em", value: "Accelerazione massima, normalizzata rispetto ad " },
        { kind: "math", value: "αS", latex: "\\alpha S" },
        { kind: "em", value: ", per i seguenti valori di " },
        { kind: "math", value: "T₁", latex: "T_1" },
        { kind: "em", value: ": (a) " },
        { kind: "math", value: "T₁ = 0,3 s", latex: "T_1=0{,}3\\,\\mathrm{s}" },
        { kind: "em", value: ", (b) " },
        { kind: "math", value: "T₁ = 0,6 s", latex: "T_1=0{,}6\\,\\mathrm{s}" },
        { kind: "em", value: ", (c) " },
        { kind: "math", value: "T₁ = 0,9 s", latex: "T_1=0{,}9\\,\\mathrm{s}" },
        { kind: "em", value: ", (d) " },
        { kind: "math", value: "T₁ = 1,2 s", latex: "T_1=1{,}2\\,\\mathrm{s}" },
    ];
    assertInline(c724.captionInline, c724.caption);
    const table = manifest.tables.find((candidate) => candidate.officialNumber === "C7.2.I");
    assert.ok(table, "Tabella C7.2.I assente");
    table.captionInline = [
        { kind: "strong", value: "Tabella C7.2.I" },
        { kind: "text", value: " – Valori di " },
        { kind: "math", value: "q_a", latex: "q_a" },
        { kind: "em", value: " per elementi non strutturali" },
    ];
    assertInline(table.captionInline, table.caption);
    await save(assetPath72, manifest);

    const chapter73 = JSON.parse(await readFile(assetPath73, "utf8")) as Manifest;
    for (const asset of [...chapter73.figures, ...chapter73.tables]) {
        const separatorIndex = asset.caption.indexOf(" – ");
        assert.ok(separatorIndex > 0, `Didascalia non separabile: ${asset.officialNumber}`);
        const label = asset.caption.slice(0, separatorIndex);
        const description = asset.caption.slice(separatorIndex + 3);
        const captionInline: Inline[] = [
            { kind: "strong", value: label },
            { kind: "text", value: " – " },
            { kind: "em", value: description },
        ];
        asset.captionInline = captionInline;
        assertInline(captionInline, asset.caption);
    }
    await save(assetPath73, chapter73);

    for (const assetPath of [assetPath74, assetPath75]) {
        const manifest = JSON.parse(await readFile(assetPath, "utf8")) as Manifest;
        for (const asset of [...manifest.figures, ...manifest.tables]) {
            if ((asset.pdfPage ?? 0) < 215 || (asset.pdfPage ?? 0) > 224) continue;
            const separator = asset.caption.includes(" – ") ? " – " : " - ";
            const separatorIndex = asset.caption.indexOf(separator);
            assert.ok(separatorIndex > 0, `Didascalia non separabile: ${asset.officialNumber}`);
            const captionInline: Inline[] = [
                { kind: "strong", value: asset.caption.slice(0, separatorIndex) },
                { kind: "text", value: separator },
                { kind: "em", value: asset.caption.slice(separatorIndex + separator.length) },
            ];
            asset.captionInline = captionInline;
            assertInline(captionInline, asset.caption);
        }
        await save(assetPath, manifest);
    }

    const chapter76 = JSON.parse(await readFile(assetPath76, "utf8")) as Manifest;
    for (const figure of chapter76.figures) {
        if ((figure.pdfPage ?? 0) < 225 || (figure.pdfPage ?? 0) > 234) continue;
        const separatorIndex = figure.caption.indexOf(" - ");
        assert.ok(separatorIndex > 0, `Didascalia non separabile: ${figure.officialNumber}`);
        figure.captionInline = [
            { kind: "strong", value: figure.caption.slice(0, separatorIndex) },
            { kind: "text", value: " - " },
            { kind: "em", value: figure.caption.slice(separatorIndex + 3) },
        ];
        assertInline(figure.captionInline, figure.caption);
    }
    await save(assetPath76, chapter76);

    for (const assetPath of [assetPath710]) {
        const manifest = JSON.parse(await readFile(assetPath, "utf8")) as Manifest;
        for (const figure of manifest.figures) {
            if ((figure.pdfPage ?? 0) < 235 || (figure.pdfPage ?? 0) > 244) continue;
            const separatorIndex = figure.caption.indexOf(" - ");
            assert.ok(separatorIndex > 0, `Didascalia non separabile: ${figure.officialNumber}`);
            figure.captionInline = [
                { kind: "strong", value: figure.caption.slice(0, separatorIndex) },
                { kind: "text", value: " - " },
                { kind: "em", value: figure.caption.slice(separatorIndex + 3) },
            ];
            assertInline(figure.captionInline, figure.caption);
        }
        await save(assetPath, manifest);
    }
}

await updateUnits();
await updateAssets();
