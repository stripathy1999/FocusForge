import { computeSummary } from "@/lib/grouping";
import { getEvents, getSession, setAnalysis } from "@/lib/store";
import { AnalysisResult } from "@/lib/types";

const GEMINI_MODEL = "gemini-1.5-flash-002";

export async function runGeminiAnalysis(
  sessionId: string,
): Promise<AnalysisResult | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("[Gemini] Missing GEMINI_API_KEY");
    return null;
  }

  const session = getSession(sessionId);
  if (!session) {
    return null;
  }
  const events = getEvents(sessionId);
  const summary = computeSummary(session, events);
  console.info("[Gemini] Starting analysis", {
    sessionId,
    events: events.length,
  });

  const prompt = buildPrompt(summary);
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
  const analysis: AnalysisResult = parsed
    ? {
        source: "gemini",
        resumeSummary: parsed.resumeSummary ?? summary.resumeSummary,
        nextActions: parsed.nextActions ?? summary.nextActions,
        pendingDecisions: parsed.pendingDecisions ?? [],
      }
    : {
        source: "gemini",
        resumeSummary: text.trim() || summary.resumeSummary,
        nextActions: summary.nextActions,
        pendingDecisions: [],
      };
  if (!analysis.resumeSummary) {
    return null;
  }
  console.info("[Gemini] Analysis stored", {
    sessionId,
    hasResume: Boolean(analysis.resumeSummary),
  });
  setAnalysis(sessionId, analysis);
  return analysis;
}

function buildPrompt(summary: ReturnType<typeof computeSummary>): string {
  const workspaces = summary.domains
    .slice(0, 4)
    .map((domain) => `- ${domain.label}: ${domain.timeSec}s`)
    .join("\n");
  const lastStop = summary.lastStop?.title || summary.lastStop?.url || "unknown";

  return [
    "You are assisting a productivity app. Return ONLY valid JSON.",
    "Fields: resumeSummary (string), nextActions (string[]), pendingDecisions (string[]).",
    "Be concise, human, and specific. No markdown.",
    "",
    `Workspaces:\n${workspaces}`,
    `Last stop: ${lastStop}`,
  ].join("\n");
}

function safeParseJson(text: string): Partial<AnalysisResult> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) {
    return null;
  }
  try {
    return JSON.parse(text.slice(start, end + 1)) as Partial<AnalysisResult>;
  } catch {
    return null;
  }
}
