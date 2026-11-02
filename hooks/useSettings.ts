import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { UserSettings } from '@/types/database';

export function useSettings() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .maybeSingle();

    if (error) {
      console.warn('Error loading settings:', error.message);
      setLoading(false);
      return;
    }

    if (!data) {
      await supabase.rpc('upsert_user_settings');
      const { data: newData } = await supabase
        .from('user_settings')
        .select('*')
        .maybeSingle();
      setSettings(newData as UserSettings | null);
    } else {
      setSettings(data as UserSettings);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateSettings = useCallback(async (updates: Partial<UserSettings>) => {
    const { data: session } = await supabase.auth.getSession();
    const userId = session?.session?.user?.id;
    if (!userId) {
      await load();
      return false;
    }

    const { data, error } = await supabase
      .from('user_settings')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .select()
      .maybeSingle();

    if (error || !data) {
      console.warn('Failed to save settings:', error?.message);
      await load();
      return false;
    }
    setSettings(data as UserSettings);
    return true;
  }, [load]);

  return { settings, loading, updateSettings, reload: load };
}
