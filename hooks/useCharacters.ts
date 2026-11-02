import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { Character } from '@/types/database';

export function useCharacters() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCharacterId, setActiveCharacterId] = useState<string | null>(null);

  const loadCharacters = useCallback(async () => {
    const { data, error } = await supabase
      .from('characters')
      .select('*')
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('Error loading characters:', error.message);
      setLoading(false);
      return;
    }

    setCharacters(data ?? []);
    if (data && data.length > 0 && !activeCharacterId) {
      const stored = localStorage.getItem('activeCharacterId');
      const found = stored ? data.find((c) => c.id === stored) : null;
      const id = found?.id ?? data[0].id;
      setActiveCharacterId(id);
      localStorage.setItem('activeCharacterId', id);
    }
    setLoading(false);
  }, [activeCharacterId]);

  useEffect(() => {
    loadCharacters();
  }, [loadCharacters]);

  const selectCharacter = useCallback((id: string) => {
    setActiveCharacterId(id);
    localStorage.setItem('activeCharacterId', id);
  }, []);

  const createCharacter = useCallback(async (char: Omit<Character, 'id' | 'user_id' | 'created_at' | 'updated_at' | 'is_default'>) => {
    const { data, error } = await supabase
      .from('characters')
      .insert({ ...char, is_default: false })
      .select()
      .single();

    if (error) throw error;
    await loadCharacters();
    return data as Character;
  }, [loadCharacters]);

  const updateCharacter = useCallback(async (id: string, updates: Partial<Character>) => {
    const { data, error } = await supabase
      .from('characters')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    await loadCharacters();
    return data as Character;
  }, [loadCharacters]);

  const deleteCharacter = useCallback(async (id: string) => {
    const { error } = await supabase.from('characters').delete().eq('id', id);
    if (error) throw error;
    await loadCharacters();
  }, [loadCharacters]);

  const activeCharacter = characters.find((c) => c.id === activeCharacterId) ?? null;

  return {
    characters,
    loading,
    activeCharacter,
    activeCharacterId,
    selectCharacter,
    createCharacter,
    updateCharacter,
    deleteCharacter,
    reload: loadCharacters,
  };
}
