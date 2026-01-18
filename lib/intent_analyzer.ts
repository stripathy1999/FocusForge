/**
 * AI-Powered Intent Alignment Analyzer
 * Uses Gemini AI to analyze whether websites match user's stated intent
 */

const GEMINI_MODEL = "gemini-2.5-flash-lite";

export interface IntentAlignmentResult {
  alignment: "aligned" | "neutral" | "off-intent";
  confidence: number; // 0-1
  reasoning: string; // Brief explanation
}

export interface DomainInfo {
  domain: string;
  label: string;
  topUrls: string[];
  topTitles?: string[];
  timeSec: number;
  type?: "primary" | "support" | "drift";
}

/**
 * Analyze intent alignment for a domain using AI
 */
export async function analyzeIntentAlignment(
  userIntent: string,
  domainInfo: DomainInfo
): Promise<IntentAlignmentResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Fallback to rule-based if no API key
    return fallbackAlignment(userIntent, domainInfo);
  }

  try {
    const prompt = buildAlignmentPrompt(userIntent, domainInfo);
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3, // Lower temperature for more consistent classification
            maxOutputTokens: 200,
          },
        }),
      }
    );

    if (!response.ok) {
      console.warn("[Intent Analyzer] API error, using fallback");
      return fallbackAlignment(userIntent, domainInfo);
    }

    const data = (await response.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    
    if (!text) {
      return fallbackAlignment(userIntent, domainInfo);
    }

    return parseAlignmentResponse(text) || fallbackAlignment(userIntent, domainInfo);
  } catch (error) {
    console.error("[Intent Analyzer] Error:", error);
    return fallbackAlignment(userIntent, domainInfo);
  }
}

function buildAlignmentPrompt(userIntent: string, domainInfo: DomainInfo): string {
  const urlsPreview = domainInfo.topUrls.slice(0, 3).join(", ");
  const titlesPreview = domainInfo.topTitles?.slice(0, 3).join(", ") || "";

  return `Analyze if a website domain matches a user's stated intent. Return ONLY valid JSON.

User Intent: "${userIntent}"

Domain Information:
- Domain: ${domainInfo.domain}
- Label: ${domainInfo.label}
- Time spent: ${domainInfo.timeSec} seconds
- Sample URLs: ${urlsPreview}
${titlesPreview ? `- Sample titles: ${titlesPreview}` : ""}

Determine alignment:
- "aligned": Website directly supports/relates to the user's intent
- "neutral": Website is neither clearly aligned nor off-intent (e.g., utilities, search, docs)
- "off-intent": Website distracts from or is unrelated to the user's intent

Consider:
- If intent is "relax/break", entertainment sites are aligned
- If intent is "work on project X", sites related to X are aligned
- If intent is "learn about Y", educational/related sites are aligned
- Generic sites (Google, Wikipedia) are often neutral unless clearly related
- Social media, news (unless research), shopping (unless project-related) are often off-intent

Return JSON only (no markdown, no backticks):
{
  "alignment": "aligned" | "neutral" | "off-intent",
  "confidence": 0.0-1.0,
  "reasoning": "Brief 1-sentence explanation"
}`;
}

function parseAlignmentResponse(text: string): IntentAlignmentResult | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1) {
    return null;
  }

  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as Partial<IntentAlignmentResult>;
    
    if (!parsed.alignment || !["aligned", "neutral", "off-intent"].includes(parsed.alignment)) {
      return null;
    }

    return {
      alignment: parsed.alignment as "aligned" | "neutral" | "off-intent",
      confidence: typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0.7,
      reasoning: parsed.reasoning || "",
    };
  } catch {
    return null;
  }
}

/**
 * Fallback rule-based alignment (current implementation)
 */
function fallbackAlignment(userIntent: string, domainInfo: DomainInfo): IntentAlignmentResult {
  const intentLower = userIntent.toLowerCase();
  
  // Simple keyword matching fallback
  if (intentLower.includes("relax") || intentLower.includes("break") || intentLower.includes("chill")) {
    return {
      alignment: domainInfo.type === "drift" ? "aligned" : domainInfo.type === "primary" ? "off-intent" : "neutral",
      confidence: 0.6,
      reasoning: "Rule-based classification (relax mode)",
    };
  }

  // Check if domain/URL contains intent keywords
  const intentWords = userIntent.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const domainText = `${domainInfo.domain} ${domainInfo.label} ${domainInfo.topUrls.join(" ")}`.toLowerCase();
  
  const matches = intentWords.filter(word => domainText.includes(word)).length;
  const matchRatio = intentWords.length > 0 ? matches / intentWords.length : 0;

  if (matchRatio > 0.3) {
    return {
      alignment: "aligned",
      confidence: Math.min(0.8, matchRatio),
      reasoning: `Domain matches ${Math.round(matchRatio * 100)}% of intent keywords`,
    };
  }

  // Default based on domain type
  if (domainInfo.type === "primary") {
    return {
      alignment: "aligned",
      confidence: 0.7,
      reasoning: "Primary workspace domain",
    };
  }

  if (domainInfo.type === "drift") {
    return {
      alignment: "off-intent",
      confidence: 0.6,
      reasoning: "Drift/entertainment domain",
    };
  }

  return {
    alignment: "neutral",
    confidence: 0.5,
    reasoning: "No clear alignment indicators",
  };
}

/**
 * Batch analyze multiple domains (with rate limiting)
 */
export async function analyzeDomainAlignments(
  userIntent: string,
  domains: DomainInfo[]
): Promise<Map<string, IntentAlignmentResult>> {
  const results = new Map<string, IntentAlignmentResult>();

  // Process domains sequentially to avoid rate limits
  for (const domain of domains) {
    const result = await analyzeIntentAlignment(userIntent, domain);
    results.set(domain.domain, result);
    
    // Small delay between requests
    if (domains.length > 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  return results;
}
