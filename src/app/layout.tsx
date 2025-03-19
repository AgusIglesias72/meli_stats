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
  title: "UiCore PRO - The only WordPress theme you'll ever need",
  description: "Create unlimited websites, tailor themes to your brand, and access all UiCore Framework features with our affordable yearly subscription.",
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
