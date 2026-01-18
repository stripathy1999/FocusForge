# AI-Powered Intent Alignment Agent

## Problem
The current intent alignment system uses rule-based heuristics (`alignmentForDomain` in `lib/grouping.ts`) which:
- Only handles simple cases (relax mode, content mode)
- Has hardcoded domain lists (PRIMARY_DOMAINS, DRIFT_DOMAINS)
- Can't understand semantic relationships between intent and websites
- Doesn't work well for custom or less common domains

## Solution: AI Agent for Intent Analysis

Created `lib/intent_analyzer.ts` - an AI agent that uses Gemini to analyze whether websites match user intent.

### Features

1. **Semantic Understanding**: AI understands meaning, not just keywords
   - Example: Intent "practice coding" + `leetcode.com` → aligned
   - Example: Intent "research quantum computing" + `arxiv.org` → aligned
   - Example: Intent "work on project" + `youtube.com` → off-intent (unless video tutorial)

2. **Context-Aware**: Analyzes domain, URLs, titles, and time spent together
   - Considers what the user is actually doing, not just domain name
   - Understands that YouTube can be aligned (learning) or off-intent (distraction)

3. **Confidence Scoring**: Returns confidence level (0-1) for each classification

4. **Reasoning**: Provides brief explanation for why a domain is aligned/neutral/off-intent

5. **Graceful Fallback**: Falls back to rule-based if AI unavailable

## Usage

### Basic Usage

```typescript
import { analyzeIntentAlignment } from '@/lib/intent_analyzer'

const result = await analyzeIntentAlignment(
  "practice LeetCode problems", // user intent
  {
    domain: "leetcode.com",
    label: "LeetCode",
    topUrls: ["leetcode.com/problems/two-sum"],
    timeSec: 1800,
    type: "primary"
  }
)

// Result:
// {
//   alignment: "aligned",
//   confidence: 0.95,
//   reasoning: "LeetCode directly supports coding practice intent"
// }
```

### Batch Analysis for All Domains

```typescript
import { analyzeDomainAlignments } from '@/lib/intent_analyzer'

const domains = [
  { domain: "leetcode.com", label: "LeetCode", topUrls: [...], timeSec: 1800 },
  { domain: "youtube.com", label: "YouTube", topUrls: [...], timeSec: 300 },
  // ...
]

const alignments = await analyzeDomainAlignments(
  userIntent,
  domains
)

// Returns Map<domain, IntentAlignmentResult>
```

## Integration with Existing Code

### Option 1: Replace `alignmentForDomain` (Recommended)

In `lib/grouping.ts`, modify `buildFocusSummary`:

```typescript
import { analyzeDomainAlignments } from '@/lib/intent_analyzer'

async function buildFocusSummaryWithAI(
  domains: DomainSummary[],
  intentTags: string[],
  breakTimeSec: number,
) {
  const userIntent = intentTags.join(" ")
  
  // Convert domains to DomainInfo format
  const domainInfos = domains.map(d => ({
    domain: d.domain,
    label: d.label,
    topUrls: d.topUrls,
    timeSec: d.timeSec,
    type: d.type
  }))
  
  // Get AI alignments
  const alignments = await analyzeDomainAlignments(userIntent, domainInfos)
  
  // Use AI results instead of rule-based
  const alignedTimeSec = domains
    .filter(d => alignments.get(d.domain)?.alignment === "aligned")
    .reduce((sum, d) => sum + d.timeSec, 0)
    
  // ... rest of logic
}
```

### Option 2: Hybrid Approach (AI + Rules)

Use AI for uncertain cases, keep rules for clear cases:

```typescript
function alignmentForDomainWithAI(
  intentTags: string[],
  domain: DomainSummary,
  aiResult?: IntentAlignmentResult
): "aligned" | "neutral" | "off-intent" {
  // Use AI result if high confidence
  if (aiResult && aiResult.confidence > 0.7) {
    return aiResult.alignment
  }
  
  // Fall back to rule-based for low confidence
  return alignmentForDomain(intentTags, domain)
}
```

### Option 3: Background Analysis (Non-blocking)

Analyze alignments in background, cache results:

```typescript
// Analyze alignments asynchronously, don't block UI
async function updateIntentAlignments(sessionId: string) {
  const session = await getSession(sessionId)
  const summary = computeSummary(session, events)
  
  const alignments = await analyzeDomainAlignments(
    session.intent_raw || "",
    summary.domains
  )
  
  // Store in cache/database for later use
  await storeAlignmentResults(sessionId, alignments)
}
```

## API Reference

### `analyzeIntentAlignment(userIntent, domainInfo)`

Analyzes a single domain's alignment with user intent.

**Parameters:**
- `userIntent: string` - User's stated intent/goal
- `domainInfo: DomainInfo` - Domain information (domain, label, URLs, time)

**Returns:** `Promise<IntentAlignmentResult>`
- `alignment: "aligned" | "neutral" | "off-intent"`
- `confidence: number` (0-1)
- `reasoning: string`

### `analyzeDomainAlignments(userIntent, domains)`

Batch analyzes multiple domains (with rate limiting).

**Returns:** `Promise<Map<string, IntentAlignmentResult>>`

## Performance Considerations

- **Rate Limiting**: Sequential processing with 100ms delay between requests
- **Caching**: Consider caching results per domain+intent combination
- **Fallback**: Automatic fallback to rule-based if API fails
- **Async**: Can be run in background, non-blocking

## Example Prompts Generated

For intent "practice coding interview questions":
```
User Intent: "practice coding interview questions"
Domain: leetcode.com
Sample URLs: leetcode.com/problems/two-sum, leetcode.com/problems/valid-parentheses
```

AI Response:
```json
{
  "alignment": "aligned",
  "confidence": 0.95,
  "reasoning": "LeetCode directly supports coding interview practice"
}
```

## Benefits Over Rule-Based System

1. **Semantic Understanding**: Understands meaning, not just domain lists
2. **Handles Edge Cases**: Works with custom domains, new websites
3. **Context-Aware**: Considers URLs, titles, not just domain
4. **Adaptive**: Can learn patterns from user behavior over time
5. **Transparent**: Provides reasoning for each classification

## Next Steps

1. Integrate into `buildFocusSummary` in `lib/grouping.ts`
2. Add caching layer for performance
3. Collect alignment data to improve over time
4. Add user feedback mechanism (thumbs up/down on alignments)
