import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { Send, Sparkles, Image as ImageIcon, Wand2 } from 'lucide-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withDelay,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from 'expo-router';
import { EveAvatar } from '@/components/EveAvatar';
import { useEveChat, type ChatMessage } from '@/hooks/useEveChat';
import { useCharacters } from '@/hooks/useCharacters';
import { supabase } from '@/lib/supabase';
import { generateImage } from '@/lib/ai';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/hooks/useSettings';
import { theme } from '@/constants/theme';

const SUGGESTIONS = [
  'How was your day?',
  'I had a long day',
  'Tell me a joke',
  'What can you do?',
];

export default function ChatScreen() {
  const { activeCharacter, activeCharacterId, reload: reloadCharacters } = useCharacters();
  const { user } = useAuth();
  const { settings, reload: reloadSettings } = useSettings();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [resolvingHistory, setResolvingHistory] = useState(true);
  const { messages, isTyping, loading, error, sendMessage, sendGeneratedImage } = useEveChat({
    character: activeCharacter,
    adultMode: settings?.adult_mode_enabled ?? false,
    conversationId,
    onConversationCreated: setConversationId,
  });
  useFocusEffect(
    useCallback(() => {
      reloadSettings();
      reloadCharacters();
    }, [reloadSettings, reloadCharacters]),
  );

  const [input, setInput] = useState('');
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const listRef = useRef<FlatList<ChatMessage>>(null);

  // Open the most recent conversation with the active companion
  useEffect(() => {
    let cancelled = false;
    setResolvingHistory(true);
    setConversationId(null);
    if (!activeCharacterId) {
      setResolvingHistory(false);
      return;
    }

    (async () => {
      const { data, error: lookupError } = await supabase
        .from('conversations')
        .select('id')
        .eq('character_id', activeCharacterId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (lookupError) {
        console.warn('Failed to load conversation history:', lookupError.message);
      }
      setConversationId(data?.id ?? null);
      setResolvingHistory(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [activeCharacterId]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [messages.length, isTyping]);

  const handleSend = () => {
    if (!input.trim() && !pendingImage) return;
    sendMessage(input, pendingImage);
    setInput('');
    setPendingImage(null);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });

    if (result.canceled || !result.assets?.[0]) return;

    try {
      const asset = result.assets[0];
      const fileName = `${user?.id}/chat/${Date.now()}.jpg`;
      let fileBody: Blob;
      if (Platform.OS === 'web') {
        fileBody = await (await fetch(asset.uri)).blob();
      } else {
        fileBody = await (await fetch(asset.uri)).blob();
      }

      const { error: uploadError } = await supabase.storage
        .from('character-avatars')
        .upload(fileName, fileBody, { contentType: 'image/jpeg', upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('character-avatars')
        .getPublicUrl(fileName);

      setPendingImage(urlData.publicUrl);
    } catch (err: any) {
      Alert.alert('Upload failed', err.message ?? 'Could not upload image.');
    }
  };

  const handleGenerateImage = async () => {
    const prompt = input.trim();
    if (!prompt) {
      Alert.alert('Describe what you want', 'Type a description of the image you want me to generate.');
      return;
    }

    setGenerating(true);
    try {
      const { imageUrl, message } = await generateImage(prompt, activeCharacter?.name);
      if (imageUrl) {
        await sendGeneratedImage(prompt, imageUrl, message);
      } else {
        Alert.alert('Generation failed', message);
      }
      setInput('');
    } catch (err: any) {
      Alert.alert('Generation failed', err.message ?? 'Could not generate image.');
    } finally {
      setGenerating(false);
    }
  };

  const isBusy = isTyping || generating || loading;

  if (loading || resolvingHistory) {
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
      {/* Header */}
      <View style={styles.header}>
        <EveAvatar uri={activeCharacter?.avatar_url} size={44} speaking={isTyping} />
        <View style={styles.headerInfo}>
          <Text style={styles.headerName}>{activeCharacter?.name ?? 'Eve'}</Text>
          <View style={styles.statusRow}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>
              {isTyping ? 'typing…' : 'Online · ready to talk'}
            </Text>
          </View>
        </View>
        <Sparkles size={20} color={theme.colors.accent[400]} strokeWidth={2} />
      </View>

      {/* Messages */}
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <MessageBubble message={item} avatarUri={activeCharacter?.avatar_url} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={null}
        ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      />

      {/* Error banner */}
      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorBannerText}>{error}</Text>
        </View>
      )}

      {/* Typing indicator */}
      {isTyping && <TypingIndicator avatarUri={activeCharacter?.avatar_url} />}

      {/* Pending image preview */}
      {pendingImage && (
        <View style={styles.pendingImageWrap}>
          <Image source={{ uri: pendingImage }} style={styles.pendingImage} />
          <TouchableOpacity
            style={styles.pendingImageRemove}
            onPress={() => setPendingImage(null)}
          >
            <Text style={styles.pendingImageRemoveText}>Remove</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Suggestions */}
      {messages.length <= 1 && !isTyping && (
        <View style={styles.suggestionsWrap}>
          <Text style={styles.suggestionsLabel}>Try saying</Text>
          {SUGGESTIONS.map((s) => (
            <TouchableOpacity
              key={s}
              style={styles.suggestionChip}
              onPress={() => sendMessage(s)}
              activeOpacity={0.7}
            >
              <Text style={styles.suggestionText}>{s}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Input bar */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <View style={styles.inputBar}>
          <TouchableOpacity style={styles.iconButton} onPress={pickImage} activeOpacity={0.7} disabled={isBusy}>
            <ImageIcon size={22} color={theme.colors.neutral[400]} strokeWidth={2} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={handleGenerateImage} activeOpacity={0.7} disabled={isBusy}>
            {generating ? (
              <ActivityIndicator size="small" color={theme.colors.accent[400]} />
            ) : (
              <Wand2 size={22} color={theme.colors.accent[400]} strokeWidth={2} />
            )}
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Message…"
            placeholderTextColor={theme.colors.neutral[500]}
            multiline
            maxLength={2000}
            editable={!isBusy}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!input.trim() && !pendingImage) && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={(!input.trim() && !pendingImage) || isBusy}
            activeOpacity={0.8}
          >
            {isTyping ? (
              <ActivityIndicator color={theme.colors.neutral[0]} size="small" />
            ) : (
              <Send size={20} color={theme.colors.neutral[0]} strokeWidth={2} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MessageBubble({ message, avatarUri }: { message: ChatMessage; avatarUri?: string | null }) {
  const isUser = message.role === 'user';
  return (
    <View style={[styles.bubbleRow, isUser && styles.bubbleRowUser]}>
      {!isUser && <EveAvatar uri={avatarUri} size={32} online={false} />}
      <View style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleEve]}>
        {message.image_url && (
          <Image source={{ uri: message.image_url }} style={styles.messageImage} resizeMode="cover" />
        )}
        {message.text ? (
          <Text style={[styles.bubbleText, isUser && styles.bubbleTextUser]}>{message.text}</Text>
        ) : null}
      </View>
    </View>
  );
}

function TypingDot({ delay }: { delay: number }) {
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 500, easing: Easing.inOut(Easing.ease) }), -1, true),
    );
    return () => cancelAnimation(opacity);
  }, [delay, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: 0.8 + opacity.value * 0.4 }],
  }));

  return <Animated.View style={[styles.typingDot, animatedStyle]} />;
}

function TypingIndicator({ avatarUri }: { avatarUri?: string | null }) {
  return (
    <View style={styles.typingRow}>
      <EveAvatar uri={avatarUri} size={32} online={false} />
      <View style={styles.typingBubble}>
        <TypingDot delay={0} />
        <TypingDot delay={200} />
        <TypingDot delay={400} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.neutral[950] },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.neutral[800],
    gap: theme.spacing.sm,
  },
  headerInfo: { flex: 1 },
  headerName: { fontFamily: theme.fonts.semibold, fontSize: 18, color: theme.colors.neutral[0] },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.success[500] },
  statusText: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.neutral[400] },
  listContent: { paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.md, flexGrow: 1 },
  bubbleRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, maxWidth: '100%' },
  bubbleRowUser: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '78%', paddingHorizontal: 16, paddingVertical: 12, borderRadius: theme.radius.lg },
  bubbleEve: { backgroundColor: theme.colors.neutral[800], borderBottomLeftRadius: 6 },
  bubbleUser: { backgroundColor: theme.colors.primary[500], borderBottomRightRadius: 6 },
  bubbleText: { fontFamily: theme.fonts.regular, fontSize: 15.5, lineHeight: 22, color: theme.colors.neutral[100] },
  bubbleTextUser: { color: theme.colors.neutral[0] },
  messageImage: { width: 200, height: 200, borderRadius: theme.radius.md, marginBottom: 8 },
  errorBanner: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: theme.spacing.md,
    borderRadius: theme.radius.md,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
  },
  errorBannerText: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.error[500] },
  typingRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.sm },
  typingBubble: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: theme.colors.neutral[800],
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: theme.radius.lg,
    borderBottomLeftRadius: 6,
  },
  typingDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: theme.colors.neutral[300] },
  suggestionsWrap: { paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.sm, gap: 8 },
  suggestionsLabel: { fontFamily: theme.fonts.medium, fontSize: 13, color: theme.colors.neutral[500], marginBottom: 2 },
  suggestionChip: {
    alignSelf: 'flex-start',
    backgroundColor: theme.colors.neutral[800],
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.neutral[700],
  },
  suggestionText: { fontFamily: theme.fonts.regular, fontSize: 14, color: theme.colors.neutral[200] },
  pendingImageWrap: { paddingHorizontal: theme.spacing.md, paddingBottom: theme.spacing.xs, alignItems: 'flex-end' },
  pendingImage: { width: 80, height: 80, borderRadius: theme.radius.md, borderWidth: 2, borderColor: theme.colors.primary[400] },
  pendingImageRemove: { marginTop: 4 },
  pendingImageRemoveText: { fontFamily: theme.fonts.regular, fontSize: 12, color: theme.colors.error[500] },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    paddingBottom: theme.spacing.md,
    gap: 6,
    borderTopWidth: 1,
    borderTopColor: theme.colors.neutral[800],
    backgroundColor: theme.colors.neutral[900],
  },
  iconButton: { width: 38, height: 44, alignItems: 'center', justifyContent: 'center' },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: theme.colors.neutral[800],
    borderRadius: theme.radius.xl,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: theme.fonts.regular,
    fontSize: 15.5,
    color: theme.colors.neutral[0],
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.primary[500],
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: { backgroundColor: theme.colors.neutral[700] },
});
