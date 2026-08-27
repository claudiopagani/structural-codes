export type InlineSegment =
    | {
          kind: "text";
          value: string;
      }
    | {
          kind: "em";
          value: string;
      }
    | {
          kind: "strong";
          value: string;
      }
    | {
          kind: "math";
          value: string;
          latex: string;
      };

const exactLatex = new Map<string, string>([
    ["≤", "\\le"],
    ["≥", "\\ge"],
    ["≠", "\\ne"],
    ["≈", "\\approx"],
    ["±", "\\pm"],
    ["·", "\\cdot"],
    ["×", "\\times"],
    ["=", "="],
    ["<", "<"],
    [">", ">"],
    ["z̄e = h + f/2", "\\bar z_e=h+\\frac{f}{2}"],
    ["−5° ≤ α ≤ +5°", "-5^\\circ\\le\\alpha\\le+5^\\circ"],
    ["5° ≤ α ≤ 45°", "5^\\circ\\le\\alpha\\le45^\\circ"],
    ["0° ≤ α ≤ 45°", "0^\\circ\\le\\alpha\\le45^\\circ"],
    ["F = qp(z) L² cF", "F=q_p(z)L^2c_F"],
    ["h/d ≥ 0,5", "\\frac{h}{d}\\ge0{,}5"],
    ["h/d = 0,5", "\\frac{h}{d}=0{,}5"],
    ["h/d = 0", "\\frac{h}{d}=0"],
    ["f/d ≤ 0,05", "\\frac{f}{d}\\le0{,}05"],
    ["cpe = −0,4", "c_{pe}=-0{,}4"],
    ["cpe > 0", "c_{pe}>0"],
    ["cpe < 0", "c_{pe}<0"],
    ["Θ = 0°", "\\Theta=0^\\circ"],
    ["α = 0°", "\\alpha=0^\\circ"],
    ["α > 0°", "\\alpha>0^\\circ"],
    ["α < 0°", "\\alpha<0^\\circ"],
    ["φ = 0", "\\phi=0"],
    ["φ = 1", "\\phi=1"],
    ["−5°", "-5^\\circ"],
    ["+5°", "+5^\\circ"],
    ["180°", "180^\\circ"],
    ["90°", "90^\\circ"],
    ["75°", "75^\\circ"],
    ["60°", "60^\\circ"],
    ["45°", "45^\\circ"],
    ["30°", "30^\\circ"],
    ["15°", "15^\\circ"],
    ["5°", "5^\\circ"],
    ["0°", "0^\\circ"],
    ["qp(z)", "q_p(z)"],
    ["cpe,B", "c_{pe,B}"],
    ["cpe,C", "c_{pe,C}"],
    ["cF", "c_F"],
    ["L²", "L^2"],
    ["Θ", "\\Theta"],
    ["φ", "\\phi"],
    ["−", "-"],
    ["N/mm²", "\\mathrm{N/mm^2}"],
    ["N/mm2", "\\mathrm{N/mm^2}"],
    ["kN/mm²", "\\mathrm{kN/mm^2}"],
    ["m/s²", "\\mathrm{m/s^2}"],
    ["m/s2", "\\mathrm{m/s^2}"],
    ["m²", "\\mathrm{m^2}"],
    ["T ≤ 4 s", "T\\le4\\,\\mathrm{s}"],
    ["H > 30 m", "H>30\\,\\mathrm{m}"],
    ["H = 30 m", "H=30\\,\\mathrm{m}"],
    ["S = SS·ST", "S=S_S\\cdot S_T"],
    ["Fo·ag", "F_0\\cdot a_g"],
    ["0,78g ≤ Fo·ag < 1,17g", "0{,}78g\\le F_0a_g<1{,}17g"],
    ["Fo·ag < 0,78g", "F_0a_g<0{,}78g"],
    ["Fo·ag > 0,93g", "F_0a_g>0{,}93g"],
    ["SS = 1", "S_S=1"],
    ["η = 1", "\\eta=1"],
    ["ξ = 5%", "\\xi=5\\%"],
    ["ξ = 28%", "\\xi=28\\%"],
    ["√2", "\\sqrt{2}"],
    ["CU·TR,1", "C_U\\cdot T_{R,1}"],
    ["CUVN/[-ln(1-PVR)]", "\\frac{C_UV_N}{-\\ln(1-P_{VR})}"],
    ["PVR ≤ 10%", "P_{VR}\\le10\\%"],
    ["PVR ≥ 60%", "P_{VR}\\ge60\\%"],
    ["z̄e = h", "\\bar z_e=h"],
    ["z̄e = b", "\\bar z_e=b"],
    ["z̄e", "\\bar z_e"],
    ["h ≤ b", "h\\le b"],
    ["b < h ≤ 5·d", "b<h\\le5d"],
    ["z = b", "z=b"],
    ["z = h", "z=h"],
    ["h/d", "\\frac{h}{d}"],
    ["f/d", "\\frac{f}{d}"],
    ["x/d", "\\frac{x}{d}"],
    ["aᵥ/2d", "\\frac{a_v}{2d}"],
    ["av/2d", "\\frac{a_v}{2d}"],
    ["MEd", "M_{Ed}"],
    ["MRd", "M_{Rd}"],
    ["ME", "M_E"],
    ["Mf", "M_f"],
    ["Nf", "N_f"],
    ["M1", "M_1"],
    ["M2", "M_2"],
    ["M1’", "M'_1"],
    ["M2’", "M'_2"],
    ["ΔM", "\\Delta M"],
    ["δM1", "\\delta M_1"],
    ["δM2", "\\delta M_2"],
    ["M1’ ≥ δM1", "M'_1\\ge\\delta M_1"],
    ["M2’ ≥ δM2", "M'_2\\ge\\delta M_2"],
    ["M̄i,j = Mi,j ± ΔMi,j", "\\overline{M}_{i,j}=M_{i,j}\\pm\\Delta M_{i,j}"],
    ["M̄Ed", "\\overline{M}_{Ed}"],
    ["M̄Rd", "\\overline{M}_{Rd}"],
    ["δ ≥ 0,70", "\\delta\\ge0{,}70"],
    ["MEyd", "M_{Eyd}"],
    ["MEzd", "M_{Ezd}"],
    ["MRyd", "M_{Ryd}"],
    ["MRzd", "M_{Rzd}"],
    ["NEd", "N_{Ed}"],
    ["NRd", "N_{Rd}"],
    ["NRcd", "N_{Rcd}"],
    ["PEd", "P_{Ed}"],
    ["VEd", "V_{Ed}"],
    ["VRd", "V_{Rd}"],
    ["VRcd", "V_{Rcd}"],
    ["VRsd", "V_{Rsd}"],
    ["TRd", "T_{Rd}"],
    ["TEd", "T_{Ed}"],
    ["TRcd", "T_{Rcd}"],
    ["TRsd", "T_{Rsd}"],
    ["TRld", "T_{Rld}"],
    ["fck", "f_{ck}"],
    ["fcd", "f_{cd}"],
    ["fctk", "f_{ctk}"],
    ["fctd", "f_{ctd}"],
    ["fctm", "f_{ctm}"],
    ["fyk", "f_{yk}"],
    ["fyd", "f_{yd}"],
    ["fbk", "f_{bk}"],
    ["fbd", "f_{bd}"],
    ["fcvd", "f_{cvd}"],
    ["flck", "f_{lck}"],
    ["flcd", "f_{lcd}"],
    ["flcm", "f_{lcm}"],
    ["flctm", "f_{lctm}"],
    ["flctk", "f_{lctk}"],
    ["flctd", "f_{lctd}"],
    ["Rlck", "R_{lck}"],
    ["f’cd", "f'_{cd}"],
    ["f’lcd", "f'_{lcd}"],
    ["fp(0,1)k", "f_{p(0{,}1)k}"],
    ["fp(1)k", "f_{p(1)k}"],
    ["fptk", "f_{ptk}"],
    ["Ecm", "E_{cm}"],
    ["Ecd", "E_{cd}"],
    ["Elcm", "E_{lcm}"],
    ["Es", "E_s"],
    ["As", "A_s"],
    ["Ac", "A_c"],
    ["As,tot", "A_{s,tot}"],
    ["As,eff", "A_{s,eff}"],
    ["As,calc", "A_{s,calc}"],
    ["Ast", "A_{st}"],
    ["Ast,x", "A_{st,x}"],
    ["Ast,y", "A_{st,y}"],
    ["Ac,eff", "A_{c,eff}"],
    ["hc,eff", "h_{c,eff}"],
    ["bw", "b_w"],
    ["bt", "b_t"],
    ["bx", "b_x"],
    ["by", "b_y"],
    ["av", "a_v"],
    ["a_l", "a_l"],
    ["a_s", "a_s"],
    ["wk", "w_k"],
    ["w1", "w_1"],
    ["w2", "w_2"],
    ["w3", "w_3"],
    ["D0", "D_0"],
    ["l0", "l_0"],
    ["um", "u_m"],
    ["vb", "v_b"],
    ["vr", "v_r"],
    ["cr", "c_r"],
    ["qr", "q_r"],
    ["ce", "c_e"],
    ["cp", "c_p"],
    ["cd", "c_d"],
    ["cf", "c_f"],
    ["qs", "q_s"],
    ["qsk", "q_{sk}"],
    ["qf", "q_f"],
    ["qf,d", "q_{f,d}"],
    ["ag", "a_g"],
    ["SS", "S_S"],
    ["ST", "S_T"],
    ["CC", "C_C"],
    ["TB", "T_B"],
    ["Fv", "F_v"],
    ["cpe,A", "c_{pe,A}"],
    ["cpe,10", "c_{pe,10}"],
    ["cpe,1", "c_{pe,1}"],
    ["cpe", "c_{pe}"],
    ["dg", "d_g"],
    ["vg", "v_g"],
    ["VR = VN · CU", "V_R = V_N \\cdot C_U"],
    ["VN ≥ 100", "V_N \\ge 100"],
    ["VN ≥ 50", "V_N \\ge 50"],
    ["CU > 2", "C_U > 2"],
    ["CU = 2,5", "C_U = 2{,}5"],
    ["CU = 2", "C_U = 2"],
    ["ζV,i", "\\zeta_{V,i}"],
    ["ζE", "\\zeta_E"],
    ["γF", "\\gamma_F"],
    ["Qkj", "Q_{kj}"],
    ["Gk", "G_k"],
    ["G2", "G_2"],
    ["TR", "T_R"],
    ["VR", "V_R"],
    ["VN", "V_N"],
    ["CU", "C_U"],
    ["VS", "V_S"],
    ["VS,eq", "V_{S,eq}"],
    ["VS,i", "V_{S,i}"],
    ["Se(T)", "S_e(T)"],
    ["SDe(T)", "S_{De}(T)"],
    ["Sve(T)", "S_{ve}(T)"],
    ["TC", "T_C"],
    ["TD", "T_D"],
    ["TC*", "T_C^*"],
    ["Fo", "F_0"],
    ["G1", "G_1"],
    ["G2", "G_2"],
    ["Qk1", "Q_{k1}"],
    ["Qk2", "Q_{k2}"],
    ["Qk3", "Q_{k3}"],
    ["Ad", "A_d"],
    ["Rd", "R_d"],
    ["Ed", "E_d"],
    ["Cd", "C_d"],
    ["Xd", "X_d"],
    ["Xk", "X_k"],
    ["Fd", "F_d"],
    ["Fk", "F_k"],
    ["PVR", "P_{VR}"],
    ["P*VR", "P^*_{VR}"],
    ["TR,1", "T_{R,1}"],
    ["TR,a", "T_{R,a}"],
    ["TR,b", "T_{R,b}"],
    ["vb(TR)", "v_b(T_R)"],
    ["VS", "V_S"],
    ["VS,eq", "V_{S,eq}"],
    ["VS,30", "V_{S,30}"],
    ["qr", "q_r"],
    ["pf", "p_f"],
    ["ca", "c_a"],
    ["kr", "k_r"],
    ["zmin", "z_{min}"],
    ["p*", "p^*"],
    ["l/h", "\\frac{l}{h}"],
    ["7/l", "\\frac{7}{l}"],
    ["8,5/l", "\\frac{8{,}5}{l}"],
    ["β = Mf/M", "\\beta=\\frac{M_f}{M}"],
    ["β = Nf/N", "\\beta=\\frac{N_f}{N}"],
    ["5(c + φ/2)", "5\\left(c+\\frac{\\phi}{2}\\right)"],
    ["ρl = Asl/(bw d)", "\\rho_l=\\frac{A_{sl}}{b_wd}"],
    ["σcp = NEd/Ac", "\\sigma_{cp}=\\frac{N_{Ed}}{A_c}"],
    ["σl = √(σlx · σly)", "\\sigma_l=\\sqrt{\\sigma_{lx}\\cdot\\sigma_{ly}}"],
    ["αt ≥ 6·10⁻⁶ °C⁻¹", "\\alpha_t\\ge6\\cdot10^{-6}\\,{}^\\circ\\mathrm{C}^{-1}"],
    ["0,6 + 0,625·h", "0{,}6+0{,}625h"],
    ["f’lcd = 0,40 flcd", "f'_{lcd}=0{,}40f_{lcd}"],
    ["Φn = Φ√n", "\\Phi_n=\\Phi\\sqrt{n}"],
    ["φ ≤ 16 mm", "\\phi\\le16\\,\\mathrm{mm}"],
    ["D ≥ 6φ", "D\\ge6\\phi"],
    ["φ > 16 mm", "\\phi>16\\,\\mathrm{mm}"],
    ["D ≥ 11φ", "D\\ge11\\phi"],
    ["c", "c"],
    ["d", "d"],
    ["h", "h"],
    ["k", "k"],
    ["k1", "k_1"],
    ["k2", "k_2"],
    ["k3", "k_3"],
    ["k4", "k_4"],
    ["n1", "n_1"],
    ["n2", "n_2"],
    ["p", "p"],
    ["x", "x"],
]);

const greekLatex = new Map<string, string>([
    ["α", "\\alpha"],
    ["β", "\\beta"],
    ["γ", "\\gamma"],
    ["δ", "\\delta"],
    ["Δ", "\\Delta"],
    ["ε", "\\varepsilon"],
    ["η", "\\eta"],
    ["θ", "\\theta"],
    ["λ", "\\lambda"],
    ["μ", "\\mu"],
    ["ν", "\\nu"],
    ["ξ", "\\xi"],
    ["ρ", "\\rho"],
    ["σ", "\\sigma"],
    ["τ", "\\tau"],
    ["φ", "\\phi"],
    ["Φ", "\\Phi"],
    ["χ", "\\chi"],
    ["ψ", "\\psi"],
    ["ω", "\\omega"],
]);

function escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const exactPattern = [...exactLatex.keys()]
    .sort((left, right) => right.length - left.length)
    .map(escapeRegex)
    .join("|");

const tokenPattern = new RegExp(
    `(?:${exactPattern}|[${[...greekLatex.keys()].map(escapeRegex).join("")}](?:[A-Za-z0-9]+(?:,[A-Za-z0-9]+)?|'|’)?|[=<>/])`,
    "gu",
);

function greekTokenToLatex(value: string): string | undefined {
    const first = [...value][0];
    if (!first) return undefined;
    const base = greekLatex.get(first);
    if (!base) return undefined;
    const suffix = value.slice(first.length);
    if (!suffix) return base;
    if (suffix === "'" || suffix === "’") return `${base}'`;
    return `${base}_{${suffix.replace("’", "'")}}`;
}

function latexFor(value: string): string | undefined {
    return exactLatex.get(value) ?? greekTokenToLatex(value);
}

function isWordCharacter(value: string | undefined): boolean {
    return value !== undefined && /[\p{L}\p{N}_]/u.test(value);
}

function hasRequiredTokenBoundaries(
    source: string,
    value: string,
    index: number,
): boolean {
    const first = [...value][0];
    const last = [...value].at(-1);
    const before = index > 0 ? source[index - 1] : undefined;
    const after = source[index + value.length];
    if (isWordCharacter(first) && isWordCharacter(before)) return false;
    if (isWordCharacter(last) && isWordCharacter(after)) return false;
    if (
        [...value].length === 1 &&
        (after === "'" || after === "’") &&
        isWordCharacter(source[index + value.length + 1])
    ) {
        return false;
    }
    if ([...value].length === 1 && (after === ")" || after === ".")) {
        return false;
    }
    return true;
}

function pushText(segments: InlineSegment[], value: string): void {
    if (!value) return;
    const previous = segments.at(-1);
    if (previous?.kind === "text") {
        previous.value += value;
        return;
    }
    segments.push({ kind: "text", value });
}

/**
 * Produces lossless inline runs. Concatenating `value` always recreates the
 * normalized text exactly; LaTeX is a rendering annotation, never the source.
 */
export function buildInlineSegments(
    normalized: string,
): InlineSegment[] | undefined {
    const segments: InlineSegment[] = [];
    let cursor = 0;
    for (const match of normalized.matchAll(tokenPattern)) {
        const value = match[0];
        const index = match.index;
        if (index === undefined) continue;
        if (!hasRequiredTokenBoundaries(normalized, value, index)) continue;
        const latex = latexFor(value);
        if (!latex) continue;
        pushText(segments, normalized.slice(cursor, index));
        segments.push({ kind: "math", value, latex });
        cursor = index + value.length;
    }
    pushText(segments, normalized.slice(cursor));
    return segments.some(({ kind }) => kind === "math") ? segments : undefined;
}

export function inlineText(segments: InlineSegment[]): string {
    return segments.map(({ value }) => value).join("");
}
