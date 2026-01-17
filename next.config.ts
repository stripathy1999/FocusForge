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
 * - Primary: #2BB7D0 (headers, main CTAs, primary elements)
 * - Secondary: #5BC5D9 (subtitles, secondary actions)
 * - Light Accent: #4AB5C9 (lighter subtitle variants)
 * - Muted: #8f8f9f (body text, descriptions)
 * - Primary Dark: #22a3be (darker variant)
 * - Primary Light: #7ee0ed (lighter variant)
 */

export const theme = {
  colors: {
    primary: "#2BB7D0",
    secondary: "#5BC5D9",
    lightAccent: "#4AB5C9",
    muted: "#8f8f9f",
    primaryDark: "#22a3be",
    primaryLight: "#7ee0ed",
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