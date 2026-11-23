import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { resolveAppSurface } from "@/lib/routing-policy";
import { OFFICIAL_BUSINESS } from "@/config/public-website";

export const metadata: Metadata = {
  metadataBase: new URL(OFFICIAL_BUSINESS.websiteUrl),
  title: {
    default: `${OFFICIAL_BUSINESS.name} — Loan Consultancy & Advisory | Latur, Maharashtra`,
    template: `%s | ${OFFICIAL_BUSINESS.name}`
  },
  description: OFFICIAL_BUSINESS.homepageIntro,
  alternates: {
    canonical: "/"
  },
  openGraph: {
    type: "website",
    locale: "en_IN",
    url: `${OFFICIAL_BUSINESS.websiteUrl}/`,
    siteName: OFFICIAL_BUSINESS.name,
    title: `${OFFICIAL_BUSINESS.name} — ${OFFICIAL_BUSINESS.homepageHeadline}`,
    description: OFFICIAL_BUSINESS.homepageIntro,
    images: [
      {
        url: "/images/og-avani-loan-services.svg",
        width: 1200,
        height: 630,
        alt: `${OFFICIAL_BUSINESS.name} — Loan Consultancy & Advisory`
      }
    ]
  },
  twitter: {
    card: "summary_large_image",
    title: `${OFFICIAL_BUSINESS.name} — Loan Consultancy & Advisory`,
    description: OFFICIAL_BUSINESS.homepageIntro,
    images: ["/images/og-avani-loan-services.svg"]
  },
  robots: {
    index: true,
    follow: true
  }
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const hdrs = await headers();
  const requestHost = hdrs.get("x-forwarded-host") || hdrs.get("host");
  const surface = resolveAppSurface(requestHost);

  return (
    <html
      lang="en"
      className={surface === "public" ? "h-full font-sans antialiased" : "dark h-full font-sans antialiased"}
    >
      <body
        className={
          surface === "public"
            ? "min-h-screen bg-[#FFFFFF] text-[#253447]"
            : "flex min-h-screen bg-background text-foreground"
        }
      >
        <AppShell surface={surface}>{children}</AppShell>
      </body>
    </html>
  );
}
