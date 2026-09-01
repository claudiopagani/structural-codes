import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));

// Manifest editoriale eterogeneo, ristretto sotto alle sole formule.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function json(relativePath: string): Promise<any> {
    return JSON.parse(await readFile(join(repoRoot, relativePath), "utf8"));
}

test("C4.2 pagine 100-103 conserva indici e prodotti delle formule 1-12", async () => {
    const manifest = await json("corpus/assets/circ2019/C4.2-step1.json");
    const formulas = manifest.formulas.filter(
        ({ pdfPage }: { pdfPage: number }) => pdfPage >= 100 && pdfPage <= 103,
    );
    assert.equal(formulas.length, 12);
    const byNumber = new Map<string, string>(
        formulas.map(
            ({ officialNumber, latex }: { officialNumber: string; latex: string }) =>
                [officialNumber, latex],
        ),
    );
    assert.match(byNumber.get("C4.2.1") ?? "", /\\gamma_\{M0\}\\cdot\\sigma_\{c,Ed\}/u);
    assert.equal(
        byNumber.get("C4.2.3"),
        "a^*=\\max\\left(2d;L_{0{,}8M_p}\\right)",
    );
    assert.match(byNumber.get("C4.2.4") ?? "", /A\\cdot f_\{yk\}/u);
    assert.match(byNumber.get("C4.2.5") ?? "", /h\\cdot H_\{Ed\}/u);
    assert.match(byNumber.get("C4.2.6") ?? "", /0\{,\}3\\cdot\\sqrt/u);
    assert.match(byNumber.get("C4.2.9") ?? "", /0\{,\}15\\cdot V_\{Ed\}/u);
    assert.match(byNumber.get("C4.2.10") ?? "", /A\\cdot f_y/u);
    assert.equal(byNumber.get("C4.2.11"), "F_h=\\phi\\cdot N_{Ed}");
    assert.equal(
        byNumber.get("C4.2.12"),
        "q_h=\\frac{8\\cdot e_{0,d}\\cdot N_{Ed}}{L^2}",
    );
});

test("C4.2.3.3 mantiene il prodotto della soglia di ridistribuzione", async () => {
    const unit = await json("corpus/units/circ2019/c4.2.3.3.json");
    const math = unit.blocks.flatMap(
        ({ text }: { text?: { inline?: Array<{ kind: string; value: string; latex?: string }> } }) =>
            (text?.inline ?? []).filter(({ kind }) => kind === "math"),
    );
    assert.ok(
        math.some(
            ({ value, latex }: { value: string; latex?: string }) =>
                value === "0,15·Mpl,Rd" && latex === "0{,}15\\cdot M_{pl,Rd}",
        ),
    );
});

test("C4.2 pagine 104-113 conserva tutti i punti di moltiplicazione ufficiali", async () => {
    const manifests = await Promise.all(
        [
            "C4.2-step1.json",
            "C4.2-step2a.json",
            "C4.2-step2b.json",
            "C4.2-step2c.json",
        ].map((name) => json(`corpus/assets/circ2019/${name}`)),
    );
    const formulas = manifests.flatMap((manifest) =>
        manifest.formulas.filter(
            ({ pdfPage }: { pdfPage: number }) =>
                pdfPage >= 104 && pdfPage <= 113,
        ),
    );
    assert.equal(formulas.length, 39);
    const expectedProducts = new Map<string, number>([
        ["C4.2.13", 1], ["C4.2.17", 2], ["C4.2.19", 1],
        ["C4.2.20", 5], ["C4.2.22", 4], ["C4.2.23", 1],
        ["C4.2.24", 1], ["C4.2.26", 2], ["C4.2.27", 4],
        ["C4.2.28", 4], ["C4.2.30", 5], ["C4.2.31", 2],
        ["C4.2.32", 9], ["C4.2.33", 1], ["C4.2.34", 1],
        ["C4.2.35", 3], ["C4.2.36", 10], ["C4.2.37", 20],
        ["C4.2.38", 20], ["C4.2.39", 2], ["C4.2.42", 1],
        ["C4.2.43", 1], ["C4.2.44", 2], ["C4.2.46", 4],
        ["C4.2.47", 4], ["C4.2.48", 8], ["C4.2.49", 3],
    ]);
    for (const formula of formulas) {
        const latexProducts = formula.latex.match(/\\cdot/gu)?.length ?? 0;
        assert.equal(
            latexProducts,
            expectedProducts.get(formula.officialNumber) ?? 0,
            formula.officialNumber,
        );
    }
    const byNumber = new Map<string, string>(
        formulas.map(
            ({ officialNumber, latex }: { officialNumber: string; latex: string }) =>
                [officialNumber, latex],
        ),
    );
    assert.match(byNumber.get("C4.2.20") ?? "", /35\\cdot\\varepsilon\\cdot i_z/u);
    assert.match(byNumber.get("C4.2.30") ?? "", /\\psi\\cdot\\frac\{\\pi\}/u);
    assert.match(byNumber.get("C4.2.37") ?? "", /k_\{yy\}\\cdot\\frac/u);
    assert.match(byNumber.get("C4.2.48") ?? "", /\\gamma_\{M1\}\}\\cdot\\left\[/u);
});

test("C4.2 pagine 104-113 conserva i prodotti anche nella matematica inline", async () => {
    const ids = ["c4.2.3.5", "c4.2.4.1.3.4.1"];
    const units = await Promise.all(
        ids.map((id) => json(`corpus/units/circ2019/${id}.json`)),
    );
    const math = units.flatMap((unit) =>
        unit.blocks.filter(
            ({ evidence }: { evidence?: { pdfPage?: number } }) =>
                (evidence?.pdfPage ?? 0) >= 104 &&
                (evidence?.pdfPage ?? 0) <= 113,
        ).flatMap(
            ({ text }: { text?: { inline?: Array<{ kind: string; value: string; latex?: string }> } }) =>
                (text?.inline ?? []).filter(({ kind }) => kind === "math"),
        ),
    );
    for (const part of math.filter(({ value }) => value.includes("·"))) {
        assert.equal(
            part.latex?.match(/\\cdot/gu)?.length ?? 0,
            part.value.match(/·/gu)?.length ?? 0,
            part.value,
        );
    }
});

test("C4.2 pagine 114-123 conserva 46 formule valide e i prodotti ufficiali", async () => {
    const manifests = await Promise.all(
        ["c", "d", "e", "f", "g", "h", "i", "j"].map((suffix) =>
            json(`corpus/assets/circ2019/C4.2-step2${suffix}.json`),
        ),
    );
    const formulas = manifests.flatMap((manifest) =>
        manifest.formulas.filter(
            ({ pdfPage }: { pdfPage: number }) =>
                pdfPage >= 114 && pdfPage <= 123,
        ),
    );
    assert.equal(formulas.length, 46);
    const expectedProducts = new Map<string, number>([
        ["c4.2.4.1.3.4.1-sigma-e", 3], ["C4.2.52", 4],
        ["C4.2.53", 4], ["C4.2.55", 3], ["C4.2.56", 5],
        ["C4.2.59", 3], ["C4.2.60", 1], ["C4.2.61", 2],
        ["C4.2.62", 1], ["C4.2.65", 2], ["C4.2.70", 1],
        ["C4.2.71", 1], ["C4.2.72", 1], ["C4.2.75", 1],
        ["C4.2.77", 2], ["C4.2.79", 1], ["C4.2.80", 1],
        ["C4.2.81.a", 5], ["C4.2.81.b", 5], ["C4.2.82", 4],
        ["C4.2.85", 3], ["C4.2.86", 2], ["C4.2.87", 5],
        ["C4.2.88", 2], ["C4.2.89", 1], ["C4.2.90", 2],
        ["C4.2.91", 1], ["C4.2.92", 1],
    ]);
    for (const formula of formulas) {
        const key = formula.officialNumber ?? formula.id.split(":").at(-1);
        assert.equal(
            formula.latex.match(/\\cdot/gu)?.length ?? 0,
            expectedProducts.get(key) ?? 0,
            key,
        );
        assert.doesNotMatch(formula.latex, /[\u0000-\u001f]/u, key);
    }
    const byNumber = new Map<string, string>(
        formulas.map(
            ({ officialNumber, latex }: { officialNumber: string; latex: string }) =>
                [officialNumber, latex],
        ),
    );
    assert.match(byNumber.get("C4.2.56") ?? "", /\\left\(.+\\right\)/u);
    assert.match(byNumber.get("C4.2.81.a") ?? "", /b_1\\cdot b_2/u);
    assert.match(byNumber.get("C4.2.87") ?? "", /300\\cdot b\\cdot f_y/u);
});

test("C4.2 pagine 114-123 conserva i prodotti inline e la punteggiatura", async () => {
    const ids = [
        "c4.2.4.1.3.4.1", "c4.2.4.1.3.4.2", "c4.2.4.1.3.4.3",
        "c4.2.4.1.3.4.4", "c4.2.4.1.3.4.5", "c4.2.4.1.3.4.6",
        "c4.2.4.1.3.4.7", "c4.2.4.1.3.4.8", "c4.2.4.1.3.4.9",
        "c4.2.4.1.4.1", "c4.2.4.1.4.2", "c4.2.4.1.4",
    ];
    const units = await Promise.all(
        ids.map((id) => json(`corpus/units/circ2019/${id}.json`)),
    );
    const blocks = units.flatMap((unit) => unit.blocks).filter(
        ({ evidence }: { evidence?: { pdfPage?: number } }) =>
            (evidence?.pdfPage ?? 0) >= 114 &&
            (evidence?.pdfPage ?? 0) <= 123,
    );
    const math = blocks.flatMap(
        ({ text }: { text?: { inline?: Array<{ kind: string; value: string; latex?: string }> } }) =>
            (text?.inline ?? []).filter(({ kind }) => kind === "math"),
    );
    for (const part of math.filter(({ value }) => value.includes("·"))) {
        assert.equal(
            part.latex?.match(/\\cdot/gu)?.length ?? 0,
            part.value.match(/·/gu)?.length ?? 0,
            part.value,
        );
    }
    assert.ok(
        blocks.some(({ text }: { text?: { normalized?: string } }) =>
            text?.normalized?.includes("N_Ed·e_N, prodotto dalla sollecitazione"),
        ),
    );
});

test("C4.2 pagine 124-133 conserva le sei formule di fatica e la formula tabellare", async () => {
    const manifests = await Promise.all(
        ["n", "o", "p"].map((suffix) =>
            json(`corpus/assets/circ2019/C4.2-step2${suffix}.json`),
        ),
    );
    const formulas = manifests.flatMap((manifest) =>
        manifest.formulas.filter(
            ({ pdfPage }: { pdfPage: number }) =>
                pdfPage >= 124 && pdfPage <= 133,
        ),
    );
    assert.deepEqual(
        formulas.map(({ officialNumber }: { officialNumber: string }) => officialNumber),
        ["C4.2.93", "C4.2.94", "C4.2.95", "C4.2.96", "C4.2.97", "C4.2.98"],
    );
    const byNumber = new Map<string, string>(
        formulas.map(
            ({ officialNumber, latex }: { officialNumber: string; latex: string }) =>
                [officialNumber, latex],
        ),
    );
    assert.equal(byNumber.get("C4.2.93"), "\\Delta\\sigma_{i,d}=\\gamma_{Mf}\\Delta\\sigma_i");
    assert.match(byNumber.get("C4.2.94") ?? "", /2\\cdot10\^6/u);
    assert.match(byNumber.get("C4.2.94") ?? "", /\^\{1\/\(m\+2\)\}/u);
    assert.equal(
        byNumber.get("C4.2.95"),
        "\\Delta\\sigma_D=0{,}737\\Delta\\sigma_C;\\qquad\\Delta\\sigma_L=0{,}549\\Delta\\sigma_C",
    );
    assert.match(byNumber.get("C4.2.96") ?? "", /N\\le10\^8/u);
    assert.equal(byNumber.get("C4.2.97"), "\\Delta\\tau_L=0{,}457\\Delta\\tau_C");
    assert.equal(
        byNumber.get("C4.2.98"),
        "\\Delta\\tau_C=90\\left(\\frac{\\rho}{2200}\\right)^2\\,\\mathrm{MPa}",
    );
    for (const formula of formulas) {
        assert.doesNotMatch(formula.latex, /[\u0000-\u001f]/u, formula.officialNumber);
    }

    const step2o = manifests[1];
    const tableXIIb = step2o.tables.find(
        ({ officialNumber }: { officialNumber: string }) => officialNumber === "C4.2.XII.b",
    );
    assert.equal(
        tableXIIb.rows[0][3].latex,
        "\\begin{gathered}\\Delta\\tau\\text{ calcolati con}\\\\\\Delta\\tau=\\frac{\\Delta V\\cdot S(t)}{I\\cdot t}\\end{gathered}",
    );
});

test("C4.2 pagine 134-143 conserva 43 formule valide e i prodotti ufficiali", async () => {
    const manifests = await Promise.all(
        ["q", "r", "s", "t", "u", "v", "w", "x", "y", "z"].map((suffix) =>
            json(`corpus/assets/circ2019/C4.2-step2${suffix}.json`),
        ),
    );
    const formulas = manifests.flatMap((manifest) =>
        manifest.formulas.filter(
            ({ pdfPage }: { pdfPage: number }) => pdfPage >= 134 && pdfPage <= 143,
        ),
    );
    assert.equal(formulas.length, 43);
    const expectedProducts = new Map<string, number>([
        ["C4.2.100", 1], ["C4.2.101", 4], ["C4.2.103", 4],
        ["C4.2.105", 3], ["C4.2.108", 1], ["C4.2.109", 1],
        ["C4.2.111", 3], ["C4.2.112", 1], ["C4.2.113", 1],
        ["C4.2.114", 1], ["C4.2.115", 1], ["C4.2.116", 1],
        ["C4.2.117", 1], ["C4.2.118", 1], ["C4.2.121", 3],
        ["C4.2.122", 1], ["C4.2.123", 2], ["C4.2.126", 3],
        ["C4.2.127", 3], ["C4.2.128", 2], ["C4.2.129", 3],
        ["C4.2.130", 1], ["C4.2.132", 4], ["C4.2.133", 3],
        ["C4.2.134", 3], ["C4.2.135", 3], ["C4.2.136", 1],
        ["C4.2.137", 2], ["C4.2.138", 6], ["C4.2.140", 4],
    ]);
    for (const formula of formulas) {
        assert.equal(
            formula.latex.match(/\\cdot/gu)?.length ?? 0,
            expectedProducts.get(formula.officialNumber) ?? 0,
            formula.officialNumber,
        );
        assert.doesNotMatch(formula.latex, /[\u0000-\u001f]/u, formula.officialNumber);
    }
    const byNumber = new Map<string, string>(
        formulas.map(
            ({ officialNumber, latex }: { officialNumber: string; latex: string }) =>
                [officialNumber, latex],
        ),
    );
    assert.match(byNumber.get("C4.2.101") ?? "", /f_\{myk\}=f_\{yk\}/u);
    assert.match(byNumber.get("C4.2.105") ?? "", /\\sigma_\{cr,s\}=2\\cdot/u);
    assert.match(byNumber.get("C4.2.119") ?? "", /\\pm/u);
    assert.match(byNumber.get("C4.2.131") ?? "", /\\phi6\{,\}4/u);
    assert.match(byNumber.get("C4.2.138") ?? "", /0\{,\}45\\cdot t\\cdot d/u);
});

test("C4.2 pagine 134-143 conserva i prodotti nella matematica inline", async () => {
    const ids = ["c4.2.12.1.1", "c4.2.12.1.3", "c4.2.12.1.4"];
    const units = await Promise.all(
        ids.map((id) => json(`corpus/units/circ2019/${id}.json`)),
    );
    const math = units.flatMap((unit) =>
        unit.blocks.filter(
            ({ evidence }: { evidence?: { pdfPage?: number } }) =>
                (evidence?.pdfPage ?? 0) >= 134 &&
                (evidence?.pdfPage ?? 0) <= 143,
        ).flatMap(
            ({ text }: { text?: { inline?: Array<{ kind: string; value: string; latex?: string }> } }) =>
                (text?.inline ?? []).filter(({ kind }) => kind === "math"),
        ),
    );
    const products = math.filter(({ value }) => value.includes("·"));
    assert.equal(products.length, 4);
    for (const part of products) {
        assert.equal(
            part.latex?.match(/\\cdot/gu)?.length ?? 0,
            part.value.match(/·/gu)?.length ?? 0,
            part.value,
        );
    }
});

test("C4.2 pagine 144-146 conserva 25 formule e i prodotti ufficiali", async () => {
    const manifests = await Promise.all(
        ["aa", "ab", "ad", "ae"].map((suffix) =>
            json(`corpus/assets/circ2019/C4.2-step2${suffix}.json`),
        ),
    );
    const formulas = manifests.flatMap((manifest) => manifest.formulas);
    assert.equal(formulas.length, 25);
    const expected = new Map<string, number>([
        ["C4.2.142", 3], ["C4.2.143", 1], ["C4.2.144", 2], ["C4.2.146", 4],
        ["C4.2.148", 5], ["C4.2.149", 1], ["C4.2.150", 1], ["C4.2.151", 2],
        ["C4.2.152", 2], ["C4.2.153", 3], ["C4.2.154", 13], ["C4.2.155", 3],
        ["C4.2.156", 1], ["C4.2.157", 3], ["C4.2.158", 8], ["C4.2.159", 3],
        ["C4.2.160", 4], ["C4.2.161", 2], ["C4.2.162", 13], ["C4.2.163", 5],
        ["C4.2.164", 4], ["C4.2.166", 1],
    ]);
    for (const formula of formulas) {
        assert.equal(
            formula.latex.match(/\\cdot/gu)?.length ?? 0,
            expected.get(formula.officialNumber) ?? 0,
            formula.officialNumber,
        );
        assert.doesNotMatch(formula.latex, /[\u0000-\u001f]/u, formula.officialNumber);
    }
});

test("C4.2 pagine 144-146 conserva i prodotti inline", async () => {
    const units = await Promise.all(
        ["c4.2.12.1.7.4.1", "c4.2.12.1.7.6.1"].map((id) =>
            json(`corpus/units/circ2019/${id}.json`),
        ),
    );
    const products = units.flatMap((unit) => unit.blocks).flatMap(
        ({ text }: { text?: { inline?: Array<{ kind: string; value: string; latex?: string }> } }) =>
            (text?.inline ?? []).filter(({ kind, value }) => kind === "math" && value.includes("·")),
    );
    assert.equal(products.length, 3);
    for (const part of products) {
        assert.equal(part.latex?.match(/\\cdot/gu)?.length ?? 0, part.value.match(/·/gu)?.length ?? 0);
    }
});
