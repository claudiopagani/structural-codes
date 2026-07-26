import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  const baseUrl = host ? new URL(`${protocol}://${host}`) : undefined;
  const title = "Structural Codes — Corpus normativo verificabile";
  const description =
    "Esplora NTC 2018 e Circolare 7/2019 con testo, evidence, issue e relazioni tracciate.";

  return {
    metadataBase: baseUrl,
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      locale: "it_IT",
      images: baseUrl
        ? [
            {
              url: new URL("/og.png", baseUrl).href,
              width: 1200,
              height: 630,
              alt: "Structural Codes — Corpus normativo verificabile",
            },
          ]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: baseUrl ? [new URL("/og.png", baseUrl).href] : undefined,
    },
  };
}

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
