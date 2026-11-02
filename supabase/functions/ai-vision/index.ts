import { createClient } from "npm:@supabase/supabase-js@2.58.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const VISION_MODEL = "qwen/qwen3.8-27b";

async function getGroqKey(): Promise<string> {
  const envKey = Deno.env.get("GROQ_API_KEY");
  if (envKey) return envKey;
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data, error } = await adminClient.rpc("get_secret", { secret_name: "GROQ_API_KEY" });
  if (error || !data) return "";
  return data as string;
}

interface VisionRequest {
  image_url: string;
  question: string;
  character_name: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body: VisionRequest = await req.json();

    const GROQ_API_KEY = await getGroqKey();

    if (!GROQ_API_KEY) {
      return new Response(
        JSON.stringify({
          error: "GROQ_API_KEY is not configured.",
          reply: "I can't see images yet — my vision service needs to be configured with a Groq API key.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { image_url, question, character_name } = body;

    const response = await fetch(GROQ_CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: VISION_MODEL,
        messages: [
          {
            role: "system",
            content: `You are ${character_name}, a personal AI companion. The user has shared a photo with you. Describe what you see naturally and respond to their question. Be warm and conversational. Keep it to 2-4 sentences.`,
          },
          {
            role: "user",
            content: [
              { type: "text", text: question || "What do you think of this photo?" },
              { type: "image_url", image_url: { url: image_url } },
            ],
          },
        ],
        max_tokens: 1024,
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("Groq vision error:", errText);
      return new Response(
        JSON.stringify({
          error: "Vision service error",
          reply: "I couldn't quite make out that photo. Could you try sending it again?",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content ?? "I can see the photo but I'm not sure what to say about it.";

    return new Response(
      JSON.stringify({ reply }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Vision edge function error:", err);
    return new Response(
      JSON.stringify({
        error: err.message,
        reply: "Something went wrong while looking at your photo. Please try again.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
