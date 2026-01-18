import { corsHeaders, corsJson } from "@/app/api/cors";

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

    // Check if backend is separate or same deployment
    const backendUrl = process.env.BACKEND_API_URL || process.env.NEXT_PUBLIC_BACKEND_URL;
    
    let fetchUrl: string;
    if (backendUrl) {
      // External backend
      fetchUrl = `${backendUrl}/api/opennote/practice/create`;
    } else {
      // Same deployment - construct absolute URL from request
      const url = new URL(request.url);
      const protocol = url.protocol;
      const host = url.host;
      fetchUrl = `${protocol}//${host}/api/opennote/practice/create`;
    }

    let response;
    try {
      response = await fetch(fetchUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sessionId }),
      });
    } catch (fetchError: any) {
      // If fetch fails, it means backend route doesn't exist or isn't accessible
      return corsJson(
        { error: `Failed to reach backend: ${fetchError.message}. Make sure backend server is running or set BACKEND_API_URL.` },
        { status: 503 }
      );
    }

    // Check if response is OK before parsing
    if (!response.ok) {
      let errorMessage = "Failed to create practice set"
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
  } catch (error: any) {
    console.error("Opennote practice creation error:", error);
    return corsJson(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
