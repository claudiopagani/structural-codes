"use client";

import { useId, type ReactNode } from "react";

type IconName =
  | "lente-ricerca" | "freccia-circolare-indietro" | "freccia-circolare-avanti"
  | "luna-calante" | "luminosita-solare" | "nota-adesiva" | "segnalibro"
  | "scarica" | "carica" | "matita" | "cestino" | "documento-codice"
  | "chiudi" | "ingranaggio" | "menu" | "dischetto-salvataggio"
  | "importa-cerchio" | "esporta-cerchio"
  | "stella-annotazioni" | "cruscotto-laterale";

interface IconProps { className?: string; variant?: "default" | "light" | "danger" }
type IconDrawing = (id: string) => ReactNode;

function IconFrame({ name, className, variant = "default", drawing }: IconProps & { name: IconName; drawing: IconDrawing }) {
  const suffix = useId().replaceAll(":", "");
  const id = "icona-" + name + "-" + suffix;
  return <svg id={id} data-variant={variant} className={["scv-icon", className].filter(Boolean).join(" ")} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14" width="14" height="14" aria-hidden="true" focusable="false">
    <g id={id + "-gruppo"}>{drawing(id)}</g>
  </svg>;
}

export function SearchIcon(props: IconProps) {
  return <IconFrame name="lente-ricerca" {...props} drawing={(id) => <>
    <path id={id + "-manico-lente"} fill="#2859c5" fillRule="evenodd" d="M2 6c0 -2.20914 1.79086 -4 4 -4s4 1.79086 4 4 -1.79086 4 -4 4 -4 -1.79086 -4 -4Zm4 -6C2.68629 0 0 2.68629 0 6s2.68629 6 6 6c1.29578 0 2.49562 -0.4108 3.47642 -1.1092l2.81648 2.8165c0.3905 0.3905 1.0237 0.3905 1.4142 0 0.3905 -0.3905 0.3905 -1.0237 0 -1.4142l-2.8164 -2.81645C11.5892 8.49581 12 7.29588 12 6c0 -3.31371 -2.68629 -6 -6 -6Z" clipRule="evenodd" strokeWidth="1" />
  </>} />;
}

export function HistoryBackIcon(props: IconProps) {
  return <IconFrame name="freccia-circolare-indietro" {...props} drawing={(id) => <path id={id + "-freccia-indietro"} fill="#8fbffa" fillRule="evenodd" d="M5.351 1.002a0.75 0.75 0 0 0 -1.28 -0.53l-2.4 2.4a0.75 0.75 0 0 0 0 1.06l2.4 2.399a0.75 0.75 0 0 0 1.28 -0.53V4.4H7a3.798 3.798 0 1 1 -3.798 3.8 1 1 0 1 0 -2 0A5.798 5.798 0 1 0 7 2.401H5.351V1.002Z" clipRule="evenodd" strokeWidth="1" />} />;
}

export function HistoryForwardIcon(props: IconProps) {
  return <IconFrame name="freccia-circolare-avanti" {...props} drawing={(id) => <path id={id + "-freccia-avanti"} fill="#8fbffa" fillRule="evenodd" d="M8.64904 1.00245c0 -0.303349 0.18273 -0.576826 0.46299 -0.692912 0.28025 -0.116085 0.60284 -0.051918 0.81734 0.16258L12.3284 2.87114c0.2929 0.29289 0.2929 0.76777 0 1.06066L9.92937 6.33082c-0.2145 0.2145 -0.53709 0.27867 -0.81734 0.16258 -0.28026 -0.11608 -0.46299 -0.38956 -0.46299 -0.69291V4.40137H7.00002c-2.0976 0 -3.79805 1.70045 -3.79805 3.79805 0 2.09758 1.70045 3.79808 3.79805 3.79808s3.79808 -1.7005 3.79808 -3.79808c0 -0.55229 0.4477 -1 1 -1 0.5522 0 1 0.44771 1 1 0 3.20218 -2.5959 5.79808 -5.79808 5.79808 -3.20217 0 -5.79805 -2.5959 -5.79805 -5.79808 0 -3.20217 2.59588 -5.79805 5.79805 -5.79805h1.64902V1.00245Z" clipRule="evenodd" strokeWidth="1" />} />;
}

export function MoonIcon(props: IconProps) {
  return <IconFrame name="luna-calante" {...props} drawing={(id) => <path id={id + "-luna-calante"} fill="#8fbffa" fillRule="evenodd" d="M9 0a7 7 0 0 0 0 14l0.004 0a7.079 7.079 0 0 0 2.657 -0.538 0.5 0.5 0 0 0 0.061 -0.894A6.5 6.5 0 0 1 8.5 7a6.5 6.5 0 0 1 3.194 -5.568 0.5 0.5 0 0 0 -0.063 -0.893A7.08 7.08 0 0 0 9.006 0H9Z" clipRule="evenodd" strokeWidth="1" />} />;
}

export function SunIcon(props: IconProps) {
  return <IconFrame name="luminosita-solare" {...props} drawing={(id) => <>
    <path id={id + "-disco-solare"} fill="#2859c5" d="M4.75 7a2.25 2.25 0 1 0 4.5 0 2.25 2.25 0 1 0 -4.5 0" strokeWidth="1" />
    <path id={id + "-raggi-solari"} fill="#8fbffa" fillRule="evenodd" d="M7.75 0.75a0.75 0.75 0 0 0 -1.5 0v1a0.75 0.75 0 0 0 1.5 0v-1Zm0 11.5a0.75 0.75 0 0 0 -1.5 0v1a0.75 0.75 0 0 0 1.5 0v-1ZM11.5 7a0.75 0.75 0 0 1 0.75 -0.75h1a0.75 0.75 0 0 1 0 1.5h-1A0.75 0.75 0 0 1 11.5 7ZM0.75 6.25a0.75 0.75 0 0 0 0 1.5h1a0.75 0.75 0 0 0 0 -1.5h-1Zm1.3 -4.2a0.75 0.75 0 0 1 1.06 0l0.862 0.86A0.75 0.75 0 0 1 2.91 3.973l-0.86 -0.861a0.75 0.75 0 0 1 0 -1.06Zm9.04 7.978a0.75 0.75 0 1 0 -1.062 1.06l0.861 0.862a0.75 0.75 0 0 0 1.06 -1.061l-0.86 -0.86Zm0.86 -7.978a0.75 0.75 0 0 1 0 1.06l-0.86 0.862a0.75 0.75 0 0 1 -1.062 -1.061l0.861 -0.86a0.75 0.75 0 0 1 1.06 0Zm-7.978 9.04a0.75 0.75 0 1 0 -1.061 -1.06l-0.86 0.86a0.75 0.75 0 0 0 1.06 1.06l0.86 -0.86Z" clipRule="evenodd" strokeWidth="1" />
  </>} />;
}

export function StickyNoteIcon(props: IconProps) {
  return <IconFrame name="nota-adesiva" {...props} drawing={(id) => <>
    <path id={id + "-foglio-nota"} fill="#8fbffa" d="M1.5 14h6.87868c0.39782 0 0.77936 -0.158 1.06066 -0.4393l4.12136 -4.12136C13.842 9.15804 14 8.7765 14 8.37868V1.5c0 -0.828427 -0.6716 -1.5 -1.5 -1.5h-11C0.671573 0 0 0.671573 0 1.5v11c0 0.8284 0.671573 1.5 1.5 1.5Z" strokeWidth="1" />
    <path id={id + "-angolo-nota"} fill="#2859c5" d="M13.9951 8.5H9c-0.27614 0 -0.5 0.22386 -0.5 0.5v4.9951c0.35341 -0.0287 0.68677 -0.1819 0.93934 -0.4344l4.12136 -4.12136c0.2525 -0.25257 0.4057 -0.58593 0.4344 -0.93934Z" strokeWidth="1" />
  </>} />;
}

export function BookmarkIcon(props: IconProps) {
  return <IconFrame name="segnalibro" {...props} drawing={(id) => <path id={id + "-nastro-segnalibro"} fill="#8fbffa" d="M4 0c-0.39782 0 -0.77936 0.158035 -1.06066 0.43934C2.65804 0.720644 2.5 1.10218 2.5 1.5v12c0 0.2022 0.12182 0.3845 0.30866 0.4619 0.18684 0.0774 0.40189 0.0347 0.54489 -0.1083L7 10.2071l3.6464 3.6465c0.143 0.143 0.3581 0.1857 0.5449 0.1083 0.1869 -0.0774 0.3087 -0.2597 0.3087 -0.4619v-12c0 -0.39783 -0.158 -0.779356 -0.4393 -1.06066C10.7794 0.158035 10.3978 0 10 0H4Z" strokeWidth="1" />} />;
}

export function DownloadIcon(props: IconProps) {
  return <IconFrame name="scarica" {...props} drawing={(id) => <>
    <path id={id + "-base-scaricamento"} fill="#2859c5" fillRule="evenodd" d="M3 13a1 1 0 0 1 1 -1h6a1 1 0 1 1 0 2H4a1 1 0 0 1 -1 -1Z" clipRule="evenodd" strokeWidth="1" />
    <path id={id + "-freccia-scaricamento"} fill="#8fbffa" fillRule="evenodd" d="M8 1a1 1 0 0 0 -2 0v5H4a0.5 0.5 0 0 0 -0.354 0.854l3 3a0.5 0.5 0 0 0 0.708 0l3 -3A0.5 0.5 0 0 0 10 6H8V1Z" clipRule="evenodd" strokeWidth="1" />
  </>} />;
}

export function UploadIcon(props: IconProps) {
  return <IconFrame name="carica" {...props} drawing={(id) => <>
    <path id={id + "-cornice-tratteggiata"} fill="#8fbffa" fillRule="evenodd" d="m7.962 1.5 -1.923 0a0.75 0.75 0 0 1 0 -1.5h1.923a0.75 0.75 0 0 1 0 1.5Zm0 11a0.75 0.75 0 0 1 0 1.5H6.039a0.75 0.75 0 0 1 0 -1.5h1.923ZM10.406 0.654a0.75 0.75 0 0 0 0.525 0.922 2.14 2.14 0 0 1 1.473 1.423 0.75 0.75 0 1 0 1.432 -0.446A3.64 3.64 0 0 0 11.328 0.129a0.75 0.75 0 0 0 -0.922 0.525Zm-6.812 0a0.75 0.75 0 0 1 -0.525 0.922 2.14 2.14 0 0 0 -1.473 1.423 0.75 0.75 0 1 1 -1.432 -0.446A3.64 3.64 0 0 1 2.672 0.129a0.75 0.75 0 0 1 0.922 0.525Zm9.656 4.634a0.75 0.75 0 0 0 -0.75 0.75l0 1.924a0.75 0.75 0 0 0 1.5 0l0 -1.924a0.75 0.75 0 0 0 -0.75 -0.75Zm-11.75 0.75a0.75 0.75 0 0 0 -1.5 0l0 1.924a0.75 0.75 0 0 0 1.5 0l0 -1.924Zm11.843 4.47a0.75 0.75 0 0 0 -0.939 0.493 2.14 2.14 0 0 1 -1.473 1.423 0.75 0.75 0 0 0 0.397 1.447 3.64 3.64 0 0 0 2.508 -2.424 0.75 0.75 0 0 0 -0.493 -0.939Zm-11.747 0.493a0.75 0.75 0 0 0 -1.432 0.446 3.64 3.64 0 0 0 2.508 2.424 0.75 0.75 0 1 0 0.397 -1.447 2.14 2.14 0 0 1 -1.473 -1.423Z" clipRule="evenodd" strokeWidth="1" />
    <path id={id + "-freccia-caricamento"} fill="#2859c5" fillRule="evenodd" d="M9.462 6.191A0.5 0.5 0 0 1 9 6.5H7.75V10a0.75 0.75 0 0 1 -1.5 0V6.5H5a0.5 0.5 0 0 1 -0.354 -0.854l2 -2a0.5 0.5 0 0 1 0.708 0l2 2a0.5 0.5 0 0 1 0.108 0.545Z" clipRule="evenodd" strokeWidth="1" />
  </>} />;
}

export function UploadCircleIcon(props: IconProps) {
  return <IconFrame name="importa-cerchio" {...props} drawing={(id) => <>
    <path id={id + "-sfondo-circolare"} fill="#8fbffa" d="M0 7a7 7 0 1 0 14 0A7 7 0 1 0 0 7" strokeWidth="1" />
    <path id={id + "-freccia-importazione"} fill="#2859c5" d="m7.354 2.897 2.792 2.793a0.5 0.5 0 0 1 -0.353 0.853H8l0 3.707a1 1 0 1 1 -2 0l0 -3.707H4.207a0.5 0.5 0 0 1 -0.353 -0.853l2.792 -2.793a0.5 0.5 0 0 1 0.708 0Z" strokeWidth="1" />
  </>} />;
}

export function DownloadCircleIcon(props: IconProps) {
  return <IconFrame name="esporta-cerchio" {...props} drawing={(id) => <>
    <path id={id + "-sfondo-circolare"} fill="#8fbffa" d="M0 7a7 7 0 1 0 14 0A7 7 0 1 0 0 7" strokeWidth="1" />
    <path id={id + "-freccia-esportazione"} fill="#2859c5" d="m7.354 11.104 2.792 -2.793a0.5 0.5 0 0 0 -0.353 -0.854H8L8 3.75a1 1 0 1 0 -2 0l0 3.707H4.207a0.5 0.5 0 0 0 -0.353 0.854l2.792 2.793a0.5 0.5 0 0 0 0.708 0Z" strokeWidth="1" />
  </>} />;
}

export function PencilIcon(props: IconProps) {
  return <IconFrame name="matita" {...props} drawing={(id) => <path id={id + "-punta-matita"} fill="#8fbffa" d="M10.715 -0.001a1.5 1.5 0 0 0 -1.07 0.449L1.407 8.645a0.5 0.5 0 0 0 -0.128 0.22l-1.26 4.5a0.5 0.5 0 0 0 0.616 0.616l4.5 -1.26a0.5 0.5 0 0 0 0.22 -0.128l8.197 -8.238 0.002 -0.001a1.5 1.5 0 0 0 0 -2.128l-0.002 -0.001L11.786 0.449a1.499 1.499 0 0 0 -1.071 -0.45Z" strokeWidth="1" />} />;
}

export function RecycleBinIcon(props: IconProps) {
  return <IconFrame name="cestino" {...props} drawing={(id) => <>
    <path id={id + "-corpo-cestino"} fill="#8fbffa" fillRule="evenodd" d="M2.5 2.823a0.5 0.5 0 0 0 -0.5 0.5v9.145c0 0.4 0.156 0.784 0.437 1.069 0.28 0.285 0.663 0.447 1.063 0.447h7c0.4 0 0.783 -0.162 1.063 -0.447 0.28 -0.285 0.437 -0.67 0.437 -1.07V3.324a0.5 0.5 0 0 0 -0.5 -0.5h-9Z" clipRule="evenodd" strokeWidth="1" />
    <path id={id + "-righe-eliminazione"} fill="#2859c5" fillRule="evenodd" d="M5.625 7.124a0.625 0.625 0 1 0 -1.25 0v4.002a0.625 0.625 0 0 0 1.25 0V7.124Zm4 0a0.625 0.625 0 1 0 -1.25 0v4.002a0.625 0.625 0 0 0 1.25 0V7.124Z" clipRule="evenodd" strokeWidth="1" />
    <path id={id + "-coperchio-cestino"} fill="#2859c5" fillRule="evenodd" d="M7 1.5a1.75 1.75 0 0 0 -1.677 1.25h3.354A1.75 1.75 0 0 0 7 1.5Zm3.211 1.25a3.25 3.25 0 0 0 -6.422 0H1a0.75 0.75 0 0 0 0 1.5h12a0.75 0.75 0 0 0 0 -1.5h-2.789Z" clipRule="evenodd" strokeWidth="1" />
  </>} />;
}

export function ScriptIcon(props: IconProps) {
  return <IconFrame name="documento-codice" {...props} drawing={(id) => <>
    <path id={id + "-foglio-codice"} fill="#8fbffa" d="M10.5 1.75A1.75 1.75 0 0 1 12.25 0h-8A1.75 1.75 0 0 0 2.5 1.75V11c0 0.818 -0.393 1.544 -1 2h-1a0.5 0.5 0 0 0 0 1H8a2.5 2.5 0 0 0 2.5 -2.5V1.75Z" strokeWidth="1" />
    <path id={id + "-angolo-codice"} fill="#2859c5" d="M12.25 0A1.75 1.75 0 0 1 14 1.75V3.5a0.5 0.5 0 0 1 -0.5 0.5h-3V1.75A1.75 1.75 0 0 1 12.25 0Z" strokeWidth="1" />
    <path id={id + "-righe-codice"} fill="#2859c5" fillRule="evenodd" d="M5.177 3.5c0 -0.345 0.28 -0.625 0.625 -0.625H7.74a0.625 0.625 0 1 1 0 1.25H5.802a0.625 0.625 0 0 1 -0.625 -0.625Zm-1.291 3c0 -0.345 0.28 -0.625 0.625 -0.625H7.74a0.625 0.625 0 1 1 0 1.25H4.51a0.625 0.625 0 0 1 -0.624 -0.625Zm0.625 2.375a0.625 0.625 0 1 0 0 1.25H7.74a0.625 0.625 0 1 0 0 -1.25H4.51Z" clipRule="evenodd" strokeWidth="1" />
  </>} />;
}

export function CloseIcon(props: IconProps) {
  return <IconFrame name="chiudi" {...props} drawing={(id) => <path id={id + "-croce-chiusura"} fill="#2859c5" fillRule="evenodd" d="M1.707 0.293A1 1 0 0 0 0.293 1.707L5.586 7 0.293 12.293a1 1 0 1 0 1.414 1.414L7 8.414l5.293 5.293a1 1 0 0 0 1.414 -1.414L8.414 7l5.293 -5.293A1 1 0 0 0 12.293 0.293L7 5.586 1.707 0.293Z" clipRule="evenodd" strokeWidth="1" />} />;
}

export function SettingsIcon(props: IconProps) {
  return <IconFrame name="ingranaggio" {...props} drawing={(id) => <path id={id + "-ruota-impostazioni"} fill="#8fbffa" fillRule="evenodd" d="m5.557 0.69 -0.463 1.195 -1.594 0.904 -1.27 -0.194a1.077 1.077 0 0 0 -1.078 0.528l-0.43 0.754a1.077 1.077 0 0 0 0.086 1.217l0.807 1.001v1.81L0.83 8.906a1.077 1.077 0 0 0 -0.086 1.217l0.43 0.754a1.077 1.077 0 0 0 1.078 0.528l1.27 -0.194 1.573 0.904 0.463 1.196a1.076 1.076 0 0 0 1 0.689h0.905a1.076 1.076 0 0 0 1.002 -0.69l0.463 -1.195 1.572 -0.904 1.27 0.194a1.077 1.077 0 0 0 1.078 -0.528l0.43 -0.754a1.077 1.077 0 0 0 -0.086 -1.217l-0.807 -1.001v-1.81l0.786 -1.001a1.077 1.077 0 0 0 0.086 -1.217l-0.43 -0.754a1.076 1.076 0 0 0 -1.078 -0.528l-1.27 0.194 -1.573 -0.904L8.443 0.689A1.077 1.077 0 0 0 7.442 0h-0.884a1.077 1.077 0 0 0 -1.001 0.69ZM7 9.25a2.25 2.25 0 1 0 0 -4.5 2.25 2.25 0 0 0 0 4.5Z" clipRule="evenodd" strokeWidth="1" />} />;
}

export function HamburgerIcon(props: IconProps) {
  return <IconFrame name="menu" {...props} drawing={(id) => <path id={id + "-tre-righe-menu"} fill="#8fbffa" fillRule="evenodd" d="M1 2.5a1 1 0 0 1 1-1h10a1 1 0 1 1 0 2H2a1 1 0 0 1-1-1Zm0 4.5a1 1 0 0 1 1-1h10a1 1 0 1 1 0 2H2a1 1 0 0 1-1-1Zm0 4.5a1 1 0 0 1 1-1h10a1 1 0 1 1 0 2H2a1 1 0 0 1-1-1Z" clipRule="evenodd" strokeWidth="1" />} />;
}

export function FloppyDiskIcon(props: IconProps) {
  return <IconFrame name="dischetto-salvataggio" {...props} drawing={(id) => <>
    <path id={id + "-corpo-dischetto"} fill="#8fbffa" fillRule="evenodd" d="m4.91 0 -0.002 0a1.5 1.5 0 0 0 -1.05 0.435l-0.002 0.001 -3.42 3.42 -0.001 0.002A1.5 1.5 0 0 0 0 4.908V12.5A1.5 1.5 0 0 0 1.5 14h11a1.5 1.5 0 0 0 1.5 -1.5v-11A1.5 1.5 0 0 0 12.5 0L4.91 0Z" clipRule="evenodd" strokeWidth="1" />
    <path id={id + "-finestra-inferiore"} fill="#2859c5" d="M11.241 14V9a0.46 0.46 0 0 0 -0.177 -0.354 0.677 0.677 0 0 0 -0.429 -0.146h-7.27a0.677 0.677 0 0 0 -0.429 0.146A0.46 0.46 0 0 0 2.76 9v5" strokeWidth="1" />
    <path id={id + "-finestra-superiore"} fill="#2859c5" d="M11.241 0v3.5a0.47 0.47 0 0 1 -0.168 0.354 0.62 0.62 0 0 1 -0.406 0.146H6.074a0.62 0.62 0 0 1 -0.406 -0.146A0.47 0.47 0 0 1 5.5 3.5V0" strokeWidth="1" />
  </>} />;
}

export function StarIcon(props: IconProps) {
  return <IconFrame name="stella-annotazioni" {...props} drawing={(id) => <path id={id + "-stella-annotazioni"} fill="#8fbffa" fillRule="evenodd" d="M7 0.277a1.04 1.04 0 0 0 -0.94 0.596L4.472 4.078a0.495 0.495 0 0 0 -0.012 0.023 0.486 0.486 0 0 0 -0.023 0.004L0.94 4.623a1.04 1.04 0 0 0 -0.617 1.788l2.56 2.469 0.006 0.005a0.03 0.03 0 0 1 0.009 0.027l0 0.004 -0.61 3.568 0 0.001a1.05 1.05 0 0 0 1.526 1.107l3.15 -1.665a0.09 0.09 0 0 1 0.072 0l3.15 1.664a1.049 1.049 0 0 0 1.527 -1.106l-0.61 -3.57 0 -0.003c-0.002 -0.004 -0.001 -0.01 0 -0.014a0.03 0.03 0 0 1 0.008 -0.013l0.006 -0.005 2.559 -2.47a1.04 1.04 0 0 0 -0.617 -1.787l-3.496 -0.518a0.486 0.486 0 0 0 -0.023 -0.004 0.495 0.495 0 0 0 -0.012 -0.023L7.94 0.873A1.04 1.04 0 0 0 7 0.277Z" clipRule="evenodd" strokeWidth="1" />} />;
}

export function DashboardIcon(props: IconProps) {
  return <IconFrame name="cruscotto-laterale" {...props} drawing={(id) => <path id={id + "-riquadri-cruscotto"} fill="#8fbffa" fillRule="evenodd" d="M1 0a1 1 0 0 0 -1 1v6a1 1 0 0 0 1 1h4a1 1 0 0 0 1 -1V1a1 1 0 0 0 -1 -1H1Zm7 1a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v2.01a1 1 0 0 1 -1 1H9a1 1 0 0 1 -1 -1V1Zm0 6a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v6a1 1 0 0 1 -1 1H9a1 1 0 0 1 -1 -1V7Zm-8 3.99a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1V13a1 1 0 0 1 -1 1H1a1 1 0 0 1 -1 -1v-2.01Z" clipRule="evenodd" strokeWidth="1" />} />;
}
