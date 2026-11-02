import { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import {
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Upload,
  User,
  ChevronDown,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { EveAvatar } from '@/components/EveAvatar';
import { useCharacters } from '@/hooks/useCharacters';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { theme } from '@/constants/theme';
import { EVE_AVATAR_URI } from '@/assets/images';
import type { Character } from '@/types/database';

const VOICES = [
  { label: 'Alloy (warm)', value: 'alloy' },
  { label: 'Echo (calm)', value: 'echo' },
  { label: 'Fable (expressive)', value: 'fable' },
  { label: 'Onyx (deep)', value: 'onyx' },
  { label: 'Nova (bright)', value: 'nova' },
  { label: 'Shimmer (soft)', value: 'shimmer' },
];

const GENDERS = ['female', 'male', 'non-binary', 'other'];
const RELATIONSHIPS = ['companion', 'friend', 'partner', 'mentor', 'custom'];

type FormState = {
  name: string;
  avatar_url: string | null;
  gender: string;
  appearance: string;
  personality: string;
  conversation_style: string;
  voice: string;
  relationship: string;
  bio: string;
};

const EMPTY_FORM: FormState = {
  name: '',
  avatar_url: null,
  gender: 'female',
  appearance: '',
  personality: 'warm, caring, empathetic, curious',
  conversation_style: 'casual, supportive, engaging',
  voice: 'alloy',
  relationship: 'companion',
  bio: '',
};

export default function CharactersScreen() {
  const { characters, loading, activeCharacterId, selectCharacter, createCharacter, updateCharacter, deleteCharacter, reload } = useCharacters();
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (char: Character) => {
    setForm({
      name: char.name,
      avatar_url: char.avatar_url,
      gender: char.gender,
      appearance: char.appearance ?? '',
      personality: char.personality,
      conversation_style: char.conversation_style,
      voice: char.voice,
      relationship: char.relationship,
      bio: char.bio ?? '',
    });
    setEditingId(char.id);
    setShowForm(true);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]) return;

    setUploading(true);
    try {
      const asset = result.assets[0];
      const fileUri = asset.uri;
      const fileName = `${user?.id}/${Date.now()}.jpg`;

      let fileBody: Blob | ArrayBuffer;
      if (Platform.OS === 'web') {
        const res = await fetch(fileUri);
        fileBody = await res.blob();
      } else {
        fileBody = await (await fetch(fileUri)).blob();
      }

      const { error: uploadError } = await supabase.storage
        .from('character-avatars')
        .upload(fileName, fileBody, { contentType: 'image/jpeg', upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('character-avatars')
        .getPublicUrl(fileName);

      setForm((f) => ({ ...f, avatar_url: urlData.publicUrl }));
    } catch (err: any) {
      Alert.alert('Upload failed', err.message ?? 'Could not upload image.');
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      Alert.alert('Name required', 'Please give your companion a name.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        avatar_url: form.avatar_url,
        gender: form.gender,
        appearance: form.appearance.trim() || null,
        personality: form.personality.trim(),
        conversation_style: form.conversation_style.trim(),
        voice: form.voice,
        relationship: form.relationship,
        bio: form.bio.trim() || null,
      };

      if (editingId) {
        await updateCharacter(editingId, payload);
      } else {
        await createCharacter(payload);
      }
      setShowForm(false);
      await reload();
    } catch (err: any) {
      Alert.alert('Save failed', err.message ?? 'Could not save character.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (char: Character) => {
    if (char.is_default) {
      Alert.alert('Cannot delete', 'The default Eve character cannot be removed.');
      return;
    }
    Alert.alert(
      `Delete ${char.name}?`,
      'This will permanently remove this companion and all their conversations.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCharacter(char.id);
            } catch (err: any) {
              Alert.alert('Delete failed', err.message);
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={theme.colors.primary[400]} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.pageTitle}>Your Companions</Text>
        <Text style={styles.pageSubtitle}>Choose who you want to talk with</Text>

        <View style={styles.grid}>
          {characters.map((char) => (
            <View
              key={char.id}
              style={[
                styles.charCard,
                activeCharacterId === char.id && styles.charCardActive,
              ]}
            >
              <TouchableOpacity
                style={styles.charCardTap}
                onPress={() => selectCharacter(char.id)}
                activeOpacity={0.7}
              >
                <EveAvatar uri={char.avatar_url} size={72} online={false} />
                <Text style={styles.charName} numberOfLines={1}>{char.name}</Text>
                <Text style={styles.charRel} numberOfLines={1}>{char.relationship}</Text>
                {activeCharacterId === char.id && (
                  <View style={styles.activeBadge}>
                    <Check size={11} color={theme.colors.neutral[0]} strokeWidth={3} />
                    <Text style={styles.activeBadgeText}>Active</Text>
                  </View>
                )}
              </TouchableOpacity>
              <View style={styles.charActions}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => openEdit(char)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Pencil size={15} color={theme.colors.neutral[400]} strokeWidth={2} />
                </TouchableOpacity>
                {!char.is_default && (
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleDelete(char)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Trash2 size={15} color={theme.colors.error[500]} strokeWidth={2} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}

          {/* Create new card */}
          <TouchableOpacity style={styles.createCard} onPress={openCreate} activeOpacity={0.7}>
            <View style={styles.createIconWrap}>
              <Plus size={28} color={theme.colors.primary[400]} strokeWidth={2} />
            </View>
            <Text style={styles.createText}>New Companion</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Character form modal */}
      <Modal visible={showForm} animationType="slide" transparent={false} onRequestClose={() => setShowForm(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowForm(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <X size={24} color={theme.colors.neutral[300]} strokeWidth={2} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{editingId ? 'Edit Companion' : 'Create Companion'}</Text>
            <View style={{ width: 24 }} />
          </View>

          <ScrollView contentContainerStyle={styles.formScroll} keyboardShouldPersistTaps="handled">
            {/* Avatar picker */}
            <TouchableOpacity style={styles.avatarPicker} onPress={pickImage} activeOpacity={0.8}>
              <EveAvatar uri={form.avatar_url} size={96} online={false} />
              <View style={styles.avatarPickerBadge}>
                {uploading ? (
                  <ActivityIndicator size="small" color={theme.colors.neutral[0]} />
                ) : (
                  <Upload size={16} color={theme.colors.neutral[0]} strokeWidth={2} />
                )}
              </View>
            </TouchableOpacity>
            <Text style={styles.helperText}>Tap to upload a photo</Text>

            <FormField label="Name">
              <TextInput
                style={styles.textInput}
                value={form.name}
                onChangeText={(v) => setForm({ ...form, name: v })}
                placeholder="e.g. Eve, Luna, Atlas…"
                placeholderTextColor={theme.colors.neutral[500]}
              />
            </FormField>

            <FormField label="Gender">
              <PickerRow
                options={GENDERS}
                value={form.gender}
                onChange={(v) => setForm({ ...form, gender: v })}
              />
            </FormField>

            <FormField label="Relationship">
              <PickerRow
                options={RELATIONSHIPS}
                value={form.relationship}
                onChange={(v) => setForm({ ...form, relationship: v })}
              />
            </FormField>

            <FormField label="Personality">
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={form.personality}
                onChangeText={(v) => setForm({ ...form, personality: v })}
                placeholder="warm, caring, empathetic…"
                placeholderTextColor={theme.colors.neutral[500]}
                multiline
                numberOfLines={3}
              />
            </FormField>

            <FormField label="Conversation style">
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={form.conversation_style}
                onChangeText={(v) => setForm({ ...form, conversation_style: v })}
                placeholder="casual, supportive, witty…"
                placeholderTextColor={theme.colors.neutral[500]}
                multiline
                numberOfLines={3}
              />
            </FormField>

            <FormField label="Appearance">
              <TextInput
                style={[styles.textInput, styles.textArea]}
                value={form.appearance}
                onChangeText={(v) => setForm({ ...form, appearance: v })}
                placeholder="Describe how they look…"
                placeholderTextColor={theme.colors.neutral[500]}
                multiline
                numberOfLines={2}
              />
            </FormField>

            <FormField label="Voice">
              <PickerRow
                options={VOICES.map((v) => v.value)}
                labels={VOICES.map((v) => v.label)}
                value={form.voice}
                onChange={(v) => setForm({ ...form, voice: v })}
              />
            </FormField>

            <FormField label="Biography">
              <TextInput
                style={[styles.textInput, styles.textArea, styles.bioArea]}
                value={form.bio}
                onChangeText={(v) => setForm({ ...form, bio: v })}
                placeholder="Tell their story — who they are, where they're from, what they love…"
                placeholderTextColor={theme.colors.neutral[500]}
                multiline
                numberOfLines={4}
              />
            </FormField>

            <TouchableOpacity
              style={[styles.saveButton, saving && styles.saveButtonBusy]}
              onPress={handleSave}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator color={theme.colors.neutral[0]} size="small" />
              ) : (
                <Text style={styles.saveText}>{editingId ? 'Save Changes' : 'Create Companion'}</Text>
              )}
            </TouchableOpacity>

            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function PickerRow({
  options,
  value,
  onChange,
  labels,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  labels?: string[];
}) {
  const [open, setOpen] = useState(false);
  const currentLabel = labels?.[options.indexOf(value)] ?? value;

  return (
    <View>
      <TouchableOpacity
        style={styles.pickerBtn}
        onPress={() => setOpen((o) => !o)}
        activeOpacity={0.7}
      >
        <Text style={styles.pickerBtnText}>{currentLabel}</Text>
        <ChevronDown size={18} color={theme.colors.neutral[400]} strokeWidth={2} />
      </TouchableOpacity>
      {open && (
        <View style={styles.pickerDropdown}>
          {options.map((opt, i) => (
            <TouchableOpacity
              key={opt}
              style={[styles.pickerOption, opt === value && styles.pickerOptionActive]}
              onPress={() => {
                onChange(opt);
                setOpen(false);
              }}
            >
              <Text style={[styles.pickerOptionText, opt === value && styles.pickerOptionTextActive]}>
                {labels?.[i] ?? opt}
              </Text>
              {opt === value && <Check size={16} color={theme.colors.primary[400]} strokeWidth={2} />}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.neutral[950] },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.lg, paddingBottom: theme.spacing.xxl },
  pageTitle: { fontFamily: theme.fonts.bold, fontSize: 26, color: theme.colors.neutral[0] },
  pageSubtitle: { fontFamily: theme.fonts.regular, fontSize: 15, color: theme.colors.neutral[400], marginTop: 4, marginBottom: theme.spacing.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.md },
  charCard: {
    width: 140,
    backgroundColor: theme.colors.neutral[900],
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: theme.colors.neutral[800],
    position: 'relative',
  },
  charCardActive: { borderColor: theme.colors.primary[400], backgroundColor: theme.colors.neutral[800] },
  charCardTap: { alignItems: 'center', width: '100%' },
  charName: { fontFamily: theme.fonts.semibold, fontSize: 16, color: theme.colors.neutral[0], marginTop: 10 },
  charRel: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.neutral[500], marginTop: 2 },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.colors.primary[500],
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.full,
    marginTop: 8,
  },
  activeBadgeText: { fontFamily: theme.fonts.medium, fontSize: 11, color: theme.colors.neutral[0] },
  charActions: { flexDirection: 'row', gap: 12, marginTop: 10 },
  actionBtn: { padding: 4 },
  createCard: {
    width: 140,
    backgroundColor: 'transparent',
    borderRadius: theme.radius.lg,
    borderWidth: 2,
    borderColor: theme.colors.neutral[700],
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 30,
    gap: 10,
  },
  createIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.colors.neutral[800],
    alignItems: 'center',
    justifyContent: 'center',
  },
  createText: { fontFamily: theme.fonts.medium, fontSize: 14, color: theme.colors.primary[300] },

  // Modal
  modalContainer: { flex: 1, backgroundColor: theme.colors.neutral[950] },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.neutral[800],
  },
  modalTitle: { fontFamily: theme.fonts.semibold, fontSize: 18, color: theme.colors.neutral[0] },
  formScroll: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.lg },
  avatarPicker: { alignSelf: 'center', position: 'relative', marginBottom: 4 },
  avatarPickerBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: theme.colors.neutral[950],
  },
  helperText: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.neutral[500], textAlign: 'center', marginBottom: theme.spacing.lg },
  fieldWrap: { marginBottom: theme.spacing.md },
  fieldLabel: { fontFamily: theme.fonts.medium, fontSize: 14, color: theme.colors.neutral[300], marginBottom: 6 },
  textInput: {
    backgroundColor: theme.colors.neutral[800],
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: theme.fonts.regular,
    fontSize: 15,
    color: theme.colors.neutral[0],
    minHeight: 48,
  },
  textArea: { minHeight: 70, textAlignVertical: 'top' },
  bioArea: { minHeight: 100 },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.neutral[800],
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  pickerBtnText: { fontFamily: theme.fonts.regular, fontSize: 15, color: theme.colors.neutral[0] },
  pickerDropdown: {
    backgroundColor: theme.colors.neutral[800],
    borderRadius: theme.radius.md,
    marginTop: 4,
    borderWidth: 1,
    borderColor: theme.colors.neutral[700],
    overflow: 'hidden',
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.neutral[700],
  },
  pickerOptionActive: { backgroundColor: theme.colors.neutral[700] },
  pickerOptionText: { fontFamily: theme.fonts.regular, fontSize: 14, color: theme.colors.neutral[200] },
  pickerOptionTextActive: { color: theme.colors.primary[300] },
  saveButton: {
    backgroundColor: theme.colors.primary[500],
    borderRadius: theme.radius.lg,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  saveButtonBusy: { opacity: 0.6 },
  saveText: { fontFamily: theme.fonts.semibold, fontSize: 17, color: theme.colors.neutral[0] },
});
