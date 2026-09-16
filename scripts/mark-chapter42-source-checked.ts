import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

type Review = Record<string, unknown> & { reviewId: string };
type Issue = Record<string, unknown> & { severity: string };
type UnitRecord = {
    numbering: { official: string };
    workflow: {
        status: string;
        reviews: Review[];
        openIssues: Issue[];
    };
};

type Scope = {
    document: "ntc2018" | "circ2019";
    prefix: "4.2" | "C4.2";
    expectedUnits: number;
    note: string;
};

const root = fileURLToPath(new URL("../", import.meta.url));
const reviewedAt = "2026-09-16T22:44:07Z";
const scopes: Scope[] = [
    {
        document: "ntc2018",
        prefix: "4.2",
        expectedUnits: 67,
        note: "Paragrafo 4.2 delle NTC 2018 validato dal revisore umano: confronto integrale con il render ufficiale; nessuna anomalia bloccante residua.",
    },
    {
        document: "circ2019",
        prefix: "C4.2",
        expectedUnits: 75,
        note: "Paragrafo C4.2 della Circolare 7/2019 validato dal revisore umano: confronto integrale con il render ufficiale; nessuna anomalia bloccante residua.",
    },
];

for (const scope of scopes) {
    const directory = join(root, "corpus", "units", scope.document);
    const files = (await readdir(directory)).filter((file) => file.endsWith(".json"));
    let updated = 0;
    for (const file of files) {
        const path = join(directory, file);
        const unit = JSON.parse(await readFile(path, "utf8")) as UnitRecord;
        const numbering = unit.numbering.official;
        if (numbering !== scope.prefix && !numbering.startsWith(`${scope.prefix}.`)) continue;

        const reviewId = `${scope.document}-${numbering.toLowerCase().replaceAll(".", "-")}-source-review-01`;
        if (!unit.workflow.reviews.some((review) => review.reviewId === reviewId)) {
            unit.workflow.reviews.push({
                reviewId,
                type: "source",
                reviewer: { actorId: "reviewer:human:user-confirmation", kind: "human" },
                reviewedAt,
                result: "accepted",
                note: scope.note,
            });
        }
        unit.workflow.status = "source-checked";
        unit.workflow.openIssues = unit.workflow.openIssues.filter((issue) => issue.severity !== "blocking");
        await writeFile(path, `${JSON.stringify(unit, null, 2)}\n`, "utf8");
        updated += 1;
    }
    if (updated !== scope.expectedUnits) throw new Error(`${scope.document} ${scope.prefix}: attese ${scope.expectedUnits} unità, aggiornate ${updated}.`);
    console.log(`${scope.document} ${scope.prefix}: ${updated} unità marcate source-checked.`);
}
