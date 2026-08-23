import type { Metadata } from "next";
import "./globals.css";

const title = "Structural Codes — Corpus normativo verificabile";
const description =
  "Esplora NTC 2018 e Circolare 7/2019 con testo, evidence, issue e relazioni tracciate.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, type: "website", locale: "it_IT" },
  twitter: { card: "summary", title, description },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
