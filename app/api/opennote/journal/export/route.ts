import { corsHeaders, corsJson } from "@/app/api/cors";
import { supabaseAdmin } from "@/lib/supabase";
import { generateSessionMarkdown, importJournalToOpennote } from "@/lib/opennote";
import { getSafeDefaultAnalysis } from "@/lib/utils";

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

    // Fetch events from Supabase
    const { data: events, error: eventsError } = await supabaseAdmin
      .from('events')
      .select('*')
      .eq('session_id', sessionId)
      .order('ts', { ascending: true });

    if (eventsError) {
      console.error('Error fetching events:', eventsError);
      return corsJson({ error: eventsError.message }, { status: 500 });
    }

    // Fetch analysis (optional - use heuristic fallback if missing)
    const { data: analysis } = await supabaseAdmin
      .from('analysis')
      .select('summary_json')
      .eq('session_id', sessionId)
      .single();

    // Use analysis if available, otherwise use safe defaults
    const analysisData = analysis?.summary_json || getSafeDefaultAnalysis();

    // Generate markdown
    const sessionData = {
      session: {
        id: session.id,
        started_at: session.started_at,
        ended_at: session.ended_at,
        intent_text: session.intent_text
      },
      events: events || [],
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