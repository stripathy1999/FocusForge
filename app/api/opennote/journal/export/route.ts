import { corsHeaders, corsJson } from "@/app/api/cors";
import { supabaseAdmin } from "@/lib/supabase";
import { generateSessionMarkdown, importJournalToOpennote } from "@/lib/opennote";
import { computeSummary } from "@/lib/grouping";
import type { Session, SessionStatus } from "@/lib/types";

function normalizeTimestamp(value: any): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? Date.now() : parsed;
  }
  return Date.now();
}

function parseIntentTags(rawIntent?: string | null): string[] {
  if (!rawIntent) return [];
  const trimmed = rawIntent.trim();
  if (!trimmed) return [];
  return trimmed
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 5);
}

function mapStatusFromDb(status?: string): SessionStatus {
  if (status === "running" || status === "active") {
    return "running";
  }
  if (status === "paused") {
    return "paused";
  }
  if (status === "auto_ended") {
    return "auto_ended";
  }
  if (status === "analyzed") {
    return "analyzed";
  }
  return "ended";
}

// App Router route that directly uses Supabase and Opennote API
// This avoids the fetch proxy issue and uses the database directly

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (parseError: any) {
      return corsJson({ error: "Invalid JSON in request body", details: parseError.message }, { status: 400 });
    }
    
    const { sessionId } = body;

    if (!sessionId || typeof sessionId !== 'string') {
      return corsJson({ error: "Missing or invalid sessionId" }, { status: 400 });
    }

    if (!supabaseAdmin) {
      const missingVars = [];
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missingVars.push('NEXT_PUBLIC_SUPABASE_URL');
      if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        missingVars.push('NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY');
      }
      
      console.error('Supabase not configured. Missing:', missingVars);
      return corsJson(
        { 
          error: "Supabase not configured. Missing environment variables: " + missingVars.join(', '),
          details: "Please set NEXT_PUBLIC_SUPABASE_URL and at least one key (NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY) in .env.local"
        },
        { status: 500 }
      );
    }

    // Fetch session data from Supabase
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError || !session) {
      console.error('Error fetching session:', sessionError);
      return corsJson({ error: 'Session not found' }, { status: 404 });
    }

    // Fetch events from Supabase (session_events is the source of truth)
    const { data: eventRows, error: eventsError } = await supabaseAdmin
      .from('session_events')
      .select('*')
      .eq('session_id', sessionId)
      .order('ts', { ascending: true });

    if (eventsError) {
      console.error('Error fetching events:', eventsError);
      return corsJson({ error: eventsError.message }, { status: 500 });
    }

    const eventsRaw = (eventRows || []).map((row: any) => {
      const tsMs = normalizeTimestamp(row.ts);
      return {
        sessionId: row.session_id,
        tsMs,
        tsIso: new Date(tsMs).toISOString(),
        type: row.type ?? "TAB_ACTIVE",
        url: row.url ?? "",
        title: row.title ?? "",
      };
    });

    // Fetch analysis (optional - use heuristic fallback if missing)
    const { data: analysis } = await supabaseAdmin
      .from('analysis')
      .select('summary_json')
      .eq('session_id', sessionId)
      .single();

    const intentRaw =
      session.intent_text ??
      session.goal ??
      session.intent_raw ??
      session.raw_context ??
      "";
    const intentTags = Array.isArray(session.intent_tags)
      ? session.intent_tags
      : parseIntentTags(intentRaw);
    const sessionForSummary: Session = {
      id: session.id,
      started_at: normalizeTimestamp(session.started_at),
      ended_at: session.ended_at ? normalizeTimestamp(session.ended_at) : undefined,
      status: mapStatusFromDb(session.status),
      intent_raw: intentRaw?.trim() || undefined,
      intent_tags: intentTags,
    };
    const eventsForSummary = eventsRaw.map((event) => ({
      sessionId: event.sessionId,
      ts: event.tsMs,
      type: event.type,
      url: event.url,
      title: event.title,
    }));
    const analysisSummary = analysis?.summary_json ?? undefined;
    const computedSummary = computeSummary(
      sessionForSummary,
      eventsForSummary,
      analysisSummary,
    );
    const alignment = {
      alignedSec: computedSummary.focus.alignedTimeSec,
      offIntentSec: computedSummary.focus.offIntentTimeSec,
      neutralSec: computedSummary.focus.neutralTimeSec,
      unknownSec: computedSummary.focus.unknownTimeSec,
    };
    const mostActiveWorkspace = computedSummary.domains[0]
      ? {
          label: computedSummary.domains[0].label,
          timeSec: computedSummary.domains[0].timeSec,
        }
      : undefined;
    const lastStopComputed = computedSummary.lastStop?.url
      ? {
          label:
            computedSummary.lastStop.title ||
            computedSummary.lastStop.label ||
            computedSummary.lastStop.url,
          url: computedSummary.lastStop.url,
        }
      : undefined;
    const analysisData = {
      ...(analysisSummary || {}),
      resumeSummary: computedSummary.resumeSummary,
      nextActions: computedSummary.nextActions,
      pendingDecisions: computedSummary.pendingDecisions,
      workspaces: computedSummary.domains.map((domain) => ({
        label: domain.label,
        timeSec: domain.timeSec,
        topUrls: domain.topUrls,
        topTitles: domain.topTitles,
      })),
      mostActiveWorkspace,
      topPages: computedSummary.topPages.map((page) => ({
        title: page.title,
        url: page.url,
        domain: page.domain,
      })),
      alignment,
      lastStop: lastStopComputed,
    };

    // Generate markdown
    const sessionData = {
      session: {
        id: session.id,
        started_at: session.started_at,
        ended_at: session.ended_at,
        intent_text: session.intent_text ?? session.goal ?? null
      },
      events: eventsRaw.map((event) => ({
        url: event.url,
        title: event.title,
        ts: event.tsIso,
      })),
      analysis: analysisData
    };

    const markdown = generateSessionMarkdown(sessionData);
    const title = `FocusForge — Session ${sessionId.slice(0, 8)}`;

    // Export to Opennote
    let journalResult;
    try {
      journalResult = await importJournalToOpennote(markdown, title);
    } catch (opennoteError: any) {
      console.error('Opennote export error:', opennoteError);
      return corsJson(
        {
          error: 'Failed to export to Opennote',
          details: opennoteError.message
        },
        { status: 500 }
      );
    }

    // Store export record (optional - log but don't fail)
    try {
      await supabaseAdmin
        .from('opennote_exports')
        .insert({
          session_id: sessionId,
          journal_id: journalResult.journalId,
          journal_url: journalResult.url || null
        });
    } catch (err) {
      // Log but don't fail - export succeeded
      console.error('Error storing export record:', err);
    }

    return corsJson({
      ok: true,
      journalId: journalResult.journalId,
      journalUrl: journalResult.url
    });
  } catch (error: any) {
    console.error("Opennote journal export error:", error);
    console.error("Error stack:", error.stack);
    return corsJson(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}