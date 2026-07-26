import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { sourceRegistryV2Schema } from "../src/schema/source-registry-v2.schema.ts";

const registryFile = fileURLToPath(
    new URL("../sources/registry/sources.v2.json", import.meta.url),
);

async function registryFixture(): Promise<unknown> {
    return JSON.parse(await readFile(registryFile, "utf8")) as unknown;
}

test("registro fonti v2 conforme e privo di placeholder", async () => {
    const raw = await readFile(registryFile, "utf8");
    assert.equal(raw.includes("[DA_VERIFICARE"), false);

    const registry = sourceRegistryV2Schema.parse(JSON.parse(raw) as unknown);
    assert.equal(registry.works.length, 3);
    assert.equal(
        registry.works.find((work) => work.workId === "it-mit:dm:2018-01-17:ntc2018")
            ?.effectiveFrom,
        "2018-03-22",
    );
    assert.equal(
        registry.works.find(
            (work) => work.workId === "it-mit:dm:2023-03-09:ntc2018-amendment",
        )?.effectiveFrom,
        "2023-03-23",
    );
});

test("registro fonti v2 rifiuta workId duplicati", async () => {
    const fixture = sourceRegistryV2Schema.parse(await registryFixture());
    fixture.works.push(structuredClone(fixture.works[0]!));
    assert.equal(sourceRegistryV2Schema.safeParse(fixture).success, false);
});

test("registro fonti v2 rifiuta relazioni verso work non registrati", async () => {
    const fixture = sourceRegistryV2Schema.parse(await registryFixture());
    fixture.works[1]!.relations[0]!.targetWorkId = "work:inesistente";
    assert.equal(sourceRegistryV2Schema.safeParse(fixture).success, false);
});
