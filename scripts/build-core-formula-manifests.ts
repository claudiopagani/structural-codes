import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));

type FormulaSeed = {
    number: string;
    officialNumber?: string | null;
    unit: string;
    page: number;
    latex: string;
};

const ntc: FormulaSeed[] = [
    { number: "2.2.1", unit: "2.3", page: 40, latex: "R_d \\ge E_d" },
    { number: "2.2.2", unit: "2.3", page: 40, latex: "C_d \\ge E_d" },
    { number: "2.4.1", unit: "2.4.3", page: 41, latex: "V_R = V_N \\cdot C_U" },
    {
        number: "2.5.1",
        unit: "2.5.3",
        page: 43,
        latex: "\\gamma_{G1}G_1+\\gamma_{G2}G_2+\\gamma_P P+\\gamma_{Q1}Q_{k1}+\\gamma_{Q2}\\psi_{02}Q_{k2}+\\gamma_{Q3}\\psi_{03}Q_{k3}+\\ldots",
    },
    { number: "2.5.2", unit: "2.5.3", page: 43, latex: "G_1+G_2+P+Q_{k1}+\\psi_{02}Q_{k2}+\\psi_{03}Q_{k3}+\\ldots" },
    { number: "2.5.3", unit: "2.5.3", page: 43, latex: "G_1+G_2+P+\\psi_{11}Q_{k1}+\\psi_{22}Q_{k2}+\\psi_{23}Q_{k3}+\\ldots" },
    { number: "2.5.4", unit: "2.5.3", page: 43, latex: "G_1+G_2+P+\\psi_{21}Q_{k1}+\\psi_{22}Q_{k2}+\\psi_{23}Q_{k3}+\\ldots" },
    { number: "2.5.5", unit: "2.5.3", page: 43, latex: "E+G_1+G_2+P+\\psi_{21}Q_{k1}+\\psi_{22}Q_{k2}+\\ldots" },
    { number: "2.5.6", unit: "2.5.3", page: 43, latex: "G_1+G_2+P+A_d+\\psi_{21}Q_{k1}+\\psi_{22}Q_{k2}+\\ldots" },
    { number: "2.5.7", unit: "2.5.3", page: 43, latex: "G_1+G_2+\\sum_j\\psi_{2j}Q_{kj}" },
    { number: "3.1.1", unit: "3.1.4.1", page: 48, latex: "\\alpha_A=\\frac{5}{7}\\psi_0+\\frac{10}{A}\\le 1{,}0" },
    { number: "3.1.2", unit: "3.1.4.1", page: 48, latex: "\\alpha_n=\\frac{2+(n-2)\\psi_0}{n}" },
    { number: "3.2.0", unit: "3.2.1", page: 50, latex: "T_R=-\\frac{V_R}{\\ln(1-P_{VR})}=-\\frac{C_UV_N}{\\ln(1-P_{VR})}" },
    { number: "3.2.1", unit: "3.2.2", page: 50, latex: "V_{S,eq}=\\frac{H}{\\displaystyle\\sum_{i=1}^{N}\\frac{h_i}{V_{S,i}}}" },
    { number: "3.2.10", unit: "3.2.3.2.3", page: 53, latex: "S_{De}(T)=S_e(T)\\left(\\frac{T}{2\\pi}\\right)^2" },
    { number: "3.2.12", unit: "3.2.3.3", page: 54, latex: "\\begin{aligned}d_g&=0{,}025\\,a_gST_CT_D\\\\v_g&=0{,}16\\,a_gST_C\\end{aligned}" },
    { number: "3.3.1", unit: "3.3.1", page: 56, latex: "v_b=v_{b,0}\\,c_a" },
    {
        number: "3.3.1.b",
        unit: "3.3.1",
        page: 56,
        latex: "c_a=\\begin{cases}1&\\text{per }a_s\\le a_0\\\\1+k_s\\left(\\dfrac{a_s}{a_0}-1\\right)&\\text{per }a_0<a_s\\le1500\\,\\mathrm{m}\\end{cases}",
    },
    { number: "3.3.2", unit: "3.3.2", page: 57, latex: "v_r=v_b\\,c_r" },
    { number: "3.3.3", unit: "3.3.2", page: 57, latex: "c_r=0{,}75\\sqrt{1-0{,}2\\ln\\left[-\\ln\\left(1-\\frac{1}{T_R}\\right)\\right]}" },
    { number: "3.3.4", unit: "3.3.4", page: 58, latex: "p=q_r\\,c_e\\,c_p\\,c_d" },
    { number: "3.3.5", unit: "3.3.5", page: 58, latex: "p_f=q_r\\,c_e\\,c_f" },
    { number: "3.3.6", unit: "3.3.6", page: 58, latex: "q_r=\\frac{1}{2}\\rho v_r^2" },
    {
        number: "3.3.7",
        unit: "3.3.7",
        page: 58,
        latex: "c_e(z)=\\begin{cases}k_r^2c_t\\ln(z/z_0)\\left[7+c_t\\ln(z/z_0)\\right]&z\\ge z_{min}\\\\c_e(z_{min})&z<z_{min}\\end{cases}",
    },
    { number: "3.4.1", unit: "3.4.1", page: 61, latex: "q_s=q_{sk}\\,\\mu_i\\,C_E\\,C_t" },
    { number: "3.6.1", unit: "3.6.1.1", page: 66, latex: "q_{f,d}=q_f\\,\\delta_{q1}\\,\\delta_{q2}\\,\\delta_n" },
];

const circ: FormulaSeed[] = [
    {
        number: "C3.2.1",
        unit: "c3.2.1",
        page: 48,
        latex: "T_R=-\\frac{V_R}{\\ln(1-P_{VR})}=-\\frac{C_UV_N}{\\ln(1-P_{VR})}",
    },
    {
        number: "C3.2.2",
        unit: "c3.2.1",
        page: 49,
        latex: "R=\\frac{T_{R,b}}{T_{R,a}}=\\frac{-V_N/\\ln(1-P_{VR}/C_U)}{-C_UV_N/\\ln(1-P_{VR})}=\\frac{\\ln(1-P_{VR})}{C_U\\ln(1-P_{VR}/C_U)}",
    },
    {
        number: "C3.2.3",
        unit: "c3.2.1",
        page: 49,
        latex: "R=1=\\frac{\\ln(1-P^*_{VR})}{C_U\\ln(1-P_{VR}/C_U)}\\Rightarrow\\ln(1-P^*_{VR})=C_U\\ln(1-P_{VR}/C_U)\\Rightarrow P^*_{VR}=1-\\left(1-\\frac{P_{VR}}{C_U}\\right)^{C_U}",
    },
    {
        number: "C3.2.4",
        unit: "c3.2.2",
        page: 51,
        latex: "V_{S,eq}=\\frac{H}{\\displaystyle\\sum_{j=1}^{N}\\frac{h_j}{V_{S,j}}}=\\frac{\\displaystyle\\sum_{j=1}^{N}h_j}{\\displaystyle\\sum_{j=1}^{N}\\frac{h_j}{V_{S,j}}}",
    },
    {
        number: "C3.2.5",
        unit: "c3.2.3.6",
        page: 54,
        latex: "\\rho_{X,Y}=\\frac{\\displaystyle\\int_{t_1}^{t_2}X(t)Y(t)\\,dt}{\\sqrt{\\displaystyle\\int_{t_1}^{t_2}X^2(t)\\,dt\\;\\displaystyle\\int_{t_1}^{t_2}Y^2(t)\\,dt}}",
    },
    {
        number: "C3.3.1",
        unit: "c3.3.2",
        page: 54,
        latex: "v_b(T_R)=\\alpha_Rv_b",
    },
    {
        number: "C3.3.2",
        unit: "c3.3.2",
        page: 54,
        latex: "\\alpha_R=0{,}75\\sqrt{1-0{,}2\\ln\\left[-\\ln\\left(1-\\frac{1}{T_R}\\right)\\right]}",
    },
    {
        number: "C3.3.3",
        unit: "c3.3.8",
        page: 55,
        latex: "c_{pe,A}=c_{pe,1}-\\left(c_{pe,1}-c_{pe,10}\\right)\\log_{10}(A)",
    },
    { number: "C4.1.1", unit: "c4.1.1.1", page: 86, latex: "\\overline{M}_{Ed}\\le\\overline{M}_{Rd}" },
    { number: "C4.1.2", unit: "c4.1.2.2.2", page: 90, latex: "p^*=\\zeta p_f+(1-\\zeta)p" },
    { number: "C4.1.3", unit: "c4.1.2.2.2", page: 90, latex: "\\zeta=1-c\\beta^2" },
    { number: "C4.1.4", unit: "c4.1.2.2.2", page: 90, latex: "\\frac{l}{h}\\le K\\left[11+\\frac{0{,}015f_{ck}}{\\rho+\\rho'}\\right]\\left[\\frac{500A_{s,eff}}{f_{yk}A_{s,calc}}\\right]" },
    {
        number: "C4.1.5",
        officialNumber: "C4.1.5 e 4.1.14",
        unit: "c4.1.2.2.4.5",
        page: 91,
        latex: "w_k=1{,}7\\,\\varepsilon_{sm}\\,\\Delta_{sm}",
    },
    { number: "C4.1.6", unit: "c4.1.2.2.4.5", page: 91, latex: "\\varepsilon_{sm}=\\frac{\\sigma_s-k_t\\dfrac{f_{ctm}}{\\rho_{eff}}\\left(1+\\alpha_e\\rho_{eff}\\right)}{E_s}\\ge0{,}6\\frac{\\sigma_s}{E_s}" },
    { number: "C4.1.7", unit: "c4.1.2.2.4.5", page: 92, latex: "\\Delta_{sm}=\\frac{k_3c+k_1k_2k_4\\dfrac{\\phi}{\\rho_{eff}}}{1{,}7}" },
    { number: "C4.1.8", unit: "c4.1.2.2.4.5", page: 92, latex: "\\phi_{eq}=\\frac{n_1\\phi_1^2+n_2\\phi_2^2}{n_1\\phi_1+n_2\\phi_2}" },
    { number: "C4.1.9", unit: "c4.1.2.2.4.5", page: 92, latex: "k_2=\\frac{\\varepsilon_1+\\varepsilon_2}{2\\varepsilon_1}" },
    { number: "C4.1.10", unit: "c4.1.2.2.4.5", page: 92, latex: "\\Delta_{sm}=0{,}75(h-x)" },
    { number: "C4.1.11", unit: "c4.1.2.3.4.2", page: 93, latex: "N_{Rd}=0{,}8A_cf_{cd}+A_{s,tot}f_{yd}" },
    { number: "C4.1.12", unit: "c4.1.12.1.1.1", page: 97, latex: "f_{lctm}=0{,}30\\,f_{lck}^{2/3}\\eta_1\\quad\\text{per calcestruzzo di classe }\\le LC\\,50/55" },
    { number: "C4.1.13", unit: "c4.1.12.1.1.1", page: 97, latex: "f_{lctm}=2{,}12\\ln\\left[1+\\left(f_{lcm}/10\\right)\\right]\\eta_1\\quad\\text{per calcestruzzo di classe }>LC\\,50/55" },
    { number: "C4.1.12.eta1", officialNumber: null, unit: "c4.1.12.1.1.1", page: 97, latex: "\\eta_1=0{,}40+0{,}60\\frac{\\rho}{2200}" },
    {
        number: "C4.1.12.flcm",
        officialNumber: null,
        unit: "c4.1.12.1.1.1",
        page: 97,
        latex: "f_{lcm}=\\begin{cases}22\\,\\mathrm{N/mm^2}&\\text{per }LC\\,16/20\\\\f_{lck}+8\\,\\mathrm{N/mm^2}&\\text{per }f_{lck}>20\\,\\mathrm{N/mm^2}\\end{cases}",
    },
    { number: "C4.1.14.a", unit: "c4.1.12.1.1.1", page: 97, latex: "f_{lctk,0{,}05}=0{,}7f_{lctm}" },
    { number: "C4.1.14.b", unit: "c4.1.12.1.1.1", page: 97, latex: "f_{lctk,0{,}95}=1{,}3f_{lctm}" },
    { number: "C4.1.15", unit: "c4.1.12.1.1.1", page: 97, latex: "f_{lctd}=0{,}85\\frac{f_{lctk}}{\\gamma_C}" },
    { number: "C4.1.16", unit: "c4.1.12.1.1.2", page: 97, latex: "E_{lcm}=22000\\left[\\frac{f_{lcm}}{10}\\right]^{0{,}3}\\eta_E\\quad\\mathrm{N/mm^2}" },
    { number: "C4.1.16.etae", officialNumber: null, unit: "c4.1.12.1.1.2", page: 97, latex: "\\eta_E=\\left(\\frac{\\rho}{2200}\\right)^2" },
    {
        number: "C4.1.13.strains.le50",
        officialNumber: null,
        unit: "c4.1.12.1.3.1",
        page: 98,
        latex: "\\begin{aligned}\\varepsilon_{c2}&=0{,}20\\%\\\\\\varepsilon_{c3}&=0{,}175\\%\\\\\\varepsilon_{cu}&=\\eta_1\\,0{,}35\\%,\\qquad \\eta_1=0{,}40+0{,}60\\frac{\\rho}{2200}\\end{aligned}",
    },
    {
        number: "C4.1.13.strains.55",
        officialNumber: null,
        unit: "c4.1.12.1.3.1",
        page: 98,
        latex: "\\begin{aligned}\\varepsilon_{c2}&=0{,}22\\%\\\\\\varepsilon_{c3}&=0{,}18\\%\\\\\\varepsilon_{cu}&=\\eta_1\\,0{,}31\\%\\end{aligned}",
    },
    { number: "C4.1.17", unit: "c4.1.12.1.3.2.1", page: 98, latex: "V_{lRd,c}=\\left[\\frac{0{,}15\\,\\eta_1k\\left(100\\rho_lf_{lck}\\right)^{1/3}}{\\gamma_C}+0{,}15\\sigma_{cp}\\right]b_wd\\ge\\left(\\nu_{l,min}+0{,}15\\sigma_{cp}\\right)b_wd" },
    {
        number: "C4.1.17.parameters",
        officialNumber: null,
        unit: "c4.1.12.1.3.2.1",
        page: 98,
        latex: "\\begin{aligned}\\eta_1&=0{,}40+0{,}60\\frac{\\rho}{2200}\\\\k&=1+\\left(\\frac{200}{d}\\right)^{1/2}\\le2\\\\\\nu_{l,min}&=0{,}030\\,k^{3/2}f_{lck}^{1/2}\\end{aligned}",
    },
    { number: "C4.1.18", unit: "c4.1.12.1.3.2.1", page: 98, latex: "V_{Ed}\\le0{,}5\\eta_1b_wd\\nu_1f_{lcd}" },
    { number: "C4.1.19", unit: "c4.1.12.1.3.2.1", page: 98, latex: "\\nu_1=0{,}5\\eta_1\\left(1-\\frac{f_{lck}}{250}\\right)" },
];

async function writeManifest(
    document: "ntc2018" | "circ2019",
    sourceId: string,
    seeds: FormulaSeed[],
): Promise<void> {
    const manifest = {
        $schema: "urn:structural-codes:schema:asset-manifest:v2",
        schemaVersion: "2.0.0-alpha.1",
        recordType: "asset-manifest",
        document,
        section: "core-editorial",
        sourceId,
        status: "transcribed-unreviewed",
        formulas: seeds.map(({ number, officialNumber, unit, page, latex }) => ({
            id: `urn:structural-codes:it:asset:formula:${document}:${number.toLowerCase()}`,
            unitId: `urn:structural-codes:it:unit:${document}:${unit}`,
            officialNumber: officialNumber === undefined ? number : officialNumber,
            pdfPage: page,
            latex,
        })),
        tables: [],
        figures: [],
    };
    const output = join(repoRoot, "corpus", "assets", document, "core-editorial.json");
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

await Promise.all([
    writeManifest("ntc2018", "gu-so8-2018-ntc", ntc),
    writeManifest("circ2019", "circ-7-2019", circ),
]);
console.log(`core-formula-manifests: ${ntc.length + circ.length} formule`);
