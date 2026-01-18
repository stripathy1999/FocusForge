import { corsHeaders, corsJson } from "@/app/api/cors";

// App Router route that proxies to backend Pages Router API route
// The backend route (backend/pages/api/opennote/journal/export.ts) uses Supabase
// to fetch session data from the database, making it work with the fully deployed backend

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return corsJson({ error: "Missing sessionId" }, { status: 400 });
    }

    // Determine backend URL for Pages Router API route
    // In production (same deployment), both App Router and Pages Router share the same host
    // If backend is deployed separately, use BACKEND_API_URL
    const backendUrl = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL;
    
    let fetchUrl: string;
    if (backendUrl) {
      // External backend deployment
      fetchUrl = `${backendUrl.replace(/\/$/, '')}/api/opennote/journal/export`;
    } else {
      // Same deployment - construct URL from request host
      // In Next.js, Pages Router API routes are accessible from App Router on the same host
      const url = new URL(request.url);
      const protocol = process.env.VERCEL_URL ? 'https' : url.protocol;
      const host = request.headers.get('host') || url.host;
      fetchUrl = `${protocol}//${host}/api/opennote/journal/export`;
    }

    try {
      const response = await fetch(fetchUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ sessionId }),
      });

      // Check if response is OK before parsing
      if (!response.ok) {
        let errorMessage = "Failed to export journal"
        const contentType = response.headers.get("content-type")
        
        if (contentType && contentType.includes("application/json")) {
          try {
            const errorData = await response.json()
            errorMessage = errorData.error || errorData.message || errorMessage
          } catch {
            errorMessage = await response.text() || errorMessage
          }
        } else {
          errorMessage = await response.text() || errorMessage
        }
        
        return corsJson(
          { error: errorMessage },
          { status: response.status }
        );
      }

      // Parse JSON only if response is OK
      const contentType = response.headers.get("content-type")
      if (!contentType || !contentType.includes("application/json")) {
        const text = await response.text()
        return corsJson(
          { error: `Expected JSON but got ${contentType || 'text/plain'}. Response: ${text.substring(0, 200)}` },
          { status: 500 }
        );
      }

      let data
      try {
        data = await response.json()
      } catch (parseError: any) {
        const text = await response.text()
        return corsJson(
          { error: `Failed to parse JSON response: ${parseError.message}. Response: ${text.substring(0, 200)}` },
          { status: 500 }
        );
      }

      return corsJson(data);
    } catch (fetchError: any) {
      // If fetch fails, it means backend route doesn't exist or isn't accessible
      return corsJson(
        { error: `Failed to reach backend: ${fetchError.message}. Make sure backend server is running or set BACKEND_API_URL.` },
        { status: 503 }
      );
    }
  } catch (error: any) {
    console.error("Opennote journal export error:", error);
    return corsJson(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}