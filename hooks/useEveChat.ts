import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { getAIReply, getVisionReply } from '@/lib/ai';
import type { Character, Message, Memory } from '@/types/database';

export type ChatMessage = {
  id: string;
  role: 'user' | 'companion';
  text: string;
  timestamp: number;
  image_url?: string | null;
};

type Options = {
  character: Character | null;
  adultMode: boolean;
  conversationId: string | null;
  onConversationCreated?: (id: string) => void;
};

const STARTER_MESSAGE = (name: string): ChatMessage => ({
  id: 'starter-1',
  role: 'companion',
  text: `Hi, I'm ${name}! I'm so glad you're here. What's on your mind today?`,
  timestamp: Date.now() - 1000 * 60 * 5,
});

function uid(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function useEveChat({ character, adultMode, conversationId, onConversationCreated }: Options) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const memoriesRef = useRef<Memory[]>([]);
  const locallyCreatedIdRef = useRef<string | null>(null);

  // Load messages when conversation changes
  useEffect(() => {
    if (!conversationId) {
      setLoading(false);
      if (character) {
        setMessages([STARTER_MESSAGE(character.name)]);
      }
      return;
    }
    if (conversationId === locallyCreatedIdRef.current) {
      setLoading(false);
      return;
    }

    setLoading(true);
    (async () => {
      const { data: msgs, error: msgErr } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (msgErr) {
        setError('Failed to load conversation.');
        setLoading(false);
        return;
      }

      const loaded: ChatMessage[] = (msgs ?? []).map((m: Message) => ({
        id: m.id,
        role: m.role === 'user' ? 'user' : 'companion',
        text: m.content,
        timestamp: new Date(m.created_at).getTime(),
        image_url: m.image_url,
      }));
      setMessages(loaded.length > 0 ? loaded : (character ? [STARTER_MESSAGE(character.name)] : []));
      setLoading(false);
    })();
  }, [conversationId, character]);

  // Load memories
  useEffect(() => {
    if (!character) return;
    (async () => {
      const { data } = await supabase
        .from('memories')
        .select('*')
        .or(`character_id.is.null,character_id.eq.${character.id}`)
        .order('created_at', { ascending: false })
        .limit(20);
      memoriesRef.current = (data ?? []) as Memory[];
    })();
  }, [character]);

  const ensureConversation = useCallback(async (): Promise<string | null> => {
    if (conversationId) return conversationId;
    if (!character) return null;

    const { data, error } = await supabase
      .from('conversations')
      .insert({
        character_id: character.id,
        title: `Chat with ${character.name}`,
      })
      .select()
      .single();

    if (error || !data) {
      console.warn('Failed to create conversation:', error?.message);
      return null;
    }

    locallyCreatedIdRef.current = data.id;
    onConversationCreated?.(data.id);
    return data.id;
  }, [conversationId, character, onConversationCreated]);

  const sendMessage = useCallback(
    async (text: string, imageUrl?: string | null) => {
      const trimmed = text.trim();
      if (!trimmed && !imageUrl) return;
      if (!character) return;

      const userMsg: ChatMessage = {
        id: uid(),
        role: 'user',
        text: trimmed,
        timestamp: Date.now(),
        image_url: imageUrl ?? null,
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsTyping(true);
      setError(null);

      try {
        const convId = await ensureConversation();
        if (!convId) {
          setError('Could not start conversation.');
          setIsTyping(false);
          return;
        }

        // Persist user message
        await supabase.from('messages').insert({
          conversation_id: convId,
          role: 'user',
          content: trimmed,
          image_url: imageUrl ?? null,
        });

        // Update conversation timestamp
        await supabase
          .from('conversations')
          .update({ updated_at: new Date().toISOString() })
          .eq('id', convId);

        let reply: string;

        if (imageUrl) {
          // Vision path
          reply = await getVisionReply(imageUrl, trimmed || 'What do you think of this?', character.name);
        } else {
          // Text chat path
          const history = [...messages, userMsg].map((m) => ({
            role: m.role,
            content: m.text,
          }));

          const result = await getAIReply(history, character, memoriesRef.current, adultMode);
          reply = result.reply;

          // Save extracted memory
          if (result.memory) {
            const { data: memData } = await supabase
              .from('memories')
              .insert({
                character_id: character.id,
                content: result.memory,
                category: 'auto',
              })
              .select()
              .single();
            if (memData) {
              memoriesRef.current = [memData as Memory, ...memoriesRef.current].slice(0, 20);
            }
          }
        }

        const companionMsg: ChatMessage = {
          id: uid(),
          role: 'companion',
          text: reply,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, companionMsg]);
        setIsTyping(false);

        // Persist companion message
        await supabase.from('messages').insert({
          conversation_id: convId,
          role: 'companion',
          content: reply,
        });
      } catch (err: any) {
        console.error('Chat error:', err);
        setError(err.message ?? 'Something went wrong.');
        setIsTyping(false);
        setMessages((prev) => [
          ...prev,
          {
            id: uid(),
            role: 'companion',
            text: 'I had trouble responding just now. Please try again.',
            timestamp: Date.now(),
          },
        ]);
      }
    },
    [character, adultMode, messages, ensureConversation],
  );

  const sendGeneratedImage = useCallback(
    async (prompt: string, imageUrl: string, caption: string) => {
      if (!character) return;

      const userText = `Create an image: ${prompt}`;
      const now = Date.now();
      setMessages((prev) => [
        ...prev,
        { id: uid(), role: 'user', text: userText, timestamp: now, image_url: null },
        { id: uid(), role: 'companion', text: caption, timestamp: now, image_url: imageUrl },
      ]);
      setError(null);

      try {
        const convId = await ensureConversation();
        if (!convId) {
          setError('Could not start conversation.');
          return;
        }

        const { error: insertError } = await supabase.from('messages').insert([
          { conversation_id: convId, role: 'user', content: userText, image_url: null },
          { conversation_id: convId, role: 'companion', content: caption, image_url: imageUrl },
        ]);
        if (insertError) throw insertError;
      } catch (err: any) {
        console.error('Save generated image error:', err);
        setError(err.message ?? 'Could not save the image to this conversation.');
      }
    },
    [character, ensureConversation],
  );

  const clearMessages = useCallback(async () => {
    if (!conversationId) {
      if (character) setMessages([STARTER_MESSAGE(character.name)]);
      return;
    }

    await supabase.from('messages').delete().eq('conversation_id', conversationId);
    if (character) setMessages([STARTER_MESSAGE(character.name)]);
  }, [conversationId, character]);

  return { messages, isTyping, loading, error, sendMessage, sendGeneratedImage, clearMessages };
}
