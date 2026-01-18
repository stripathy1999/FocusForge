import { computeSummary } from "@/lib/grouping";
import { getEvents, getSession, setAnalysis } from "@/lib/store";
import { AnalysisResult } from "@/lib/types";

const GEMINI_MODEL = "gemini-2.5-flash-lite";

export async function runGeminiAnalysis(
  sessionId: string,
): Promise<AnalysisResult | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[Gemini] Missing GEMINI_API_KEY");
    return null;
  }

  const session = await getSession(sessionId);
  if (!session) {
    return null;
  }
  const events = await getEvents(sessionId);
  const summary = computeSummary(session, events);
  console.info("[Gemini] Starting analysis", {
    sessionId,
    events: events.length,
  });

  const payload = buildPayload(summary);
  const confidence = payload.confidenceScore;
  const confidenceLabel = toConfidenceLabel(confidence);
  if (confidenceLabel === "low") {
    const analysis: AnalysisResult = {
      source: "gemini",
      aiRecap: "Not enough signal; showing ground truth only.",
      aiActions: [],
      aiConfidenceScore: confidence,
      aiConfidenceLabel: confidenceLabel,
      resumeSummary: "Not enough signal; showing ground truth only.",
      nextActions: [],
      pendingDecisions: [],
    };
    await setAnalysis(sessionId, analysis);
    console.info("[Gemini] Skipped due to low confidence", {
      sessionId,
      confidence,
    });
    return analysis;
  }

  const prompt = buildPrompt(payload);
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
        },
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.warn("[Gemini] Request failed", response.status, response.statusText);
    console.warn("[Gemini] Error body", errorText.slice(0, 500));
    return null;
  }

  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  if (!text) {
    console.warn("[Gemini] Empty response text");
  }
  const parsed = safeParseJson(text);
  const normalized = normalizeAiOutput(parsed, payload);
  const analysis: AnalysisResult = normalized
    ? {
        source: "gemini",
        aiRecap: normalized.recap,
        aiActions: normalized.actions,
        aiConfidenceScore: payload.confidenceScore,
        aiConfidenceLabel: confidenceLabel,
        resumeSummary: normalized.recap,
        nextActions: normalized.actions,
        pendingDecisions: [],
      }
    : {
        source: "gemini",
        aiRecap: "Not enough signal; showing ground truth only.",
        aiActions: [],
        aiConfidenceScore: payload.confidenceScore,
        aiConfidenceLabel: "low",
        resumeSummary: "Not enough signal; showing ground truth only.",
        nextActions: [],
        pendingDecisions: [],
      };
  console.info("[Gemini] Analysis stored", {
    sessionId,
    confidence: analysis.aiConfidenceScore,
  });
  await setAnalysis(sessionId, analysis);
  return analysis;
}

type PromptPayload = {
  intentTags: string[];
  totalTimeSec: number;
  lastStop?: { label: string; url: string; domain: string };
  topWorkspaces: Array<{
    domain: string;
    label: string;
    timeSec: number;
    topTitles: string[];
    topUrls: string[];
  }>;
  confidenceScore: number;
};

function buildPayload(
  summary: ReturnType<typeof computeSummary>,
): PromptPayload {
  const lastStopUrl = summary.lastStop?.url ?? "";
  return {
    intentTags: summary.intent_tags ?? [],
    totalTimeSec: summary.focus.totalTimeSec ?? 0,
    lastStop: lastStopUrl
      ? {
          label:
            summary.lastStop?.title ||
            summary.lastStop?.label ||
            lastStopUrl,
          url: lastStopUrl,
          domain: domainFromUrl(lastStopUrl),
        }
      : undefined,
    topWorkspaces: summary.domains.slice(0, 5).map((domain) => ({
      domain: domain.domain,
      label: domain.label,
      timeSec: domain.timeSec,
      topTitles: (domain.topTitles ?? []).slice(0, 3),
      topUrls: domain.topUrls.slice(0, 3),
    })),
    confidenceScore: computeConfidenceScore(summary),
  };
}

function buildPrompt(payload: PromptPayload): string {
  const domains = payload.topWorkspaces.map((ws) => ws.domain);
  return [
    "You are a productivity assistant. Return ONLY valid JSON.",
    "Use ONLY the provided data: domains, titles, timestamps, durations, lastStop, intentTags.",
    "Do NOT infer activities beyond what the data supports.",
    "If you cannot ground a claim, omit it.",
    "The recap must be 2-3 sentences.",
    "Return exactly 3 actions. Each action must explicitly mention one of the domains.",
    "Do NOT invent domains. Use the exact domain string (e.g., linkedin.com).",
    "Do NOT add markdown.",
    "",
    "Schema:",
    "{",
    '  "recap": "string (2-3 sentences)",',
    '  "actions": ["string", "string", "string"],',
    '  "confidenceScore": 0',
    "}",
    "",
    `Allowed domains: ${domains.join(", ")}`,
    "Input JSON:",
    JSON.stringify(payload),
  ].join("\n");
}

function safeParseJson(text: string): unknown | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) {
    return null;
  }
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

function normalizeAiOutput(
  parsed: unknown,
  payload: PromptPayload,
): { recap: string; actions: string[] } | null {
  if (!parsed || typeof parsed !== "object") {
    return null;
  }
  const data = parsed as {
    recap?: unknown;
    actions?: unknown;
    confidenceScore?: unknown;
  };
  const recap = typeof data.recap === "string" ? data.recap.trim() : "";
  if (!recap || !isValidSentenceCount(recap)) {
    return null;
  }
  const actions = Array.isArray(data.actions)
    ? data.actions.filter((action) => typeof action === "string")
    : [];
  if (actions.length !== 3) {
    return null;
  }
  const domains = payload.topWorkspaces.map((ws) => ws.domain.toLowerCase());
  const actionsWithDomain = actions.every((action) =>
    domains.some((domain) => action.toLowerCase().includes(domain)),
  );
  if (!actionsWithDomain) {
    return null;
  }
  return { recap, actions };
}

function isValidSentenceCount(text: string): boolean {
  const matches = text.match(/[.!?]+/g);
  const count = matches ? matches.length : 0;
  return count >= 2 && count <= 3;
}

function computeConfidenceScore(summary: ReturnType<typeof computeSummary>): number {
  const total = summary.focus.totalTimeSec ?? 0;
  if (!total || summary.intent_tags.length === 0) {
    return 0;
  }
  const known = total - (summary.focus.unknownTimeSec ?? 0);
  const ratio = total > 0 ? known / total : 0;
  return Math.max(0, Math.min(1, Number(ratio.toFixed(2))));
}

function toConfidenceLabel(score: number): "low" | "medium" | "high" {
  if (score >= 0.7) return "high";
  if (score >= 0.4) return "medium";
  return "low";
}

function domainFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}
