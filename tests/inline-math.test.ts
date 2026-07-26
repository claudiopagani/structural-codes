import assert from "node:assert/strict";
import test from "node:test";
import {
    buildInlineSegments,
    inlineText,
} from "../scripts/lib/inline-math.ts";

test("segmenta grandezze, pedici, greco e operatori senza alterare il testo", () => {
    const normalized =
        "La verifica MEd ≤ MRd usa fck, εcu e una tensione σcp in N/mm².";
    const segments = buildInlineSegments(normalized);

    assert.ok(segments);
    assert.equal(inlineText(segments), normalized);
    assert.deepEqual(
        segments
            .filter(({ kind }) => kind === "math")
            .map((segment) => segment.kind === "math" && segment.latex),
        [
            "M_{Ed}",
            "\\le",
            "M_{Rd}",
            "f_{ck}",
            "\\varepsilon_{cu}",
            "\\sigma_{cp}",
            "\\mathrm{N/mm^2}",
        ],
    );
});

test("non annota come matematica il normale testo discorsivo", () => {
    assert.equal(
        buildInlineSegments("Il testo normativo resta una fonte leggibile."),
        undefined,
    );
    assert.equal(
        buildInlineSegments("La combinazione fondamentale vale generalmente."),
        undefined,
    );
    assert.equal(
        buildInlineSegments("Il progettista considera d’intervento e c.a."),
        undefined,
    );
});
