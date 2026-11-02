const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function jsonResponse(body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    return jsonResponse({
      error: "Image generation is not available with the Groq free-tier provider.",
      image_url: null,
      message: "Image generation isn't supported on the current AI provider. You can still upload a photo from your device instead.",
    });
  } catch (err) {
    console.error("Image gen edge function error:", err);
    return jsonResponse({
      error: err.message,
      image_url: null,
      message: "Something went wrong generating the image.",
    });
  }
});
