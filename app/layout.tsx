import type { Metadata } from "next";
import { Jura, Lato } from "next/font/google";
import "./globals.css";

// Font loaders require all values to be literals, not dynamic config
// Theme config in next.config.ts is for reference/documentation and colors only
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
