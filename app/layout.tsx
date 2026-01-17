import type { Metadata } from "next";
import { Jura, Lato } from "next/font/google";
import "./globals.css";

const jura = Jura({
  variable: "--font-jura",
  subsets: ["latin"],
  display: "swap",
});

const lato = Lato({
  variable: "--font-lato",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
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
        className={`${jura.variable} ${lato.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
