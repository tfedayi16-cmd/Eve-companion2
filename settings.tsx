import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  ScrollView,
  Alert,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import {
  Bell,
  Moon,
  Volume2,
  Heart,
  Shield,
  ChevronRight,
  Info,
  Sparkles,
  Trash2,
  LogOut,
  Brain,
  AlertTriangle,
  Check,
  Lock,
  Pencil,
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { EveAvatar } from '@/components/EveAvatar';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/hooks/useSettings';
import { useCharacters } from '@/hooks/useCharacters';
import { supabase } from '@/lib/supabase';
import { theme } from '@/constants/theme';
import type { Memory } from '@/types/database';

export default function SettingsScreen() {
  const { user, signOut } = useAuth();
  const { settings, loading, updateSettings } = useSettings();
  const { activeCharacter, reload: reloadCharacters } = useCharacters();
  const router = useRouter();

  useFocusEffect(
    useCallback(() => {
      reloadCharacters();
    }, [reloadCharacters]),
  );
  const [showMemories, setShowMemories] = useState(false);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [loadingMemories, setLoadingMemories] = useState(false);
  const [showAgeVerify, setShowAgeVerify] = useState(false);

  const loadMemories = useCallback(async () => {
    setLoadingMemories(true);
    const { data, error } = await supabase
      .from('memories')
      .select('*')
      .order('created_at', { ascending: false });
    if (!error && data) setMemories(data as Memory[]);
    setLoadingMemories(false);
  }, []);

  const handleAdultModeToggle = (value: boolean) => {
    if (value && !settings?.age_verified) {
      setShowAgeVerify(true);
      return;
    }
    updateSettings({ adult_mode_enabled: value });
  };

  const confirmAgeVerification = () => {
    updateSettings({ age_verified: true, adult_mode_enabled: true });
    setShowAgeVerify(false);
  };

  const handleDeleteMemory = async (id: string) => {
    await supabase.from('memories').delete().eq('id', id);
    setMemories((prev) => prev.filter((m) => m.id !== id));
  };

  const handleClearConversations = async () => {
    Alert.alert(
      'Clear all conversations?',
      'This will permanently delete all your chat history. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const { error } = await supabase.rpc('upsert_user_settings');
            // Delete all conversations (cascades to messages)
            const { error: delError } = await supabase
              .from('conversations')
              .delete()
              .neq('id', '00000000-0000-0000-0000-000000000000');
            if (delError) {
              Alert.alert('Error', 'Could not clear conversations.');
            } else {
              Alert.alert('Done', 'All conversations have been cleared.');
            }
          },
        },
      ],
    );
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      'Delete account?',
      'This will permanently delete your account, all characters, conversations, and memories. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Forever',
          style: 'destructive',
          onPress: async () => {
            // Delete user data (RLS ensures only own data)
            await supabase.from('memories').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            await supabase.from('conversations').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            await supabase.from('characters').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            await supabase.from('user_settings').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            await signOut();
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
        {/* Profile header */}
        <View style={styles.profileCard}>
          <EveAvatar uri={activeCharacter?.avatar_url} size={84} online />
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>{activeCharacter?.name ?? 'Eve'}</Text>
            <Text style={styles.profileSubtitle}>{user?.email ?? 'Your account'}</Text>
            <View style={styles.badgeRow}>
              <View style={styles.badge}>
                <Sparkles size={12} color={theme.colors.accent[400]} strokeWidth={2} />
                <Text style={styles.badgeText}>Eve Companion v2.0</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Companion */}
        <Text style={styles.sectionTitle}>Your companion</Text>
        <View style={styles.card}>
          <SettingLink
            icon={<Pencil size={20} color={theme.colors.primary[400]} strokeWidth={2} />}
            label="Edit Eve"
            description="Change her photo, name and personality"
            onPress={() => router.push('/edit-eve')}
          />
        </View>

        {/* Preferences */}
        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.card}>
          <SettingToggle
            icon={<Bell size={20} color={theme.colors.primary[400]} strokeWidth={2} />}
            label="Notifications"
            description="Get reminded to check in"
            value={settings?.notifications_enabled ?? true}
            onToggle={() => updateSettings({ notifications_enabled: !(settings?.notifications_enabled ?? true) })}
          />
          <Divider />
          <SettingToggle
            icon={<Moon size={20} color={theme.colors.secondary[400]} strokeWidth={2} />}
            label="Dark mode"
            description="Easier on the eyes at night"
            value={settings?.dark_mode ?? true}
            onToggle={() => updateSettings({ dark_mode: !(settings?.dark_mode ?? true) })}
          />
          <Divider />
          <SettingToggle
            icon={<Volume2 size={20} color={theme.colors.accent[400]} strokeWidth={2} />}
            label="Voice responses"
            description="Eve speaks replies aloud in calls"
            value={settings?.voice_enabled ?? true}
            onToggle={() => updateSettings({ voice_enabled: !(settings?.voice_enabled ?? true) })}
          />
        </View>

        {/* Adult mode */}
        <Text style={styles.sectionTitle}>Content</Text>
        <View style={styles.card}>
          <SettingToggle
            icon={<Shield size={20} color={theme.colors.warning[500]} strokeWidth={2} />}
            label="Adult conversation mode"
            description="Enable romantic and intimate conversations"
            value={settings?.adult_mode_enabled ?? false}
            onToggle={handleAdultModeToggle}
          />
          {settings?.adult_mode_enabled && (
            <View style={styles.adultInfoBox}>
              <Check size={14} color={theme.colors.success[500]} strokeWidth={2} />
              <Text style={styles.adultInfoText}>
                Adult mode is active. Conversations will allow romantic and emotionally intimate content within AI provider policies.
              </Text>
            </View>
          )}
        </View>

        {/* Memory */}
        <Text style={styles.sectionTitle}>Memory</Text>
        <View style={styles.card}>
          <SettingLink
            icon={<Brain size={20} color={theme.colors.secondary[400]} strokeWidth={2} />}
            label="View memories"
            description="See what Eve remembers about you"
            onPress={() => {
              loadMemories();
              setShowMemories(true);
            }}
          />
          <Divider />
          <SettingLink
            icon={<Trash2 size={20} color={theme.colors.error[500]} strokeWidth={2} />}
            label="Clear conversation history"
            description="Remove all chat history"
            danger
            onPress={handleClearConversations}
          />
        </View>

        {/* About */}
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.card}>
          <SettingLink
            icon={<Heart size={20} color={theme.colors.primary[400]} strokeWidth={2} />}
            label="About Eve"
            description="Your personal AI companion"
            showChevron={false}
          />
          <Divider />
          <SettingLink
            icon={<Info size={20} color={theme.colors.secondary[400]} strokeWidth={2} />}
            label="Version"
            description="2.0.0"
            showChevron={false}
          />
        </View>

        {/* Account */}
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.card}>
          <SettingLink
            icon={<LogOut size={20} color={theme.colors.neutral[300]} strokeWidth={2} />}
            label="Sign out"
            description="Sign out of your account"
            onPress={() => signOut()}
          />
          <Divider />
          <SettingLink
            icon={<AlertTriangle size={20} color={theme.colors.error[500]} strokeWidth={2} />}
            label="Delete account"
            description="Permanently remove everything"
            danger
            onPress={handleDeleteAccount}
          />
        </View>

        <Text style={styles.footerNote}>
          Eve uses AI language models for genuine conversations. An OpenAI API key must be configured as an edge function secret for AI features to work.
        </Text>
      </ScrollView>

      {/* Memories modal */}
      <Modal visible={showMemories} animationType="slide" transparent={false} onRequestClose={() => setShowMemories(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Eve's Memories</Text>
            <TouchableOpacity onPress={() => setShowMemories(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Text style={styles.modalCloseText}>Done</Text>
            </TouchableOpacity>
          </View>
          {loadingMemories ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator size="large" color={theme.colors.primary[400]} />
            </View>
          ) : memories.length === 0 ? (
            <View style={styles.emptyMemories}>
              <Brain size={48} color={theme.colors.neutral[600]} strokeWidth={1.5} />
              <Text style={styles.emptyMemoriesText}>No memories yet</Text>
              <Text style={styles.emptyMemoriesSub}>Eve will remember things about you as you chat.</Text>
            </View>
          ) : (
            <FlatList
              data={memories}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.memoryItem}>
                  <View style={styles.memoryTextWrap}>
                    <Text style={styles.memoryCategory}>{item.category}</Text>
                    <Text style={styles.memoryContent}>{item.content}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleDeleteMemory(item.id)}
                    style={styles.memoryDelete}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  >
                    <Trash2 size={16} color={theme.colors.error[500]} strokeWidth={2} />
                  </TouchableOpacity>
                </View>
              )}
              contentContainerStyle={{ paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.xxl }}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            />
          )}
        </SafeAreaView>
      </Modal>

      {/* Age verification modal */}
      <Modal visible={showAgeVerify} animationType="fade" transparent={true} onRequestClose={() => setShowAgeVerify(false)}>
        <View style={styles.ageVerifyOverlay}>
          <View style={styles.ageVerifyCard}>
            <View style={styles.ageVerifyIcon}>
              <Lock size={32} color={theme.colors.warning[500]} strokeWidth={2} />
            </View>
            <Text style={styles.ageVerifyTitle}>Age Verification</Text>
            <Text style={styles.ageVerifyText}>
              Adult conversation mode includes romantic and emotionally intimate content. You must confirm you are 18 years or older to enable this feature.
            </Text>
            <View style={styles.ageVerifyButtons}>
              <TouchableOpacity
                style={styles.ageVerifyCancel}
                onPress={() => setShowAgeVerify(false)}
              >
                <Text style={styles.ageVerifyCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.ageVerifyConfirm}
                onPress={confirmAgeVerification}
              >
                <Text style={styles.ageVerifyConfirmText}>I am 18+</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function SettingToggle({ icon, label, description, value, onToggle }: { icon: React.ReactNode; label: string; description: string; value: boolean; onToggle: (value: boolean) => void }) {
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingIconWrap}>{icon}</View>
      <View style={styles.settingText}>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text style={styles.settingDesc}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: theme.colors.neutral[700], true: theme.colors.primary[500] }}
        thumbColor={theme.colors.neutral[0]}
      />
    </View>
  );
}

function SettingLink({ icon, label, description, showChevron = true, danger = false, onPress }: { icon: React.ReactNode; label: string; description: string; showChevron?: boolean; danger?: boolean; onPress?: () => void }) {
  return (
    <TouchableOpacity style={styles.settingRow} activeOpacity={0.6} onPress={onPress} disabled={!onPress}>
      <View style={styles.settingIconWrap}>{icon}</View>
      <View style={styles.settingText}>
        <Text style={[styles.settingLabel, danger && styles.settingLabelDanger]}>{label}</Text>
        <Text style={styles.settingDesc}>{description}</Text>
      </View>
      {showChevron && <ChevronRight size={20} color={theme.colors.neutral[500]} strokeWidth={2} />}
    </TouchableOpacity>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.neutral[950] },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollContent: { paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.xxl },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.neutral[900],
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.neutral[800],
    ...theme.shadow.card,
  },
  profileInfo: { flex: 1 },
  profileName: { fontFamily: theme.fonts.bold, fontSize: 24, color: theme.colors.neutral[0] },
  profileSubtitle: { fontFamily: theme.fonts.regular, fontSize: 14, color: theme.colors.neutral[400], marginTop: 2 },
  badgeRow: { flexDirection: 'row', marginTop: 10, gap: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: theme.colors.neutral[800], paddingHorizontal: 10, paddingVertical: 5, borderRadius: theme.radius.full },
  badgeText: { fontFamily: theme.fonts.medium, fontSize: 12, color: theme.colors.accent[300] },
  sectionTitle: { fontFamily: theme.fonts.semibold, fontSize: 14, color: theme.colors.neutral[500], textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: theme.spacing.sm, marginLeft: 4 },
  card: { backgroundColor: theme.colors.neutral[900], borderRadius: theme.radius.lg, marginBottom: theme.spacing.lg, borderWidth: 1, borderColor: theme.colors.neutral[800], overflow: 'hidden' },
  settingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.md, paddingVertical: 14, gap: theme.spacing.sm },
  settingIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: theme.colors.neutral[800], alignItems: 'center', justifyContent: 'center' },
  settingText: { flex: 1 },
  settingLabel: { fontFamily: theme.fonts.medium, fontSize: 16, color: theme.colors.neutral[0] },
  settingLabelDanger: { color: theme.colors.error[500] },
  settingDesc: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.neutral[500], marginTop: 2 },
  divider: { height: 1, backgroundColor: theme.colors.neutral[800], marginLeft: 64 },
  adultInfoBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: theme.spacing.md, paddingVertical: 12, backgroundColor: 'rgba(22,163,74,0.1)' },
  adultInfoText: { flex: 1, fontFamily: theme.fonts.regular, fontSize: 12, color: theme.colors.success[600], lineHeight: 18 },
  footerNote: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.neutral[600], textAlign: 'center', marginTop: theme.spacing.md, paddingHorizontal: theme.spacing.lg, lineHeight: 20 },
  // Modal
  modalContainer: { flex: 1, backgroundColor: theme.colors.neutral[950] },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, borderBottomWidth: 1, borderBottomColor: theme.colors.neutral[800] },
  modalTitle: { fontFamily: theme.fonts.semibold, fontSize: 18, color: theme.colors.neutral[0] },
  modalCloseText: { fontFamily: theme.fonts.medium, fontSize: 16, color: theme.colors.primary[300] },
  emptyMemories: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: theme.spacing.xl },
  emptyMemoriesText: { fontFamily: theme.fonts.semibold, fontSize: 18, color: theme.colors.neutral[300], marginTop: theme.spacing.md },
  emptyMemoriesSub: { fontFamily: theme.fonts.regular, fontSize: 14, color: theme.colors.neutral[500], textAlign: 'center', marginTop: 8 },
  memoryItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.neutral[900], borderRadius: theme.radius.md, padding: theme.spacing.md, borderWidth: 1, borderColor: theme.colors.neutral[800] },
  memoryTextWrap: { flex: 1 },
  memoryCategory: { fontFamily: theme.fonts.medium, fontSize: 11, color: theme.colors.accent[400], textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  memoryContent: { fontFamily: theme.fonts.regular, fontSize: 14, color: theme.colors.neutral[100], lineHeight: 20 },
  memoryDelete: { padding: 8 },
  // Age verification
  ageVerifyOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: theme.spacing.lg },
  ageVerifyCard: { backgroundColor: theme.colors.neutral[900], borderRadius: theme.radius.xl, padding: theme.spacing.xl, width: '100%', maxWidth: 400, borderWidth: 1, borderColor: theme.colors.neutral[800] },
  ageVerifyIcon: { alignItems: 'center', marginBottom: theme.spacing.md },
  ageVerifyTitle: { fontFamily: theme.fonts.bold, fontSize: 22, color: theme.colors.neutral[0], textAlign: 'center', marginBottom: theme.spacing.sm },
  ageVerifyText: { fontFamily: theme.fonts.regular, fontSize: 14, color: theme.colors.neutral[300], textAlign: 'center', lineHeight: 20, marginBottom: theme.spacing.lg },
  ageVerifyButtons: { flexDirection: 'row', gap: theme.spacing.md },
  ageVerifyCancel: { flex: 1, paddingVertical: 14, borderRadius: theme.radius.md, backgroundColor: theme.colors.neutral[800], alignItems: 'center' },
  ageVerifyCancelText: { fontFamily: theme.fonts.medium, fontSize: 16, color: theme.colors.neutral[300] },
  ageVerifyConfirm: { flex: 1, paddingVertical: 14, borderRadius: theme.radius.md, backgroundColor: theme.colors.primary[500], alignItems: 'center' },
  ageVerifyConfirmText: { fontFamily: theme.fonts.semibold, fontSize: 16, color: theme.colors.neutral[0] },
});
