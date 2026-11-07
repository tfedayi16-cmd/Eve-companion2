import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

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
    const { prompt, character_name } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return jsonResponse({ error: "Missing 'prompt' field.", image_url: null, message: "No prompt provided." });
    }

    // Build a descriptive prompt for the image model
    const styledPrompt = character_name
      ? `${prompt}, portrait of ${character_name}, cinematic lighting, high quality, detailed`
      : `${prompt}, cinematic lighting, high quality, detailed`;

    const encodedPrompt = encodeURIComponent(styledPrompt.slice(0, 500));
    const seed = Math.floor(Math.random() * 1000000);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=512&height=512&seed=${seed}&nologo=true`;

    // Fetch the generated image
    const imageResponse = await fetch(imageUrl, { method: "GET" });
    if (!imageResponse.ok) {
      return jsonResponse({
        error: `Image generation failed (${imageResponse.status})`,
        image_url: null,
        message: "The image service was unavailable. Please try again.",
      });
    }

    const imageBuffer = new Uint8Array(await imageResponse.arrayBuffer());

    // Upload to Supabase storage so the image persists
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const fileName = `generated/${Date.now()}_${seed}.jpg`;
    const { data: uploadData, error: uploadError } = await adminClient.storage
      .from("character-avatars")
      .upload(fileName, imageBuffer, { contentType: "image/jpeg" });

    if (uploadError || !uploadData) {
      // Fall back to the direct Pollinations URL
      return jsonResponse({
        image_url: imageUrl,
        message: "Image generated.",
      });
    }

    const { data: urlData } = adminClient.storage
      .from("character-avatars")
      .getPublicUrl(fileName);

    return jsonResponse({
      image_url: urlData.publicUrl,
      message: "Image generated.",
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
