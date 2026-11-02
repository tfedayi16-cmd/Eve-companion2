import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Upload, Check, Plus } from 'lucide-react-native';
import { EveAvatar } from '@/components/EveAvatar';
import { useCharacters } from '@/hooks/useCharacters';
import { useAuth } from '@/contexts/AuthContext';
import { pickAndUploadAvatar } from '@/lib/uploadAvatar';
import { theme } from '@/constants/theme';

const PRESET_TRAITS = [
  'Warm', 'Playful', 'Witty', 'Empathetic', 'Curious', 'Direct',
  'Calm', 'Encouraging', 'Thoughtful', 'Optimistic', 'Protective', 'Romantic',
];

function parseTraits(personality: string): string[] {
  return personality
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

export default function EditEveScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { activeCharacter, updateCharacter, reload } = useCharacters();

  const [name, setName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [traits, setTraits] = useState<string[]>([]);
  const [customTrait, setCustomTrait] = useState('');
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!activeCharacter) return;
    setName(activeCharacter.name);
    setAvatarUrl(activeCharacter.avatar_url);
    setTraits(parseTraits(activeCharacter.personality));
  }, [activeCharacter?.id]);

  const toggleTrait = (trait: string) => {
    setTraits((prev) =>
      prev.includes(trait) ? prev.filter((t) => t !== trait) : [...prev, trait],
    );
  };

  const addCustomTrait = () => {
    const trimmed = customTrait.trim();
    if (!trimmed) return;
    if (!traits.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      setTraits((prev) => [...prev, trimmed]);
    }
    setCustomTrait('');
  };

  const handlePickPhoto = async () => {
    if (!user) return;
    setError(null);
    setUploading(true);
    try {
      const url = await pickAndUploadAvatar(user.id);
      if (url) setAvatarUrl(url);
    } catch (err: any) {
      setError(err.message ?? 'Could not upload the photo.');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!activeCharacter) return;
    if (!name.trim()) {
      setError('Eve needs a name.');
      return;
    }
    if (traits.length === 0) {
      setError('Choose at least one personality trait.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await updateCharacter(activeCharacter.id, {
        name: name.trim(),
        avatar_url: avatarUrl,
        personality: traits.join(', '),
      });
      await reload();
      router.back();
    } catch (err: any) {
      setError(err.message ?? 'Could not save changes.');
    } finally {
      setSaving(false);
    }
  };

  const busy = saving || uploading;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <ChevronLeft size={24} color={theme.colors.neutral[0]} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Eve</Text>
        <View style={styles.backButton} />
      </View>

      {!activeCharacter ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.colors.primary[400]} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.photoSection}>
            <EveAvatar uri={avatarUrl} size={120} online={false} />
            <TouchableOpacity
              style={styles.photoButton}
              onPress={handlePickPhoto}
              disabled={busy}
              activeOpacity={0.8}
            >
              {uploading ? (
                <ActivityIndicator size="small" color={theme.colors.neutral[0]} />
              ) : (
                <Upload size={16} color={theme.colors.neutral[0]} strokeWidth={2} />
              )}
              <Text style={styles.photoButtonText}>{uploading ? 'Uploading...' : 'Upload new photo'}</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Name</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Eve"
            placeholderTextColor={theme.colors.neutral[600]}
            maxLength={40}
            editable={!busy}
          />

          <Text style={styles.label}>Personality traits</Text>
          <Text style={styles.hint}>Tap the traits that describe Eve. Selected traits shape how Eve talks to you.</Text>
          <View style={styles.chipWrap}>
            {PRESET_TRAITS.map((trait) => {
              const selected = traits.includes(trait);
              return (
                <TouchableOpacity
                  key={trait}
                  onPress={() => toggleTrait(trait)}
                  style={[styles.chip, selected && styles.chipSelected]}
                  activeOpacity={0.8}
                  disabled={busy}
                >
                  {selected && <Check size={14} color={theme.colors.neutral[950]} strokeWidth={2.5} />}
                  <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{trait}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.customRow}>
            <TextInput
              style={[styles.input, styles.customInput]}
              value={customTrait}
              onChangeText={setCustomTrait}
              onSubmitEditing={addCustomTrait}
              placeholder="Add your own trait"
              placeholderTextColor={theme.colors.neutral[600]}
              maxLength={30}
              editable={!busy}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={[styles.addButton, !customTrait.trim() && styles.addButtonDisabled]}
              onPress={addCustomTrait}
              disabled={!customTrait.trim() || busy}
              activeOpacity={0.8}
            >
              <Plus size={18} color={theme.colors.neutral[950]} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}

          <TouchableOpacity
            style={[styles.saveButton, busy && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={busy}
            activeOpacity={0.85}
          >
            {saving ? (
              <ActivityIndicator size="small" color={theme.colors.neutral[950]} />
            ) : (
              <Text style={styles.saveButtonText}>Save changes</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.neutral[950] },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
  },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: theme.fonts.semibold, fontSize: 18, color: theme.colors.neutral[0] },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
  photoSection: { alignItems: 'center', gap: theme.spacing.md, marginBottom: theme.spacing.lg },
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.neutral[800],
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.neutral[700],
  },
  photoButtonText: { fontFamily: theme.fonts.medium, fontSize: 14, color: theme.colors.neutral[0] },
  label: {
    fontFamily: theme.fonts.semibold,
    fontSize: 14,
    color: theme.colors.neutral[300],
    marginTop: theme.spacing.lg,
    marginBottom: theme.spacing.sm,
  },
  hint: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.neutral[500], marginBottom: theme.spacing.md, lineHeight: 20 },
  input: {
    fontFamily: theme.fonts.regular,
    fontSize: 16,
    color: theme.colors.neutral[0],
    backgroundColor: theme.colors.neutral[900],
    borderWidth: 1,
    borderColor: theme.colors.neutral[800],
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.neutral[700],
    backgroundColor: theme.colors.neutral[900],
  },
  chipSelected: { backgroundColor: theme.colors.primary[400], borderColor: theme.colors.primary[400] },
  chipText: { fontFamily: theme.fonts.medium, fontSize: 14, color: theme.colors.neutral[300] },
  chipTextSelected: { color: theme.colors.neutral[950] },
  customRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: theme.spacing.md },
  customInput: { flex: 1 },
  addButton: {
    width: 46,
    height: 46,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.primary[400],
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonDisabled: { opacity: 0.4 },
  errorText: { fontFamily: theme.fonts.medium, fontSize: 14, color: theme.colors.error[500], marginTop: theme.spacing.md },
  saveButton: {
    marginTop: theme.spacing.xl,
    backgroundColor: theme.colors.primary[400],
    borderRadius: theme.radius.full,
    paddingVertical: 15,
    alignItems: 'center',
  },
  saveButtonDisabled: { opacity: 0.6 },
  saveButtonText: { fontFamily: theme.fonts.semibold, fontSize: 16, color: theme.colors.neutral[950] },
});
