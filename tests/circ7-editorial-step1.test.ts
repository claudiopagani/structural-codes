import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

type Inline = { kind: string; value: string; latex?: string };
type Block = { kind: string; listMarker?: string; text?: { normalized: string; inline?: Inline[] }; evidence?: { pdfPage?: number } };
type Unit = { blocks: Block[] };

const root = process.cwd();
const unit = async (number: string): Promise<Unit> => JSON.parse(await readFile(join(root, "corpus", "units", "circ2019", `${number}.json`), "utf8")) as Unit;
const block = (record: Unit, prefix: string) => {
    const found = record.blocks.find((candidate) => candidate.text?.normalized.startsWith(prefix));
    assert.ok(found?.text, prefix);
    return found as Block & { text: NonNullable<Block["text"]> };
};

test("C7 pp. 197-204 conserva marker, enfasi e matematica inline verificati", async () => {
    const c7 = await unit("c7");
    assert.deepEqual(c7.blocks.filter((candidate) => candidate.kind === "list-item").map(({ listMarker }) => listMarker), ["dash", "dash", "dash"]);
    assert.ok(block(c7, "Le indicazioni relative").text.inline?.some((segment) => segment.kind === "strong" && segment.value === "sono additive e non sostitutive"));
    assert.ok(block(c7, "Ampio spazio").text.inline?.some((segment) => segment.kind === "math" && segment.value === "§ 7.10" && segment.latex === "\\S 7.10"));

    const systems = await unit("c7.2.2");
    assert.deepEqual(systems.blocks.filter((candidate) => candidate.kind === "list-item").map(({ listMarker }) => listMarker), ["none", "none", "dash", "dash"]);
    assert.ok(block(systems, "Nell’ambito del comportamento").text.inline?.some((segment) => segment.kind === "em" && segment.value === "elevata capacità dissipativa"));
    assert.ok(block(systems, "La norma definisce i criteri").text.inline?.some((segment) => segment.kind === "em" && segment.value === "“progettazione in capacità”"));

    const secondary = await unit("c7.2.3");
    assert.ok(secondary.blocks.filter((candidate) => candidate.kind === "list-item" && (candidate.evidence?.pdfPage ?? 0) <= 204).every(({ listMarker }) => listMarker === "none"));
    assert.ok(block(secondary, "Spettri di risposta di piano").text.inline?.every((segment) => segment.kind === "em"));
    assert.ok(block(secondary, "S_i(T_i) è").text.inline?.some((segment) => segment.kind === "math" && segment.value === "q" && segment.latex === "q"));
});

test("C7.2 pp. 199 e 203 conserva le didascalie strutturate", async () => {
    const manifest = JSON.parse(await readFile(join(root, "corpus", "assets", "circ2019", "7.2.json"), "utf8")) as { figures: Array<{ officialNumber: string; caption: string; captionInline?: Inline[] }>; tables: Array<{ officialNumber: string; caption: string; captionInline?: Inline[] }> };
    for (const number of ["C7.2.1", "C7.2.2"]) {
        const figure = manifest.figures.find((candidate) => candidate.officialNumber === number);
        assert.equal(figure?.captionInline?.map(({ value }) => value).join(""), figure?.caption);
        assert.equal(figure?.captionInline?.[0]?.kind, "strong");
        assert.ok(figure?.captionInline?.some((segment) => segment.kind === "em"));
    }
    const table = manifest.tables.find((candidate) => candidate.officialNumber === "C7.2.I");
    assert.equal(table?.captionInline?.map(({ value }) => value).join(""), table?.caption);
    assert.ok(table?.captionInline?.some((segment) => segment.kind === "math" && segment.latex === "q_a"));
});

test("C7 pp. 205-214 distingue glossari, elenchi e didascalie", async () => {
    const secondary = await unit("c7.2.3");
    const glossary = secondary.blocks.filter((candidate) => candidate.kind === "list-item" && candidate.evidence?.pdfPage === 205);
    assert.ok(glossary.length >= 7);
    assert.ok(glossary.every(({ listMarker }) => listMarker === "none"));
    assert.ok(block(secondary, "α è il rapporto").text.inline?.some((segment) => segment.kind === "math" && segment.value === "α" && segment.latex === "\\alpha"));

    const nonlinear = await unit("c7.3.4.2");
    for (const page of [210, 211]) {
        const expected = page === 210 ? "bullet" : "dash";
        assert.ok(nonlinear.blocks.filter((candidate) => candidate.kind === "list-item" && candidate.evidence?.pdfPage === page).every(({ listMarker }) => listMarker === expected));
    }
    assert.ok(block(nonlinear, "Metodo A, basato").text.inline?.some((segment) => segment.kind === "em" && segment.value === "Metodo A"));

    const manifest = JSON.parse(await readFile(join(root, "corpus", "assets", "circ2019", "7.2.json"), "utf8")) as { figures: Array<{ officialNumber: string; caption: string; captionInline?: Inline[] }> };
    const figure = manifest.figures.find((candidate) => candidate.officialNumber === "C7.2.4");
    assert.equal(figure?.captionInline?.map(({ value }) => value).join(""), figure?.caption);
    assert.equal(figure?.captionInline?.[0]?.kind, "strong");
    assert.equal(figure?.captionInline?.[2]?.kind, "em");
});

test("C7 pp. 215-224 conserva corsivo, trattini e didascalie delle strutture", async () => {
    const prefabricated = await unit("c7.4.5.1");
    assert.ok(block(prefabricated, "La norma prevede che altre tipologie").text.inline?.some((segment) => segment.kind === "em" && segment.value.startsWith("altre tipologie")));

    const steel = await unit("c7.5.2.1");
    assert.ok(steel.blocks.filter((candidate) => candidate.kind === "list-item" && candidate.evidence?.pdfPage === 222).every(({ listMarker }) => listMarker === "dash"));
    assert.ok(block(steel, "Una tipologia dissipativa").text.inline?.some((segment) => segment.kind === "math" && segment.latex === "5\\alpha_u/\\alpha_1"));

    const manifest = JSON.parse(await readFile(join(root, "corpus", "assets", "circ2019", "7.4.json"), "utf8")) as { figures: Array<{ officialNumber: string; caption: string; captionInline?: Inline[] }> };
    const figure = manifest.figures.find((candidate) => candidate.officialNumber === "C7.4.6");
    assert.equal(figure?.captionInline?.map(({ value }) => value).join(""), figure?.caption);
    assert.equal(figure?.captionInline?.[0]?.kind, "strong");
    assert.equal(figure?.captionInline?.[2]?.kind, "em");
});

test("C7 pp. 225-234 conserva marker, simboli e didascalie delle strutture composte", async () => {
    const composite = await unit("c7.6.4.5.1");
    const mechanisms = composite.blocks.filter((candidate) => candidate.kind === "list-item" && candidate.evidence?.pdfPage === 226);
    assert.ok(mechanisms.every(({ listMarker }) => listMarker === "dash"));
    assert.ok(block(composite, "meccanismo 1").text.inline?.some((segment) => segment.kind === "strong" && segment.value === "meccanismo 1"));
    const labelled = composite.blocks.filter((candidate) => candidate.kind === "list-item" && candidate.evidence?.pdfPage === 228 && /^[abc]\)/.test(candidate.text?.normalized ?? ""));
    assert.ok(labelled.length === 3 && labelled.every(({ listMarker }) => listMarker === "none"));

    const masonry = await unit("c7.8.1.2");
    assert.ok(block(masonry, "Le limitazioni indicate").text.inline?.some((segment) => segment.kind === "math" && segment.value === "a_gS" && segment.latex === "a_gS"));
    const confined = await unit("c7.8.4");
    assert.ok(confined.blocks.filter((candidate) => candidate.kind === "list-item").every(({ listMarker }) => listMarker === "dash"));
    assert.ok(block(confined, "in cui ν è").text.inline?.some((segment) => segment.kind === "math" && segment.latex === "\\nu=\\sigma_0/f_d=N/(A f_d)"));

    const manifest = JSON.parse(await readFile(join(root, "corpus", "assets", "circ2019", "7.6.json"), "utf8")) as { figures: Array<{ officialNumber: string; caption: string; captionInline?: Inline[] }> };
    for (const number of ["C7.6.1", "C7.6.6"]) {
        const figure = manifest.figures.find((candidate) => candidate.officialNumber === number);
        assert.equal(figure?.captionInline?.map(({ value }) => value).join(""), figure?.caption);
        assert.equal(figure?.captionInline?.[0]?.kind, "strong");
        assert.equal(figure?.captionInline?.[2]?.kind, "em");
    }
});

test("C7 pp. 235-244 conserva etichette e didascalie di ponti e isolamento", async () => {
    const scope = await unit("c7.10.1");
    assert.ok(scope.blocks.filter((candidate) => candidate.kind === "list-item").every(({ listMarker }) => listMarker === "none"));
    assert.ok(block(scope, "Per realizzare l’isolamento").text.inline?.some((segment) => segment.kind === "strong" && segment.value === "sovrastruttura"));
    const analysis = await unit("c7.10.5.3.2");
    assert.ok(analysis.blocks.filter((candidate) => candidate.kind === "list-item").every(({ listMarker }) => listMarker === "none"));
    assert.ok(block(analysis, "ξ = valore").text.inline?.some((segment) => segment.kind === "math" && segment.latex === "\\xi"));
    const manifest = JSON.parse(await readFile(join(root, "corpus", "assets", "circ2019", "7.10.json"), "utf8")) as { figures: Array<{ officialNumber: string; pdfPage: number; caption: string; captionInline?: Inline[] }> };
    assert.ok(manifest.figures.filter((figure) => figure.pdfPage >= 236 && figure.pdfPage <= 239).every((figure) => figure.captionInline?.[0]?.kind === "strong" && figure.captionInline?.map(({ value }) => value).join("") === figure.caption));
});

test("C7 pp. 245-252 conserva elenchi geotecnici e simboli inline", async () => {
    const response = await unit("c7.11.3.1.2");
    assert.ok(response.blocks.filter((candidate) => candidate.kind === "list-item").every(({ listMarker }) => listMarker === "dash"));
    const slopes = await unit("c7.11.3.5");
    assert.ok(slopes.blocks.filter((candidate) => candidate.kind === "list-item").every(({ listMarker }) => listMarker === "dash"));
    assert.ok(block(slopes, "Nei metodi pseudostatici").text.inline?.some((segment) => segment.kind === "math" && segment.latex === "F_S=\\tau_s/\\tau_m"));
    const retaining = await unit("c7.11.6.3");
    assert.ok(block(retaining, "Per tener conto").text.inline?.some((segment) => segment.kind === "math" && segment.value === "a_h" && segment.latex === "a_h"));
});
