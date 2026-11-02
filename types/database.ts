export type Character = {
  id: string;
  user_id: string;
  name: string;
  avatar_url: string | null;
  gender: string;
  appearance: string | null;
  personality: string;
  conversation_style: string;
  voice: string;
  relationship: string;
  bio: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

export type Conversation = {
  id: string;
  user_id: string;
  character_id: string | null;
  title: string;
  created_at: string;
  updated_at: string;
};

export type Message = {
  id: string;
  conversation_id: string;
  role: 'user' | 'companion';
  content: string;
  image_url: string | null;
  created_at: string;
};

export type Memory = {
  id: string;
  user_id: string;
  character_id: string | null;
  content: string;
  category: string;
  created_at: string;
};

export type UserSettings = {
  id: string;
  user_id: string;
  adult_mode_enabled: boolean;
  age_verified: boolean;
  voice_enabled: boolean;
  notifications_enabled: boolean;
  dark_mode: boolean;
  preferred_voice: string;
  created_at: string;
  updated_at: string;
};
