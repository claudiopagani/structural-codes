import { createHash } from "node:crypto";
import {
  copyFile,
  mkdir,
  readFile,
  readdir,
  writeFile,
} from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const viewerRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(viewerRoot, "..");
const corpusRoot = join(repositoryRoot, "corpus", "units");
const reportFile = join(
  repositoryRoot,
  "reports",
  "migration",
  "core-concrete-corpus.json",
);
const outputFile = join(viewerRoot, "public", "data", "corpus.json");
const assetManifestDirectory = join(repositoryRoot, "corpus", "assets");

const documentMetadata = {
  ntc2018: {
    shortLabel: "NTC 2018",
    label: "Norme Tecniche per le Costruzioni",
    sourceUrl:
      "https://www.gazzettaufficiale.it/eli/gu/2018/02/20/42/so/8/sg/pdf",
    publicationUrl:
      "https://www.gazzettaufficiale.it/eli/id/2018/02/20/18A00716/sg",
    localSourcePath: "raw-sources/ntc2018/gu-42-so8-2018-02-20.pdf",
  },
  circ2019: {
    shortLabel: "Circolare 7/2019",
    label: "Istruzioni per l’applicazione delle NTC 2018",
    sourceUrl:
      "https://www.gazzettaufficiale.it/eli/gu/2019/02/11/35/so/5/sg/pdf",
    publicationUrl:
      "https://www.gazzettaufficiale.it/eli/id/2019/02/11/19A00855/sg",
    localSourcePath: "raw-sources/circ2019/circolare-7-2019.pdf",
  },
};

async function json(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

async function loadUnits(document) {
  const directory = join(corpusRoot, document);
  const files = (await readdir(directory))
    .filter((file) => file.endsWith(".json"))
    .sort((left, right) => left.localeCompare(right, "it", { numeric: true }));

  return Promise.all(
    files.map(async (file) => {
      const unit = await json(join(directory, file));
      return {
        id: unit.id,
        document,
        workId: unit.workId,
        expressionId: unit.expressionId,
        legacyAliases: unit.legacyAliases,
        kind: unit.kind,
        numbering: unit.numbering,
        title: unit.title,
        hierarchy: unit.hierarchy,
        validity: unit.validity,
        blocks: unit.blocks.map((block) => ({
          blockId: block.blockId,
          kind: block.kind,
          origin: block.origin,
          text: block.text,
          assetId: block.assetId,
          evidence: block.evidence,
        })),
        citations: unit.citations,
        relations: unit.relations,
        assets: unit.assets,
        workflow: unit.workflow,
      };
    }),
  );
}

const report = await json(reportFile);
const assetManifestFiles = (
  await readdir(assetManifestDirectory, { recursive: true })
).filter((file) => file.endsWith(".json"));
const assetManifests = await Promise.all(
  assetManifestFiles.map((file) => json(join(assetManifestDirectory, file))),
);
const assetManifest = {
  status: assetManifests.every(({ status }) => status === "source-checked")
    ? "source-checked"
    : "transcribed-unreviewed",
  formulas: assetManifests.flatMap(({ formulas }) => formulas),
  tables: assetManifests.flatMap(({ tables }) => tables),
  figures: assetManifests.flatMap(({ figures }) => figures),
};
const documents = Object.keys(documentMetadata);
const units = (
  await Promise.all(documents.map((document) => loadUnits(document)))
)
  .flat()
  .sort((left, right) => {
    if (left.document !== right.document) {
      return documents.indexOf(left.document) - documents.indexOf(right.document);
    }
    return left.numbering.sortKey.localeCompare(right.numbering.sortKey, "it", {
      numeric: true,
    });
  });

const payload = {
  formatVersion: 1,
  generatedAt: report.asOf,
  fingerprintSha256: report.fingerprintSha256,
  status: report.status,
  disclaimer: report.disclaimer,
  stats: {
    units: report.totals.canonicalUnits,
    blocks: units.reduce(
      (total, unit) =>
        total + unit.blocks.filter((block) => block.text !== undefined).length,
      0,
    ),
    proposedRelations: report.totals.proposedRelations,
    sourceReviewCompleted: 0,
    assetCandidateUnits: report.documents.reduce(
      (total, document) => total + document.unitsWithAssetCandidates,
      0,
    ),
  },
  documents: Object.fromEntries(
    documents.map((document) => {
      const reportDocument = report.documents.find(
        (candidate) => candidate.document === document,
      );
      return [
        document,
        {
          ...documentMetadata[document],
          units: reportDocument.canonicalUnits,
          blocks: units
            .filter((unit) => unit.document === document)
            .reduce(
              (total, unit) =>
                total +
                unit.blocks.filter((block) => block.text !== undefined).length,
              0,
            ),
          pages: reportDocument.pages,
        },
      ];
    }),
  ),
  assets: {
    status: assetManifest.status,
    formulas: Object.fromEntries(
      assetManifest.formulas.map((asset) => [asset.id, asset]),
    ),
    tables: Object.fromEntries(
      assetManifest.tables.map((asset) => [asset.id, asset]),
    ),
    figures: Object.fromEntries(
      assetManifest.figures.map((asset) => [asset.id, asset]),
    ),
  },
  units,
};

const serialized = JSON.stringify(payload);
const digest = createHash("sha256").update(serialized).digest("hex");
await mkdir(dirname(outputFile), { recursive: true });
await writeFile(outputFile, `${serialized}\n`, "utf8");
for (const figure of assetManifest.figures) {
  const source = join(repositoryRoot, "corpus", "assets", figure.imagePath);
  const destination = join(viewerRoot, "public", "assets", figure.imagePath);
  await mkdir(dirname(destination), { recursive: true });
  await copyFile(source, destination);
}

console.log(
  `sync-corpus: ${units.length} unità, ${payload.stats.blocks} blocchi testuali logici, ${assetManifest.formulas.length + assetManifest.tables.length + assetManifest.figures.length} asset, sha256 ${digest}`,
);
