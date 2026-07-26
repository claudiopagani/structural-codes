import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

interface CanonicalUnit {
    id: string;
    title: string;
    numbering: { official: string };
    hierarchy: { parentId: string | null };
    blocks: Array<{
        kind: string;
        assetId?: string;
        text?: { raw: string; normalized: string };
        evidence?: { transformations?: Array<{ operation: string }> };
    }>;
    assets: {
        formulaIds: string[];
        tableIds: string[];
        figureIds: string[];
    };
    workflow: {
        status: string;
        openIssues: Array<{ severity: string; type: string }>;
    };
}

interface MigrationReport {
    status: string;
    documents: Array<{
        document: string;
        canonicalUnits: number;
        canonicalBlocks: number;
    }>;
    totals: {
        canonicalUnits: number;
        canonicalBlocks: number;
        proposedRelations: number;
    };
}

const corpusDirectory = fileURLToPath(
    new URL("../corpus/units/", import.meta.url),
);
const reportFile = fileURLToPath(
    new URL("../reports/migration/core-concrete-corpus.json", import.meta.url),
);
const ntc41AssetFile = fileURLToPath(
    new URL("../corpus/assets/ntc2018/4.1.json", import.meta.url),
);

async function loadUnits(): Promise<CanonicalUnit[]> {
    const documents = await readdir(corpusDirectory, { withFileTypes: true });
    const files = (
        await Promise.all(
            documents
                .filter((entry) => entry.isDirectory())
                .map(async (entry) => {
                    const directory = new URL(
                        `../corpus/units/${entry.name}/`,
                        import.meta.url,
                    );
                    return (await readdir(directory))
                        .filter((name) => name.endsWith(".json"))
                        .map((name) => new URL(name, directory));
                }),
        )
    ).flat();

    return Promise.all(
        files.map(async (file) => {
            return JSON.parse(await readFile(file, "utf8")) as CanonicalUnit;
        }),
    );
}

test("il lotto calcestruzzo coincide con il report di migrazione", async () => {
    const report = JSON.parse(
        await readFile(reportFile, "utf8"),
    ) as MigrationReport;
    const units = await loadUnits();
    const blockCount = units.reduce(
        (total, unit) =>
            total + unit.blocks.filter((block) => block.text !== undefined).length,
        0,
    );

    assert.equal(report.status, "canonical-extracted-not-reviewed");
    assert.deepEqual(report.totals, {
        canonicalUnits: 333,
        canonicalBlocks: 700,
        proposedRelations: 89,
    });
    assert.deepEqual(
        report.documents.map(({ document, canonicalUnits }) => ({
            document,
            canonicalUnits,
        })),
        [
            { document: "ntc2018", canonicalUnits: 194 },
            { document: "circ2019", canonicalUnits: 139 },
        ],
    );
    assert.equal(units.length, report.totals.canonicalUnits);
    assert.ok(
        blockCount > report.totals.canonicalBlocks,
        "la segmentazione editoriale logica deve conservare e affinare i 700 blocchi di estrazione",
    );
});

test("tutte le unità restano estratte e bloccate dalla review della fonte", async () => {
    const units = await loadUnits();

    for (const unit of units) {
        assert.equal(unit.workflow.status, "extracted", unit.id);
        assert.equal(
            unit.workflow.openIssues.some(
                (issue) =>
                    issue.severity === "blocking" &&
                    issue.type === "normalization-review",
            ),
            true,
            unit.id,
        );
    }
});

test("il corpus canonico non contiene placeholder del legacy", async () => {
    const units = await loadUnits();
    const forbidden = /\[(?:DA_VERIFICARE|FORMULA_NON_LEGGIBILE|TABELLA_DA_REVISIONARE|FIGURA_MANCANTE|RIFERIMENTO_AMBIGUO)\]/u;

    for (const unit of units) {
        for (const block of unit.blocks) {
            if (!block.text) continue;
            assert.doesNotMatch(block.text.raw, forbidden, unit.id);
            assert.doesNotMatch(block.text.normalized, forbidden, unit.id);
        }
    }
});

test("gli anchor visuali conservano il raw corrotto e tracciano la correzione", async () => {
    const units = await loadUnits();
    const unit = units.find(
        ({ numbering }) => numbering.official === "C3.4.3.3.1",
    );

    assert.ok(unit);
    const heading = unit.blocks.find(({ kind }) => kind === "heading");
    assert.ok(heading);
    assert.ok(heading.text);
    assert.equal(
        heading.text.normalized,
        "C3.4.3.3.1 Copertura cilindrica",
    );
    assert.notEqual(heading.text.raw, heading.text.normalized);
    assert.equal(
        heading.evidence?.transformations?.some(
            ({ operation }) => operation === "manual-correction",
        ),
        true,
    );
});

test("il profilo editoriale NTC 4.1 ricompone il testo e risolve gli asset", async () => {
    const units = (await loadUnits()).filter(
        (unit) =>
            unit.id.startsWith("urn:structural-codes:it:unit:ntc2018:4.1.") ||
            unit.id === "urn:structural-codes:it:unit:ntc2018:4.1",
    );
    const manifest = JSON.parse(await readFile(ntc41AssetFile, "utf8")) as {
        formulas: Array<{ id: string }>;
        tables: Array<{ id: string }>;
        figures: Array<{ id: string; imagePath: string; sha256: string }>;
    };
    const forbiddenGlyphs =
        /[ΈΉΗƺǂǃ΅·΋ΝΑΌΏİǊΚĮȭ\u0000-\u001f\u007f-\u009f]/u;

    assert.equal(units.length, 90);
    for (const unit of units) {
        for (const block of unit.blocks) {
            if (!block.text) continue;
            assert.doesNotMatch(block.text.normalized, /\r|\n/u, block.assetId ?? unit.id);
            assert.doesNotMatch(block.text.normalized, forbiddenGlyphs, unit.id);
        }
    }

    assert.equal(manifest.formulas.length, 70);
    assert.equal(manifest.tables.length, 5);
    assert.equal(manifest.figures.length, 4);

    const section41 = units.find(
        ({ numbering }) => numbering.official === "4.1",
    );
    const nonlinearAnalysis = units.find(
        ({ numbering }) => numbering.official === "4.1.1.3",
    );
    const concreteDiagrams = units.find(
        ({ numbering }) => numbering.official === "4.1.2.1.2.1",
    );
    assert.ok(section41);
    assert.ok(nonlinearAnalysis);
    assert.ok(concreteDiagrams);
    assert.equal(
        section41.blocks.find(({ kind }) => kind === "heading")?.text
            ?.normalized,
        "4.1 COSTRUZIONI DI CALCESTRUZZO",
    );
    assert.equal(nonlinearAnalysis.title, "Analisi non lineare");
    assert.equal(
        nonlinearAnalysis.blocks.find(({ kind }) => kind === "heading")?.text
            ?.normalized,
        "4.1.1.3 Analisi non lineare",
    );
    assert.equal(
        concreteDiagrams.blocks.filter(
            ({ assetId }) =>
                assetId?.includes("material-parameters-") === true,
        ).length,
        2,
    );
    assert.equal(
        concreteDiagrams.blocks.some(
            ({ kind, text }) =>
                kind === "heading" &&
                text?.normalized === "Calcestruzzo confinato",
        ),
        true,
    );
    assert.equal(
        units.some((unit) =>
            unit.blocks.some(({ kind }) => kind === "list-item"),
        ),
        true,
    );

    const declared = new Set(
        units.flatMap((unit) => [
            ...unit.assets.formulaIds,
            ...unit.assets.tableIds,
            ...unit.assets.figureIds,
        ]),
    );
    const manifested = new Set([
        ...manifest.formulas.map(({ id }) => id),
        ...manifest.tables.map(({ id }) => id),
        ...manifest.figures.map(({ id }) => id),
    ]);
    assert.deepEqual(declared, manifested);

    for (const figure of manifest.figures) {
        const imageFile = fileURLToPath(
            new URL(`../corpus/assets/${figure.imagePath}`, import.meta.url),
        );
        const digest = createHash("sha256")
            .update(await readFile(imageFile))
            .digest("hex");
        assert.equal(digest, figure.sha256, figure.id);
    }
});
