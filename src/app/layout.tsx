// STRAYMUTANT.DEV — Tamak Bookshop
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import SiteLogoPattern from "@/components/site/SiteLogoPattern";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const siteTitle = "Tamak Bookshop — books in Kasoa, Ghana";
const siteDescription =
  "Books for every class level, from KG to SHS. Order online, pay by mobile money or bank transfer, and pick up in Kasoa. Wholesale accounts for schools and vendors.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: siteTitle, template: "%s · Tamak Bookshop" },
  description: siteDescription,
  applicationName: "Tamak Bookshop",
  openGraph: {
    type: "website",
    siteName: "Tamak Bookshop",
    locale: "en_GH",
    title: siteTitle,
    description: siteDescription,
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
  },
};

export const viewport: Viewport = {
  themeColor: "#164A41",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <SiteLogoPattern />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}