import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));

// I record canonici hanno forme eterogenee.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function json(relativePath: string): Promise<any> {
    return JSON.parse(await readFile(join(repoRoot, relativePath), "utf8"));
}

test("NTC 4.2 pagine 95-100 conserva corsivi e liste ufficiali", async () => {
    const [limits, classification, capacity, global] = await Promise.all([
        json("corpus/units/ntc2018/4.2.2.1.json"),
        json("corpus/units/ntc2018/4.2.3.1.json"),
        json("corpus/units/ntc2018/4.2.3.2.json"),
        json("corpus/units/ntc2018/4.2.3.3.json"),
    ]);
    const limitLabels = limits.blocks
        .filter(({ kind }: { kind: string }) => kind === "list-item")
        .map(({ text }: { text: { inline: Array<{ kind: string; value: string }> } }) => text.inline.find(({ kind }) => kind === "em")?.value);
    assert.deepEqual(limitLabels, [
        "stato limite di equilibrio",
        "stato limite di collasso",
        "stato limite di fatica",
        "stati limite di deformazione e/o spostamento",
        "stato limite di vibrazione",
        "stato limite di plasticizzazioni locali",
        "stato limite di scorrimento dei collegamenti ad attrito con bulloni ad alta resistenza",
    ]);
    const classLabels = classification.blocks
        .filter(({ text }: { text?: { normalized?: string } }) => text?.normalized?.startsWith("classe "))
        .map(({ text }: { text: { inline: Array<{ kind: string; value: string }> } }) => text.inline[0]);
    assert.deepEqual(classLabels, [
        { kind: "em", value: "classe 1" },
        { kind: "em", value: "classe 2" },
        { kind: "em", value: "classe 3" },
        { kind: "em", value: "classe 4" },
    ]);
    assert.ok(classification.blocks.some(({ text }: { text?: { inline?: Array<{ kind: string; value: string }> } }) => text?.inline?.some(({ kind, value }) => kind === "em" && value === "sezione efficace")));
    for (const unit of [capacity, global]) {
        const labels = unit.blocks
            .filter(({ text }: { text?: { normalized?: string } }) => text?.normalized?.startsWith("Metodo "))
            .map(({ text }: { text: { normalized: string; inline: Array<{ kind: string; value: string }> } }) => text.inline);
        for (const inline of labels) assert.deepEqual(inline, [{ kind: "em", value: inline[0].value }]);
    }
    const classOne = classification.blocks.find(({ text }: { text?: { normalized?: string } }) => text?.normalized?.startsWith("classe 1"));
    assert.ok(classOne.text.inline.some(({ kind, latex }: { kind: string; latex?: string }) => kind === "math" && latex === "C_{\\vartheta}\\ge3"));
});

test("NTC 4.2 pagine 95-100 struttura le didascalie delle tabelle", async () => {
    const [step1, step3] = await Promise.all([
        json("corpus/assets/ntc2018/4.2-step1.json"),
        json("corpus/assets/ntc2018/4.2-step3.json"),
    ]);
    const tables = [...step1.tables, ...step3.tables].filter(({ officialNumber }: { officialNumber: string }) => ["4.2.I", "4.2.II", "4.2.III", "4.2.IV", "4.2.V", "4.2.VI"].includes(officialNumber));
    assert.equal(tables.length, 6);
    for (const table of tables) {
        assert.equal(table.captionInline[0].kind, "strong", table.officialNumber);
        assert.equal(table.captionInline[0].value, `Tab. ${table.officialNumber}`, table.officialNumber);
        assert.equal(table.captionInline[1].kind, "em", table.officialNumber);
        assert.equal(table.captionInline.map(({ value }: { value: string }) => value).join(""), table.caption, table.officialNumber);
    }
});

test("NTC 4.2 pagine 100-107 conserva titoli, definizioni e simboli inline", async () => {
    const [resistance, shear, bending, stability] = await Promise.all([
        json("corpus/units/ntc2018/4.2.4.1.1.json"),
        json("corpus/units/ntc2018/4.2.4.1.2.4.json"),
        json("corpus/units/ntc2018/4.2.4.1.2.7.json"),
        json("corpus/units/ntc2018/4.2.4.1.3.1.json"),
    ]);
    assert.deepEqual(resistance.blocks[0].text.inline, [
        { kind: "text", value: "4.2.4.1.1 " },
        { kind: "em", value: "Resistenza di progetto" },
    ]);
    assert.deepEqual(
        shear.blocks.filter(({ kind, listMarker }: { kind: string; listMarker?: string }) => kind === "list-item" && listMarker === "none").map(({ text }: { text: { inline: Array<{ latex?: string }> } }) => text.inline.at(0)?.latex),
        ["A", "b", "h_w", "h", "r", "t_f", "t_w"],
    );
    assert.deepEqual(
        bending.blocks.filter(({ kind, listMarker }: { kind: string; listMarker?: string }) => kind === "list-item" && listMarker === "none").map(({ text }: { text: { inline: Array<{ latex?: string }> } }) => text.inline.at(0)?.latex),
        ["M_{pl,y,Rd}", "M_{pl,z,Rd}", "A", "b", "t_f"],
    );
    assert.deepEqual(
        stability.blocks.filter(({ kind, listMarker }: { kind: string; listMarker?: string }) => kind === "list-item" && listMarker === "none").map(({ text }: { text: { inline: Array<{ latex?: string }> } }) => text.inline.at(0)?.latex),
        ["N_{Ed}", "N_{b,Rd}", "l_0", "i"],
    );
});

test("NTC 4.2 pagine 100-107 conserva le caption VII e VIII", async () => {
    const [step4a, step4b] = await Promise.all([
        json("corpus/assets/ntc2018/4.2-step4a.json"),
        json("corpus/assets/ntc2018/4.2-step4b.json"),
    ]);
    for (const [manifest, number] of [[step4a, "4.2.VII"], [step4b, "4.2.VIII"]]) {
        const table = manifest.tables.find(({ officialNumber }: { officialNumber: string }) => officialNumber === number);
        assert.deepEqual(table.captionInline.map(({ kind }: { kind: string }) => kind), ["strong", "em"]);
        assert.equal(table.captionInline.map(({ value }: { value: string }) => value).join(""), table.caption);
    }
});

test("NTC 4.2 pagine 107-112 conserva titoli, definizioni ed elenchi", async () => {
    const [beams, fatigue, vertical, vibration, unions] = await Promise.all([
        json("corpus/units/ntc2018/4.2.4.1.3.2.json"),
        json("corpus/units/ntc2018/4.2.4.1.4.json"),
        json("corpus/units/ntc2018/4.2.4.2.1.json"),
        json("corpus/units/ntc2018/4.2.4.2.3.2.json"),
        json("corpus/units/ntc2018/4.2.8.json"),
    ]);
    assert.equal(beams.blocks[0].text.inline.at(-1).kind, "em");
    assert.deepEqual(
        beams.blocks.filter(({ kind, listMarker }: { kind: string; listMarker?: string }) => kind === "list-item" && listMarker === "none").map(({ text }: { text: { inline: Array<{ latex?: string }> } }) => text.inline.at(0)?.latex),
        ["M_{Ed}", "M_{b,Rd}", "W_y"],
    );
    assert.deepEqual(
        fatigue.blocks.filter(({ kind, listMarker }: { kind: string; listMarker?: string }) => kind === "list-item" && listMarker === "none").map(({ text }: { text: { inline: Array<{ latex?: string }> } }) => text.inline.at(0)?.latex),
        ["\\Delta_d", "\\Delta_R", "\\gamma_{Mf}"],
    );
    assert.deepEqual(
        vertical.blocks.filter(({ kind, listMarker }: { kind: string; listMarker?: string }) => kind === "list-item" && listMarker === "none").map(({ text }: { text: { inline: Array<{ latex?: string }> } }) => text.inline.at(0)?.latex),
        ["\\delta_C", "\\delta_1", "\\delta_2", "\\delta_{max}"],
    );
    assert.equal(vibration.blocks[0].text.inline.at(-1).kind, "em");
    assert.deepEqual(unions.blocks.filter(({ kind }: { kind: string }) => kind === "list-item").map(({ text }: { text: { normalized: string } }) => text.normalized), [
        "– le azioni così ripartite fra gli elementi di unione elementari (unioni) del collegamento siano in equilibrio con quelle applicate e soddisfino la condizione di resistenza imposta per ognuno di essi;",
        "– le deformazioni derivanti da tale distribuzione delle sollecitazioni all’interno degli elementi di unione non superino la loro capacità di deformazione.",
    ]);
});

test("NTC 4.2 pagine 107-112 struttura caption di tabelle e figure", async () => {
    const [step4b, step4c, step4d, step5] = await Promise.all([
        json("corpus/assets/ntc2018/4.2-step4b.json"),
        json("corpus/assets/ntc2018/4.2-step4c.json"),
        json("corpus/assets/ntc2018/4.2-step4d.json"),
        json("corpus/assets/ntc2018/4.2-step5.json"),
    ]);
    const tables = [
        ...step4b.tables.filter(({ officialNumber }: { officialNumber: string }) => officialNumber.startsWith("4.2.IX")),
        ...step4c.tables,
        ...step4d.tables,
        ...step5.tables.filter(({ officialNumber }: { officialNumber: string }) => officialNumber === "4.2.XIV"),
    ];
    assert.deepEqual(tables.map(({ officialNumber }: { officialNumber: string }) => officialNumber), ["4.2.IX (a)", "4.2.IX (b)", "4.2.XI", "4.2.X", "4.2.XII", "4.2.XIII", "4.2.XIV"]);
    for (const table of tables) {
        assert.equal(table.captionInline[0].kind, "strong", table.officialNumber);
        assert.equal(table.captionInline.at(-1).kind, "em", table.officialNumber);
        assert.equal(table.captionInline.map(({ value }: { value: string }) => value).join(""), table.caption, table.officialNumber);
    }
    const alphaCaption = tables[0].captionInline.find(({ kind }: { kind: string }) => kind === "math");
    assert.deepEqual(alphaCaption, { kind: "math", value: "αLT", latex: "\\alpha_{LT}" });
    for (const figure of step4d.figures) {
        assert.deepEqual(figure.captionInline.map(({ kind }: { kind: string }) => kind), ["strong", "em"]);
        assert.equal(figure.captionInline.map(({ value }: { value: string }) => value).join(""), figure.caption);
    }
});

test("NTC 4.2 pagine 113-119 conserva corsivi, definizioni e liste", async () => {
    const [bolts, welds, issues] = await Promise.all([
        json("corpus/units/ntc2018/4.2.8.1.1.json"),
        json("corpus/units/ntc2018/4.2.8.2.3.json"),
        json("corpus/units/ntc2018/4.2.9.4.json"),
    ]);
    const emphasized = bolts.blocks.flatMap(({ text }: { text?: { inline?: Array<{ kind: string; value: string }> } }) => text?.inline?.filter(({ kind }) => kind === "em").map(({ value }) => value) ?? []);
    for (const term of ["“non precaricati”", "“precaricati”", "“precarico”", "“accoppiamenti di precisione”"]) assert.ok(emphasized.includes(term), term);
    const alignedSymbols = bolts.blocks
        .filter(({ kind, listMarker }: { kind: string; listMarker?: string }) => kind === "list-item" && listMarker === "none")
        .map(({ text }: { text: { inline: Array<{ latex?: string }> } }) => text.inline.at(0)?.latex);
    for (const symbol of ["d", "t", "f_{tk}", "\\alpha=\\min\\{e_1/(3d_0);f_{tbk}/f_{tk};1\\}", "\\alpha=\\min\\{p_1/(3d_0)-0{,}25;f_{tbk}/f_{tk};1\\}", "k=\\min\\{2{,}8e_2/d_0-1{,}7;2{,}5\\}", "k=\\min\\{1{,}4p_2/d_0-1{,}7;2{,}5\\}", "n", "\\mu", "F_{p,Cd}"]) assert.ok(alignedSymbols.includes(symbol), symbol);
    const angle = welds.blocks.find(({ text }: { text?: { normalized?: string } }) => text?.normalized?.startsWith("La resistenza di progetto, per unità"));
    assert.deepEqual(angle.text.inline.filter(({ kind }: { kind: string }) => kind === "math").map(({ latex }: { latex: string }) => latex), ["a", "a"]);
    assert.equal(issues.blocks.filter(({ kind }: { kind: string }) => kind === "list-item").length, 10);
});

test("NTC 4.2 pagine 113-119 struttura le caption XV-XIX e le figure", async () => {
    const [step5, step6] = await Promise.all([
        json("corpus/assets/ntc2018/4.2-step5.json"),
        json("corpus/assets/ntc2018/4.2-step6.json"),
    ]);
    const tables = [...step5.tables.filter(({ officialNumber }: { officialNumber: string }) => ["4.2.XV", "4.2.XVI", "4.2.XVII", "4.2.XVIII"].includes(officialNumber)), ...step6.tables];
    assert.deepEqual(tables.map(({ officialNumber }: { officialNumber: string }) => officialNumber), ["4.2.XV", "4.2.XVI", "4.2.XVII", "4.2.XVIII", "4.2.XIX"]);
    for (const table of tables) {
        assert.equal(table.captionInline[0].kind, "strong", table.officialNumber);
        assert.equal(table.captionInline.map(({ value }: { value: string }) => value).join(""), table.caption, table.officialNumber);
    }
    assert.deepEqual(tables.at(-1).captionInline.filter(({ kind }: { kind: string }) => kind === "math").map(({ latex }: { latex: string }) => latex), ["\\beta_1", "\\beta_2"]);
    const figures = [...step5.figures, ...step6.figures];
    const expected = new Map([["4.2.5", ["strong", "em"]], ["4.2.6", ["strong", "em"]], ["4.2.7", ["strong"]]]);
    for (const figure of figures) if (expected.has(figure.officialNumber)) assert.deepEqual(figure.captionInline.map(({ kind }: { kind: string }) => kind), expected.get(figure.officialNumber));
});
