const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const { text } = await req.json();
    if (typeof text !== 'string' || !text.trim() || text.length > 3000) {
      return json({ error: 'Text required (max 3000 characters).' }, 400);
    }
    const apiKey = Deno.env.get('ELEVENLABS_API_KEY');
    const voiceId = Deno.env.get('ELEVENLABS_VOICE_ID');
    if (!apiKey || !voiceId) return json({ error: 'ElevenLabs key or voice ID is not configured.' }, 503);
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
      body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2' }),
    });
    if (!response.ok) {
      console.error('ElevenLabs returned:', response.status, await response.text());
      return json({ error: `Voice provider returned ${response.status}.` }, 502);
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    // Convert in chunks to avoid exceeding argument limits for longer audio.
    let binary = '';
    for (let i = 0; i < bytes.length; i += 8192) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
    }
    return json({ audio_base64: btoa(binary), mime_type: 'audio/mpeg' });
  } catch (error) {
    console.error('AI voice error:', error);
    return json({ error: 'Could not generate voice.' }, 500);
  }
});
