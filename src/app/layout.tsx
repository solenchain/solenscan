import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SolenScan — Solen Blockchain Explorer",
  description: "Block explorer for the Solen blockchain. View blocks, transactions, accounts, validators, contracts, rollups, and governance proposals.",
  keywords: ["Solen", "blockchain", "explorer", "block explorer", "transactions", "validators", "rollups"],
  authors: [{ name: "Solen Foundation" }],
  icons: {
    icon: "/favicon.png",
  },
  openGraph: {
    type: "website",
    url: "https://solenscan.io",
    title: "SolenScan — Solen Blockchain Explorer",
    description: "Explore blocks, transactions, accounts, validators, contracts, and rollups on the Solen blockchain.",
    siteName: "SolenScan",
    images: [{ url: "/logo.png", width: 512, height: 512, alt: "SolenScan" }],
  },
  twitter: {
    card: "summary",
    site: "@solenchain",
    title: "SolenScan — Solen Blockchain Explorer",
    description: "Explore blocks, transactions, accounts, validators, contracts, and rollups on the Solen blockchain.",
    images: ["/logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen flex flex-col bg-gray-50`}
      >
        <Providers>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
