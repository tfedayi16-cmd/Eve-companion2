import { supabase, EDGE_FUNCTION_BASE } from '@/lib/supabase';
import type { Character, Memory } from '@/types/database';

type HistoryMessage = { role: string; content: string; image_url?: string };

export async function getAIReply(
  messages: HistoryMessage[],
  character: Character,
  memories: Memory[],
  adultMode: boolean,
): Promise<{ reply: string; memory: string | null }> {
  const { data: session } = await supabase.auth.getSession();
  const token = session?.session?.access_token ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  const response = await fetch(`${EDGE_FUNCTION_BASE}/ai-chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
    },
    body: JSON.stringify({
      messages: messages.map((m) => ({ role: m.role, content: m.content, image_url: m.image_url })),
      character: {
        name: character.name,
        personality: character.personality,
        conversation_style: character.conversation_style,
        bio: character.bio,
        relationship: character.relationship,
      },
      memories: memories.map((m) => m.content).slice(-15),
      adult_mode: adultMode,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI chat request failed (${response.status})`);
  }

  const data = await response.json();
  return { reply: data.reply ?? 'I had trouble responding just now.', memory: data.memory ?? null };
}

export async function getVisionReply(
  imageUrl: string,
  question: string,
  characterName: string,
): Promise<string> {
  const { data: session } = await supabase.auth.getSession();
  const token = session?.session?.access_token;

  const response = await fetch(`${EDGE_FUNCTION_BASE}/ai-vision`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
    },
    body: JSON.stringify({ image_url: imageUrl, question, character_name: characterName }),
  });

  if (!response.ok) throw new Error(`Vision request failed (${response.status})`);
  const data = await response.json();
  return data.reply ?? "I couldn't quite see that photo.";
}

export async function generateImage(
  prompt: string,
  characterName?: string,
): Promise<{ imageUrl: string | null; message: string }> {
  const { data: session } = await supabase.auth.getSession();
  const token = session?.session?.access_token;

  const response = await fetch(`${EDGE_FUNCTION_BASE}/ai-image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
    },
    body: JSON.stringify({ prompt, character_name: characterName }),
  });

  if (!response.ok) throw new Error(`Image gen request failed (${response.status})`);
  const data = await response.json();
  return { imageUrl: data.image_url ?? null, message: data.message ?? 'Image generated.' };
}

export async function synthesizeSpeech(text: string, voiceId?: string): Promise<{ audio: string; format: string }> {
  const { data: session } = await supabase.auth.getSession();
  const token = session?.session?.access_token;

  const response = await fetch(`${EDGE_FUNCTION_BASE}/eleven-tts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
    },
    body: JSON.stringify({ text, voice_id: voiceId }),
  });

  if (!response.ok) throw new Error(`TTS request failed (${response.status})`);
  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return { audio: data.audio, format: data.format ?? 'mp3' };
}
