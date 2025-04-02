import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ClientBody from "./ClientBody";
import { bdoGrotesk } from "@/styles/fonts";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MELI - Green Deco",
  description: "Sistema de monitoreo y seguimiento de productos en Mercado Libre para Green Deco",
  icons: {
    icon: "/favicon.ico",
  },
  applicationName: "MELI Manager",
  authors: [
    {
      name: "Green Deco Team",
    },
  ],
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#18d096" },
    { media: "(prefers-color-scheme: dark)", color: "#111213" },
  ],
};
export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#18d096" },
    { media: "(prefers-color-scheme: dark)", color: "#111213" },
  ],
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${bdoGrotesk.variable} ${inter.variable}`}>
      <ClientBody>
        {children}
      </ClientBody>
    </html>
  );
}
