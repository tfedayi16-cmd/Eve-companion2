/*
# Eve Companion Platform — Core Schema
Creates: characters, conversations, messages, memories, user_settings.
All owner-scoped via RLS. Storage bucket for avatars. Helper functions for signup.
*/

-- CHARACTERS
CREATE TABLE IF NOT EXISTS characters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Eve',
  avatar_url text,
  gender text DEFAULT 'female',
  appearance text,
  personality text DEFAULT 'warm, caring, empathetic, curious',
  conversation_style text DEFAULT 'casual, supportive, engaging',
  voice text DEFAULT 'alloy',
  relationship text DEFAULT 'companion',
  bio text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_own_characters ON characters;
CREATE POLICY select_own_characters ON characters FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS insert_own_characters ON characters;
CREATE POLICY insert_own_characters ON characters FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS update_own_characters ON characters;
CREATE POLICY update_own_characters ON characters FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS delete_own_characters ON characters;
CREATE POLICY delete_own_characters ON characters FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- CONVERSATIONS
CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  character_id uuid REFERENCES characters(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT 'New Conversation',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_own_conversations ON conversations;
CREATE POLICY select_own_conversations ON conversations FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS insert_own_conversations ON conversations;
CREATE POLICY insert_own_conversations ON conversations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS update_own_conversations ON conversations;
CREATE POLICY update_own_conversations ON conversations FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS delete_own_conversations ON conversations;
CREATE POLICY delete_own_conversations ON conversations FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- MESSAGES
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'companion')),
  content text NOT NULL DEFAULT '',
  image_url text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_own_messages ON messages;
CREATE POLICY select_own_messages ON messages FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM conversations WHERE conversations.id = messages.conversation_id AND conversations.user_id = auth.uid()));
DROP POLICY IF EXISTS insert_own_messages ON messages;
CREATE POLICY insert_own_messages ON messages FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM conversations WHERE conversations.id = messages.conversation_id AND conversations.user_id = auth.uid()));
DROP POLICY IF EXISTS delete_own_messages ON messages;
CREATE POLICY delete_own_messages ON messages FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM conversations WHERE conversations.id = messages.conversation_id AND conversations.user_id = auth.uid()));

-- MEMORIES
CREATE TABLE IF NOT EXISTS memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  character_id uuid REFERENCES characters(id) ON DELETE CASCADE,
  content text NOT NULL,
  category text DEFAULT 'general',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(user_id);
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_own_memories ON memories;
CREATE POLICY select_own_memories ON memories FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS insert_own_memories ON memories;
CREATE POLICY insert_own_memories ON memories FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS delete_own_memories ON memories;
CREATE POLICY delete_own_memories ON memories FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- USER SETTINGS
CREATE TABLE IF NOT EXISTS user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  adult_mode_enabled boolean NOT NULL DEFAULT false,
  age_verified boolean NOT NULL DEFAULT false,
  voice_enabled boolean NOT NULL DEFAULT true,
  notifications_enabled boolean NOT NULL DEFAULT true,
  dark_mode boolean NOT NULL DEFAULT true,
  preferred_voice text NOT NULL DEFAULT 'alloy',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_settings_user ON user_settings(user_id);
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS select_own_settings ON user_settings;
CREATE POLICY select_own_settings ON user_settings FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS insert_own_settings ON user_settings;
CREATE POLICY insert_own_settings ON user_settings FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS update_own_settings ON user_settings;
CREATE POLICY update_own_settings ON user_settings FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- STORAGE BUCKET
INSERT INTO storage.buckets (id, name, public)
SELECT 'character-avatars', 'character-avatars', true
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'character-avatars');

DROP POLICY IF EXISTS select_avatar_uploads ON storage.objects;
CREATE POLICY select_avatar_uploads ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'character-avatars');
DROP POLICY IF EXISTS insert_avatar_uploads ON storage.objects;
CREATE POLICY insert_avatar_uploads ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'character-avatars');
DROP POLICY IF EXISTS update_avatar_uploads ON storage.objects;
CREATE POLICY update_avatar_uploads ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'character-avatars') WITH CHECK (bucket_id = 'character-avatars');
DROP POLICY IF EXISTS delete_avatar_uploads ON storage.objects;
CREATE POLICY delete_avatar_uploads ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'character-avatars');

-- HELPER: create default character for new user
CREATE OR REPLACE FUNCTION create_default_character_for_user()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE new_char_id uuid;
BEGIN
  INSERT INTO characters (user_id, name, gender, personality, conversation_style, voice, relationship, bio, is_default)
  VALUES (
    auth.uid(), 'Eve', 'female',
    'warm, caring, empathetic, curious, emotionally intelligent, playful',
    'casual, supportive, engaging, asks thoughtful follow-up questions',
    'alloy', 'companion',
    'Eve is a warm and caring AI companion who loves getting to know you. She remembers what you share, asks thoughtful questions, and is always here to listen.',
    true
  )
  RETURNING id INTO new_char_id;
  RETURN new_char_id;
END;
$$;
GRANT EXECUTE ON FUNCTION create_default_character_for_user() TO authenticated;

-- HELPER: ensure settings row exists
CREATE OR REPLACE FUNCTION upsert_user_settings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_settings (user_id) VALUES (auth.uid()) ON CONFLICT (user_id) DO NOTHING;
END;
$$;
GRANT EXECUTE ON FUNCTION upsert_user_settings() TO authenticated;
