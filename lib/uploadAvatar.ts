import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';

export async function pickAndUploadAvatar(userId: string): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });

  if (result.canceled || !result.assets?.[0]) return null;

  const blob = await (await fetch(result.assets[0].uri)).blob();
  const fileName = `${userId}/${Date.now()}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from('character-avatars')
    .upload(fileName, blob, { contentType: 'image/jpeg', upsert: true });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('character-avatars').getPublicUrl(fileName);
  return data.publicUrl;
}
