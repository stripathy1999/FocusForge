import type { Metadata } from "next";
import { Geist, Geist_Mono, Jura } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const jura = Jura({
  variable: "--font-jura",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FocusForge",
  description: "Track browser focus sessions and resume with context.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${jura.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
