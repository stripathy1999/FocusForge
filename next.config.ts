import type { NextConfig } from "next";

/**
 * Next.js Configuration & Theme
 * 
 * Theme Configuration:
 * 
 * Font Families:
 * - Headers: Jura (semibold/bold) - used with primary color for main headers
 * - Subtitles/Body: Lato (regular/medium) - used for body text
 * 
 * Colors:
 * - Primary: #32578E (headers, main CTAs, primary elements)
 * - Secondary: #4777B9 (subtitles, secondary actions)
 * - Light Accent: #669EE6 (lighter subtitle variants)
 * - Muted: #8f8f9f (body text, descriptions)
 * - Primary Dark: #223758 (darker variant)
 * - Primary Light: #9ED5FF (lighter variant)
 */

export const theme = {
  colors: {
    primary: "#32578E",
    secondary: "#4777B9",
    lightAccent: "#669EE6",
    muted: "#8f8f9f",
    primaryDark: "#223758",
    primaryLight: "#9ED5FF",
  },
  fonts: {
    header: {
      family: "Jura",
      variable: "--font-jura",
      weights: ["400", "500", "600", "700"],
    },
    body: {
      family: "Lato",
      variable: "--font-lato",
      weights: ["400", "700"],
    },
  },
} as const;

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;