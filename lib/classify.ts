type WorkspaceType = "primary" | "support" | "drift";

const PRIMARY_DOMAINS = new Set([
  "leetcode.com",
  "hellointerview.com",
  "educative.io",
  "docs.google.com",
  "github.com",
  "notion.so",
  "linkedin.com",
  "devpost.com",
]);

const SUPPORT_DOMAINS = new Set([
  "chatgpt.com",
  "gemini.google.com",
  "mail.google.com",
  "calendar.google.com",
  "drive.google.com",
  "figma.com",
  "vercel.com",
  "supabase.com",
]);

const DRIFT_DOMAINS = new Set([
  "youtube.com",
  "music.youtube.com",
  "reddit.com",
  "instagram.com",
  "x.com",
  "twitter.com",
  "tiktok.com",
  "netflix.com",
]);

const IGNORE_SUBSTRINGS = [
  "accounts.google.com",
  "oauth",
  "consent",
  "signin",
  "login",
  "chrome://",
  "chrome-extension://",
];

const YOUTUBE_LEARNING_HINTS = [
  "course",
  "tutorial",
  "lecture",
  "lesson",
  "series",
  "bootcamp",
];

export function classifyWorkspace(
  url: string,
  title: string,
  domain: string,
): { type: WorkspaceType; ignore: boolean } {
  const lowerUrl = url.toLowerCase();
  if (isInternalDomain(domain)) {
    return { type: "support", ignore: true };
  }
  for (const value of IGNORE_SUBSTRINGS) {
    if (lowerUrl.includes(value)) {
      return { type: "support", ignore: true };
    }
  }

  if (PRIMARY_DOMAINS.has(domain)) {
    return { type: "primary", ignore: false };
  }

  if (SUPPORT_DOMAINS.has(domain)) {
    return { type: "support", ignore: false };
  }

  if (DRIFT_DOMAINS.has(domain)) {
    if (domain === "youtube.com") {
      const lowerTitle = title.toLowerCase();
      const isLearning = YOUTUBE_LEARNING_HINTS.some((hint) =>
        lowerTitle.includes(hint),
      );
      return { type: isLearning ? "support" : "drift", ignore: false };
    }
    return { type: "drift", ignore: false };
  }

  return { type: "support", ignore: false };
}

function isInternalDomain(domain: string): boolean {
  if (domain === "localhost" || domain === "127.0.0.1") {
    return true;
  }
  if (domain === "focusforge.app") {
    return true;
  }
  if (domain.endsWith(".vercel.app")) {
    return true;
  }
  return false;
}
