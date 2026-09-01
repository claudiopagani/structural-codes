import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const readJson = async (relativePath: string) => JSON.parse(await readFile(join(root, relativePath), "utf8"));
type Segment = { kind: string; value: string; latex: string };
type Unit = { blocks: Array<{ kind?: string; text?: { normalized?: string; inline?: Segment[] }; evidence: { pdfPage: number } }> };
const math = (unit: Unit): Segment[] =>
    unit.blocks.flatMap((block) => block.text?.inline ?? []).filter((segment) => segment.kind === "math");

test("C7.6.5-C7.6.14 conserva prodotti, notazione trigonometrica e unità proprietarie", async () => {
    const manifest = await readJson("corpus/assets/circ2019/7.6.json");
    const formulas = manifest.formulas
        .filter(({ pdfPage }: { pdfPage: number }) => pdfPage >= 227 && pdfPage <= 229)
        .map(({ officialNumber, unitId, latex }: { officialNumber: string; unitId: string; latex: string }) => [officialNumber, unitId, latex]);
    const u451 = "urn:structural-codes:it:unit:circ2019:c7.6.4.5.1";
    const u452 = "urn:structural-codes:it:unit:circ2019:c7.6.4.5.2";
    assert.deepEqual(formulas, [
        ["C7.6.5", u451, "F_{c,max}=F_{Rd,1}+F_{Rd,2}=(0{,}7h_c+b_b)\\cdot d_{eff}\\cdot f_{cd}"],
        ["C7.6.6", u451, "F_{c,max}=F_{Rd,1}+F_{Rd,2}-2\\cdot F_{b,yd}"],
        ["C7.6.7", u451, "F_{Rd,3}=n\\cdot P_{Rd}"],
        ["C7.6.8", u451, "F_{c,max}=F_{Rd,1}+F_{Rd,2}+F_{Rd,3}=n\\cdot P_{Rd}+(0{,}7\\cdot h_c+b_b)\\cdot d_{eff}\\cdot f_{cd}"],
        ["C7.6.9", u451, "F_{c,max}=F_{Rd,1}+F_{Rd,2}+F_{Rd,3}-2\\cdot F_{b,yd}=n\\cdot P_{Rd}+(0{,}7\\cdot h_c+b_b)\\cdot d_{eff}\\cdot f_{cd}-A_{s,l,totale}\\cdot f_{yd}"],
        ["C7.6.10", u451, "F_{sc}=b^+_{eff}\\cdot d_{eff}\\cdot(0{,}85\\cdot f_{ck}/\\gamma_c)"],
        ["C7.6.11", u451, "F_{st}=A_{s,l,totale}\\cdot f_{yd}"],
        ["C7.6.12", u452, "V_{wp,c,Rd}=0{,}85\\cdot\\nu\\cdot A_c\\cdot f_{cd}\\cdot\\operatorname{sen}(\\vartheta)"],
        ["C7.6.13", u452, "A_c=0{,}8\\cdot(b_c-t_w)\\cdot(h-2\\cdot t_f)\\cos(\\vartheta)\\quad\\text{con}\\quad\\vartheta=\\arctan\\left(\\frac{h-2\\cdot t_f}{z}\\right)"],
        ["C7.6.14", u452, "\\nu=0{,}55\\cdot\\left(1+2\\cdot\\left(\\frac{N_{Ed}}{N_{pl,Rd}}\\right)\\right)\\le1"],
    ]);
});

test("C7.8 conserva punti decimali, moltiplicazioni e il capoverso matematico di pagina 234", async () => {
    const ordinary = await readJson("corpus/units/circ2019/c7.8.2.2.1.json") as Unit;
    assert.equal(math(ordinary).some(({ value, latex }) => value === "ν ≤ 0.2" && latex === "\\nu\\le0.2"), true);
    assert.equal(math(ordinary).some(({ value, latex }) => value === "1.25% x (1-ν)" && latex === "1.25\\%\\times(1-\\nu)"), true);

    const confined = await readJson("corpus/units/circ2019/c7.8.4.json") as Unit;
    const continuation = confined.blocks.find(({ evidence }) => evidence.pdfPage === 234);
    assert.match(continuation?.text?.normalized ?? "", /1\.5% x \(1-ν\)/);
    assert.equal(math(confined).some(({ value, latex }) => value === "1.5% x (1-ν)" && latex === "1.5\\%\\times(1-\\nu)"), true);
});

test("C7.10.1 conserva l'espressione completa con pedice IS e il prodotto ufficiale", async () => {
    const unit = await readJson("corpus/units/circ2019/c7.10.1.json") as Unit;
    const segments = math(unit);
    assert.equal(segments.some(({ value, latex }) => value === "T_IS ≥ 3·T_bf" && latex === "T_{IS}\\ge3\\cdot T_{bf}"), true);
    assert.equal(segments.some(({ value, latex }) => value === "T_IS>2,0 s" && latex === "T_{IS}>2{,}0\\,\\mathrm{s}"), true);
    assert.equal(segments.some(({ value, latex }) => value === "5%" && latex === "5\\%"), true);
});

test("C7.10.1-C7.10.8 conserva maiuscole, prodotti e divisioni lineari della fonte", async () => {
    const manifest = await readJson("corpus/assets/circ2019/7.10.json");
    assert.deepEqual(manifest.formulas.map(({ officialNumber, latex }: { officialNumber: string; latex: string }) => [officialNumber, latex]), [
        ["C7.10.1", "k_C=\\frac{1}{\\frac{1}{k_d}+\\frac{1}{k_a}}"],
        ["C7.10.2", "k_{\\mathrm{TOT}}=k_s+k_c"],
        ["C7.10.3", "T_{is}=2\\pi\\sqrt{M/K_{esi}}"],
        ["C7.10.4", "d_{dc}=\\frac{M\\cdot S_e(T_{is},\\xi_{esi})}{K_{esi,min}}"],
        ["C7.10.5", "C=\\alpha M+\\beta K"],
        ["C7.10.6", "\\alpha=4\\pi(\\xi_2T_2-\\xi_1T_1)/(T_2^2-T_1^2)"],
        ["C7.10.7", "\\beta=[(T_1T_2)/\\pi][(\\xi_1T_2-\\xi_2T_1)/(T_2^2-T_1^2)]"],
        ["C7.10.8", "\\xi_i=0.5[(\\alpha T_i)/(2\\pi)+(2\\pi\\beta)/(T_i)]"],
    ]);

    const stiffness = await readJson("corpus/units/circ2019/c7.10.4.1.json") as Unit;
    assert.match(stiffness.blocks.map(({ text }) => text?.normalized ?? "").join(" "), /k_s la rigidezza del telaio.*k_a la rigidezza del supporto/u);
});

test("C7.11 pagine 244-246 conserva prodotto, unità e intervallo percentuale inline", async () => {
    const response = await readJson("corpus/units/circ2019/c7.11.3.1.json") as Unit;
    assert.equal(math(response).some(({ value, latex }) => value === "a_max=S_s·a_g" && latex === "a_{max}=S_s\\cdot a_g"), true);
    const model = await readJson("corpus/units/circ2019/c7.11.3.1.2.1.json") as Unit;
    assert.equal(math(model).some(({ value, latex }) => value === "800 m/s" && latex === "800\\,\\mathrm{m/s}"), true);
    const procedure = await readJson("corpus/units/circ2019/c7.11.3.1.2.3.json") as Unit;
    assert.equal(math(procedure).some(({ value, latex }) => value === "1-2%" && latex === "1\\text{-}2\\%"), true);
});

test("C7.11 pagine 247-252 conserva rapporti, glifi e punti decimali ufficiali", async () => {
    const liquefaction = await readJson("corpus/units/circ2019/c7.11.3.4.json") as Unit;
    assert.equal(math(liquefaction).some(({ value, latex }) => value === "CRR = τ_f/σ’_v0" && latex === "CRR=\\tau_f/\\sigma'_{v0}"), true);
    assert.equal(math(liquefaction).some(({ value, latex }) => value === "CSR = τ_media/σ’_v0" && latex === "CSR=\\tau_{media}/\\sigma'_{v0}"), true);
    assert.equal(math(liquefaction).some(({ value, latex }) => value === "V_s" && latex === "V_s"), true);
    assert.equal(math(liquefaction).some(({ value, latex }) => value === "0,1g" && latex === "0{,}1g"), true);

    const slopes = await readJson("corpus/units/circ2019/c7.11.3.5.json") as Unit;
    assert.equal(math(slopes).some(({ value, latex }) => value === "F_S=τ_s/τ_m" && latex === "F_S=\\tau_s/\\tau_m"), true);
    assert.equal(math(slopes).some(({ value, latex }) => value === "a_max>0.15·g" && latex === "a_{max}>0.15\\cdot g"), true);
    assert.equal(math(slopes).some(({ value, latex }) => value === "δ_cu" && latex === "\\delta_{cu}"), true);
    assert.equal(math(slopes).some(({ value, latex }) => value === "S" && latex === "S"), true);
    assert.equal(math(slopes).some(({ value, latex }) => value === "S_S" && latex === "S_S"), true);
    assert.equal(math(slopes).some(({ value, latex }) => value === "k_heq" && latex === "k_{heq}"), true);

    const excavations = await readJson("corpus/units/circ2019/c7.11.4.json") as Unit;
    assert.equal(math(excavations).some(({ value, latex }) => value === "1.20" && latex === "1.20"), true);

    const foundations = await readJson("corpus/units/circ2019/c7.11.5.3.1.json") as Unit;
    assert.equal(math(foundations).some(({ value, latex }) => value === "2.3" && latex === "2.3"), true);
    assert.equal(math(foundations).some(({ value, latex }) => value === "1.8" && latex === "1.8"), true);
    assert.equal(math(foundations).filter(({ value }) => value === "2.3").length, 1);
    assert.equal(math(foundations).some(({ value, latex }) => value === "K_h" && latex === "K_h"), true);

    const walls = await readJson("corpus/units/circ2019/c7.11.6.2.json") as Unit;
    assert.equal(math(walls).some(({ value, latex }) => value === "50%" && latex === "50\\%"), true);
    assert.equal(math(walls).some(({ value, latex }) => value === "1.00" && latex === "1.00"), true);
    assert.equal(math(walls).some(({ value }) => value === "2.3"), false);

    const bulkheads = await readJson("corpus/units/circ2019/c7.11.6.3.json") as Unit;
    assert.equal(math(bulkheads).some(({ value, latex }) => value === "β<1" && latex === "\\beta<1"), true);
    assert.equal(math(bulkheads).some(({ value, latex }) => value === "β = 1" && latex === "\\beta=1"), true);
    assert.equal(math(bulkheads).some(({ value, latex }) => value === "α" && latex === "\\alpha"), true);
    assert.equal(math(bulkheads).some(({ value }) => value === "2.3"), false);
});

test("C8 pagine 255-256 conserva gli indicatori zeta e la soglia 0,6", async () => {
    const safety = await readJson("corpus/units/circ2019/c8.3.json") as Unit;
    assert.equal(math(safety).some(({ value, latex }) => value === "ζ_E" && latex === "\\zeta_E"), true);
    assert.equal(math(safety).some(({ value, latex }) => value === "ζ_{v,i}" && latex === "\\zeta_{v,i}"), true);
    assert.equal(math(safety).some(({ value, latex }) => value === "a_g S" && latex === "a_g S"), true);

    const improvement = await readJson("corpus/units/circ2019/c8.4.2.json") as Unit;
    assert.equal(math(improvement).some(({ value, latex }) => value === "0,6" && latex === "0{,}6"), true);
});

test("C8 pagine 257-266 conserva soglie, fattori di confidenza e formule statistiche", async () => {
    const improvement = await readJson("corpus/units/circ2019/c8.4.2.json") as Unit;
    assert.equal(math(improvement).some(({ value, latex }) => value === "0,1" && latex === "0{,}1"), true);
    assert.equal(math(improvement).some(({ value, latex }) => value === "1,0" && latex === "1{,}0"), true);

    const adjustment = await readJson("corpus/units/circ2019/c8.4.3.json") as Unit;
    assert.equal(math(adjustment).some(({ value, latex }) => value === "10%" && latex === "10\\%"), true);
    assert.equal(math(adjustment).some(({ value, latex }) => value === "0,8" && latex === "0{,}8"), true);

    const masonry = await readJson("corpus/units/circ2019/c8.5.3.1.json") as Unit;
    assert.equal(math(masonry).some(({ value, latex }) => value === "50%" && latex === "50\\%"), true);

    const knowledge = await readJson("corpus/units/circ2019/c8.5.4.json") as Unit;
    assert.equal(math(knowledge).some(({ value, latex }) => value === "FC=1,35" && latex === "\\mathrm{FC}=1{,}35"), true);
    assert.equal(math(knowledge).some(({ value, latex }) => value === "FC=1,2" && latex === "\\mathrm{FC}=1{,}2"), true);
    assert.equal(math(knowledge).some(({ value, latex }) => value === "FC=1" && latex === "\\mathrm{FC}=1"), true);

    const manifest = await readJson("corpus/assets/circ2019/C8.5-step2.json");
    assert.deepEqual(manifest.formulas.map(({ officialNumber, latex }: { officialNumber: string; latex: string }) => [officialNumber, latex]), [
        ["C8.5.4.1", "\\mu'=\\frac{1}{2}\\left(X_{\\min}+X_{\\max}\\right)"],
        ["C8.5.4.2", "\\sigma'=\\frac{1}{2}\\left(X_{\\max}-X_{\\min}\\right)"],
        ["C8.5.4.3", "\\mu''=\\frac{n\\bar{X}+\\kappa\\mu'}{n+\\kappa}"],
    ]);
    const tables = await readJson("corpus/assets/circ2019/C8.5-step1.json");
    assert.equal(tables.tables[0].rows[3][6].latex, "13\\div16\\,\\text{(**)}");
});

test("C8 pagine 267-276 conserva tabelle, rapporti e formule cinematiche ufficiali", async () => {
    const confidence = await readJson("corpus/units/circ2019/c8.5.4.2.json") as Unit;
    assert.equal(math(confidence).some(({ value, latex }) => value === "FC=1,35" && latex === "\\mathrm{FC}=1{,}35"), true);

    const actions = await readJson("corpus/units/circ2019/c8.5.5.1.json") as Unit;
    assert.equal(math(actions).some(({ value, latex }) => value === "q = 2,0 α_u/α_1" && latex === "q=2{,}0\\,\\alpha_u/\\alpha_1"), true);
    assert.equal(math(actions).some(({ value, latex }) => value === "q = 1,75 α_u/α_1" && latex === "q=1{,}75\\,\\alpha_u/\\alpha_1"), true);

    const tableManifest = await readJson("corpus/assets/circ2019/C8.5-step2.json");
    const table = tableManifest.tables.find(({ officialNumber }: { officialNumber: string }) => officialNumber === "C8.5.IV");
    assert.equal(table.headers[0][5].latex, "\\mathrm{FC}\\,\\text{(*)}");
    assert.deepEqual(table.rows.map((row: Array<{ latex?: string }>) => row.at(-1)?.latex), ["1{,}35", "1{,}20", "1{,}00"]);

    const firstManifest = await readJson("corpus/assets/circ2019/C8.7-step1a.json");
    const secondManifest = await readJson("corpus/assets/circ2019/C8.7-step1b.json");
    const formulas = [...firstManifest.formulas, ...secondManifest.formulas]
        .filter(({ pdfPage }: { pdfPage: number }) => pdfPage >= 273 && pdfPage <= 276)
        .map(({ officialNumber, latex }: { officialNumber: string; latex: string }) => [officialNumber, latex]);
    assert.deepEqual(formulas, [
        ["C8.7.1.1", "\\alpha_0=\\frac{\\sum_{k=1}^{N}P_k\\delta_{P_y,k}-\\sum_{k=1}^{m}F_k\\delta_{F,k}+L_i}{\\sum_{k=1}^{N}(P_k+Q_k)\\delta_{PQ_x,k}}"],
        ["C8.7.1.2", "F=0.4\\,n(n+1)\\,\\Phi\\,\\mu\\,l^2\\,t_s\\,W"],
        ["C8.7.1.3", "a=\\frac{\\alpha(d_C)g}{e^*FC}"],
        ["C8.7.1.4", "d=d_C\\frac{\\sum_{k=1}^{N}(P_k+Q_k)\\delta_{PQ_x,K}^{2}}{\\delta_{Cx}\\sum_{k=1}^{N}(P_k+Q_k)\\delta_{PQ_x,K}}"],
        ["C8.7.1.5", "e^*=\\frac{\\left[\\sum_{k=1}^{N}(P_k+Q_k)\\delta_{PQ_x,k}\\right]^2}{\\left[\\sum_{k=1}^{N}(P_k+Q_k)\\right]\\left[\\sum_{k=1}^{N}(P_k+Q_k)\\delta_{PQ_x,k}^{2}\\right]}"],
        ["C8.7.1.6", "a=\\frac{4\\pi^2}{T_0^2}d"],
        ["C8.7.1.7", "T_0=\\kappa\\lambda L\\sqrt{\\frac{W}{Eg}}"],
        ["C8.7.1.8", "a_{Z,SLD}=\\frac{\\alpha_0g}{e^*FC}"],
        ["C8.7.1.9", "S_{eZ,SLD}(T_0)=\\frac{a_y}{FC}\\simeq\\frac{\\alpha_0g}{e^*FC}"],
        ["C8.7.1.10", "T_{SLV}=1{,}68\\pi\\sqrt{\\frac{d_{SLV}}{a(d_{SLV})}}"],
        ["C8.7.1.11", "T_{SLC}=1{,}56\\pi\\sqrt{\\frac{d_{SLC}}{a(d_{SLC})}}"],
    ]);

    const displacement = await readJson("corpus/units/circ2019/c8.7.1.2.1.8.json") as Unit;
    const normalized = displacement.blocks.map(({ text }) => text?.normalized ?? "").join(" ");
    assert.match(normalized, /\[T_0, T_\{SLV\}\]/u);
    assert.match(normalized, /S_\{De\}\(T\)/u);
    assert.equal(math(displacement).some(({ value, latex }) => value === "T²/4π²" && latex === "T^2/(4\\pi^2)"), true);
});

test("C8 pagine 277-286 conserva esponenti, glifi e matematica inline della fonte", async () => {
    const expected = new Map<string, string>([
        ["C8.7.1.12", "d_{SLV}=S_{eZ}(T_{SLV},\\xi,z)\\frac{T_{SLV}^{2}}{4\\pi^{2}}\\left(\\ge S_{eZ}(T_1,\\xi,z)\\frac{b^{2}T_1^{2}}{4\\pi^{2}}\\quad\\mathrm{per}\\ T_{SLV}>bT_1\\right)"],
        ["C8.7.1.14", "f_{v,lim}=\\frac{0.065f_b}{0.7}"],
        ["C8.7.1.15", "f_{ftd}=\\min\\left(\\frac{f_{btd}}{2};f_{v0d}+\\frac{\\mu\\sigma_y}{\\Phi}\\right)"],
        ["C8.7.1.16", "V_t=l\\,t\\,\\frac{1.5\\tau_{0d}}{b}\\sqrt{1+\\frac{\\sigma_0}{1.5\\tau_{0d}}}=l\\,t\\,\\frac{f_{td}}{b}\\sqrt{1+\\frac{\\sigma_0}{f_{td}}}"],
        ["C8.7.1.17", "V_t=\\frac{lt}{b}\\left(\\widetilde{f}_{v0d}+\\widetilde{\\mu}\\sigma_0\\right)=\\frac{lt}{b}\\left(\\frac{f_{v0d}}{1+\\mu\\varphi}+\\frac{\\mu}{1+\\mu\\varphi}\\sigma_0\\right)\\le V_{t,lim}"],
        ["C8.7.1.18", "V_{t,lim}=\\frac{ltf_{btd}}{2.3b}\\sqrt{1+\\frac{\\sigma_0}{f_{btd}}}"],
        ["C8.7.2.1", "\\theta_u=\\frac{1}{\\gamma_{el}}\\,0{,}016\\,(0{,}3^{\\nu})\\left[\\frac{\\max(0{,}01;\\omega')}{\\max(0{,}01;\\omega)}f_c\\right]^{0{,}225}\\left(\\frac{L_V}{h}\\right)^{0{,}35}25^{\\left(\\frac{\\alpha\\rho_{sx}f_{yw}}{f_c}\\right)}(1{,}25^{100\\rho_d})"],
        ["C8.7.2.2", "\\alpha=\\left(1-\\frac{s_h}{2b_0}\\right)\\left(1-\\frac{s_h}{2h_0}\\right)\\left(1-\\frac{\\sum b_i^2}{6h_0b_0}\\right)"],
        ["C8.7.2.3", "0.025\\,\\min(40,l_o/d_{bL})"],
        ["C8.7.2.4", "0.02\\left[10+\\min(40,l_o/d_{bL})\\right]"],
        ["C8.7.2.5", "\\theta_u=\\frac{1}{\\gamma_{el}}\\left(\\theta_y+(\\varphi_u-\\varphi_y)L_{pl}\\left(1-\\frac{0{,}5L_{pl}}{L_V}\\right)\\right)"],
        ["C8.7.2.6", "L_{pl}=0{,}1L_V+0{,}17h+0{,}24\\frac{d_{bL}f_y}{\\sqrt{f_c}}"],
    ]);
    const seen = new Set<string>();
    for (const manifestName of ["C8.7-step1b.json", "C8.7-step2a.json", "C8.7-step2b.json"]) {
        const manifest = await readJson(`corpus/assets/circ2019/${manifestName}`);
        for (const formula of manifest.formulas as Array<{ officialNumber: string; latex: string }>) {
            if (expected.has(formula.officialNumber)) {
                seen.add(formula.officialNumber);
                assert.equal(formula.latex, expected.get(formula.officialNumber), formula.officialNumber);
            }
        }
    }
    assert.deepEqual([...seen].sort(), [...expected.keys()].sort());

    const displacement = await readJson("corpus/units/circ2019/c8.7.1.2.1.8.json") as Unit;
    assert.equal(math(displacement).some(({ latex }) => latex === "a_{g,SLV}"), true);
    assert.equal(math(displacement).some(({ latex }) => latex === "\\xi_1"), true);
    assert.equal(math(displacement).some(({ latex }) => latex === "T_1"), true);

    const checks = await Promise.all([
        readJson("corpus/units/circ2019/c8.7.1.3.1.json") as Promise<Unit>,
        readJson("corpus/units/circ2019/c8.7.2.2.1.json") as Promise<Unit>,
        readJson("corpus/units/circ2019/c8.7.2.2.3.json") as Promise<Unit>,
        readJson("corpus/units/circ2019/c8.7.2.3.2.json") as Promise<Unit>,
    ]);
    const allSegments = checks.flatMap(math);
    assert.equal(allSegments.some(({ latex }) => latex === "q^*\\le3"), true);
    assert.equal(allSegments.some(({ latex }) => latex === "q^*\\le4"), true);
    assert.equal(allSegments.some(({ latex }) => latex === "\\rho_i=D_i/C_i"), true);
    assert.equal(allSegments.some(({ latex }) => latex === "V_{bu}"), true);
    assert.equal(allSegments.some(({ latex }) => latex === "d_{cu}"), true);
    assert.equal(allSegments.some(({ value }) => value === "s"), false);
    assert.equal(checks.some((unit) => unit.blocks.some((block) => block.kind === "heading" && block.text?.inline)), false);
    assert.equal(checks.some((unit) => unit.blocks.some((block) => (block.text?.normalized ?? "").includes("‥〶"))), false);
});

test("C8 pagine 287-295 conserva virgole, accenti e formule di consolidamento", async () => {
    const expected = new Map<string, string>([
        ["C8.7.2.7a", "\\theta_y=\\varphi_y\\frac{L_V}{3}+0{,}0013\\left(1+1{,}5\\frac{h}{L_V}\\right)+0{,}13\\varphi_y\\frac{d_bf_y}{\\sqrt{f_c}}"],
        ["C8.7.2.7b", "\\theta_y=\\varphi_y\\frac{L_V}{3}+0{,}002\\left(1-0{,}125\\frac{L_V}{h}\\right)+0{,}13\\varphi_y\\frac{d_bf_y}{\\sqrt{f_c}}"],
        ["C8.7.2.8", "V_R=\\frac{1}{\\gamma_{el}}\\left[\\frac{h-x}{2L_V}\\min(N;0{,}55A_cf_c)+(1-0{,}05\\min(0{,}5;\\mu_{\\Delta,pl}))\\left[0{,}16\\max(0{,}5;100\\rho_{tot})\\left(1-0{,}16\\min(5;L_V/h)\\right)\\sqrt{f_c}A_c+V_W\\right]\\right]"],
        ["C8.7.2.9", "V_W=\\rho_{sx}b_wzf_y"],
        ["C8.7.2.10", "V_W=\\frac{\\pi}{2}\\frac{A_{sx}}{s}f_{yw}(D-2c)"],
        ["C8.7.2.11", "\\sigma_{jt}=\\left|\\frac{N}{2A_j}-\\sqrt{\\left(\\frac{N}{2A_j}\\right)^2+\\left(\\frac{V_j}{A_j}\\right)^2}\\right|\\le 0{,}3\\sqrt{f_c}(f_c\\,\\mathrm{in}\\,MPa)"],
        ["C8.7.2.12", "\\sigma_{jc}=\\frac{N}{2A_j}+\\sqrt{\\left(\\frac{N}{2A_j}\\right)^2+\\left(\\frac{V_j}{A_j}\\right)^2}\\le 0{,}5f_c(f_c\\,\\mathrm{in}\\,MPa)"],
        ["C8.7.2.13", "\\theta_y=\\frac{M_{e,Rd}L_V}{2EI}"],
        ["C8.7.4.1", "\\widetilde{V}_R=0.9V_R"],
        ["C8.7.4.2", "\\widetilde{M}_y=0.9M_y"],
        ["C8.7.4.3", "\\widetilde{\\theta}_y=0.9\\theta_y"],
        ["C8.7.4.4", "\\widetilde{\\theta}_u=\\theta_u"],
        ["C8.7.4.5", "V_j=0.5\\frac{2t_j}{s}bf_{yw}0.9d\\cot\\theta"],
        ["C8.7.4.6", "f_{cc}=f_c\\left[1+3{,}7\\left(\\frac{0{,}5\\alpha_n\\alpha_s\\rho_sf_y}{f_c}\\right)^{0{,}86}\\right]"],
        ["C8.7.4.7a", "\\alpha_n=1-\\frac{(b-2R)^2+(h-2R)^2}{3bh}"],
        ["C8.7.4.7b", "\\alpha_s=\\left(1-\\frac{s-h_s}{2b}\\right)\\left(1-\\frac{s-h_s}{2h}\\right)"],
        ["C8.7.4.8", "\\varepsilon_{cu}=0{,}0035+0{,}5\\frac{\\alpha_n\\alpha_s\\rho_sf_y}{f_{cc}}"],
    ]);
    const seen = new Set<string>();
    for (const name of ["C8.7-step2b.json", "C8.7-step3a.json"]) {
        const manifest = await readJson(`corpus/assets/circ2019/${name}`);
        for (const formula of manifest.formulas as Array<{ officialNumber: string; latex: string }>) {
            if (!expected.has(formula.officialNumber)) continue;
            seen.add(formula.officialNumber);
            assert.equal(formula.latex, expected.get(formula.officialNumber), formula.officialNumber);
        }
    }
    assert.deepEqual([...seen].sort(), [...expected.keys()].sort());

    const units = await Promise.all([
        "c8.7.2.3.4", "c8.7.2.3.5", "c8.7.2.4.4", "c8.7.4.2.1", "c8.7.4.2.2", "c8.7.4.2.3",
    ].map((name) => readJson(`corpus/units/circ2019/${name}.json`) as Promise<Unit>));
    assert.equal(units.some((unit) => unit.blocks.some((block) => block.kind === "heading" && block.text?.inline)), false);
    assert.equal(units.some((unit) => unit.blocks.some((block) => /[〰-㕠ᡈ]|¸|sezioneed/u.test(block.text?.normalized ?? ""))), false);
    assert.equal(math(units[1]!).some(({ value, latex }) => value === "μ_{Δ,pl}=μ_Δ−1" && latex === "\\mu_{\\Delta,pl}=\\mu_\\Delta-1"), true);
    assert.equal(math(units[4]!).some(({ value, latex }) => value === "ρ_s = 2 A_s (b+h) / (b h s)" && latex === "\\rho_s=2A_s(b+h)/(bhs)"), true);
});

test("C8 pagine 296-305 conserva le formule dei ponti esistenti", async () => {
    const manifest = await readJson("corpus/assets/circ2019/C8.8-step1.json");
    const formulas = manifest.formulas as Array<{ officialNumber: string | null; latex: string }>;
    const expected = new Map<string | null, string>([
        ["C8.8.5.1", "\\begin{cases} S_{Di}(T)=S_{De}(T) & T\\ge T_C \\\\ S_{Di}(T)=\\dfrac{S_{De}(T)}{q}\\left[1+(q-1)\\dfrac{T_C}{T}\\right] & T<T_C \\end{cases}"],
        [null, "q=\\dfrac{mS_e(T)}{F_y}"],
        ["C8.8.5.2", "\\theta_y(N)=\\phi_y(N)\\dfrac{L_s}{3}"],
        ["C8.8.5.3", "\\theta_u(N)=\\theta_y(N)+[\\phi_u(N)-\\phi_y(N)]L_p\\left(1-\\dfrac{0{,}5L_p}{L_s}\\right)"],
        ["C8.8.5.4", "\\theta_{SLC}=\\dfrac{1}{\\gamma_{el}}\\theta_u(N)"],
        ["C8.8.5.5", "V_u=V_c+V_N+V_s\\quad V_c=0.8A_ck\\sqrt{f_c}\\quad V_N=N\\dfrac{h-x}{2L_s}\\quad V_s=\\dfrac{A_{sw}}{s}f_yz"],
    ]);
    assert.equal(formulas.length, expected.size);
    for (const formula of formulas) assert.equal(formula.latex, expected.get(formula.officialNumber), formula.officialNumber ?? "non numerata");

    const unit = await readJson("corpus/units/circ2019/c8.8.5.4.json") as Unit;
    assert.equal(math(unit).some(({ latex }) => latex === "\\varepsilon_{su}=0.040"), true);
    assert.equal(math(unit).some(({ latex }) => latex === "L_p=0.1L_s"), true);
    assert.equal(unit.blocks.some((block) => block.kind === "heading" && block.text?.inline), false);
});
