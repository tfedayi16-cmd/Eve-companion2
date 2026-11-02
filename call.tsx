import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ImageBackground,
  Platform,
  ActivityIndicator,
} from 'react-native';
import {
  Mic,
  MicOff,
  PhoneOff,
  Phone,
  Video,
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { EveAvatar } from '@/components/EveAvatar';
import { CallAvatar } from '@/components/CallAvatar';
import { useCharacters } from '@/hooks/useCharacters';
import { useSettings } from '@/hooks/useSettings';
import { getAIReply } from '@/lib/ai';
import { supabase, EDGE_FUNCTION_BASE } from '@/lib/supabase';
import type { Memory } from '@/types/database';
import { EVE_AMBIENT_URI } from '@/assets/images';
import { theme } from '@/constants/theme';

type CallState = 'idle' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'ended';

// Web Speech API types (minimal)
type SpeechRecognitionType = any;

export default function CallScreen() {
  const { activeCharacter, reload: reloadCharacters } = useCharacters();
  const { settings, reload: reloadSettings } = useSettings();
  useFocusEffect(
    useCallback(() => {
      reloadCharacters();
      reloadSettings();
    }, [reloadCharacters, reloadSettings]),
  );
  const [callState, setCallState] = useState<CallState>('idle');
  const [muted, setMuted] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recognitionRef = useRef<SpeechRecognitionType>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const aiAudioRef = useRef<HTMLAudioElement | null>(null);
  const memoriesRef = useRef<Memory[]>([]);
  const conversationHistoryRef = useRef<{ role: string; content: string }[]>([]);
  const isMountedRef = useRef(true);
  const callStateRef = useRef<CallState>('idle');
  const mutedRef = useRef(false);
  const startListeningRef = useRef<() => void>(() => {});

  const updateCallState = (next: CallState) => {
    callStateRef.current = next;
    setCallState(next);
  };

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  // Load memories
  useEffect(() => {
    if (!activeCharacter) return;
    (async () => {
      const { data } = await supabase
        .from('memories')
        .select('*')
        .or(`character_id.is.null,character_id.eq.${activeCharacter.id}`)
        .order('created_at', { ascending: false })
        .limit(15);
      memoriesRef.current = (data ?? []) as Memory[];
    })();
  }, [activeCharacter]);

  // Timer
  useEffect(() => {
    if (callState === 'listening' || callState === 'thinking' || callState === 'speaking') {
      timerRef.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [callState]);

  const speakBrowser = useCallback((text: string, voice: string) => {
    if (Platform.OS !== 'web') return;
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);

    // Try to match a voice
    const voices = window.speechSynthesis.getVoices();
    const voiceNames: Record<string, string[]> = {
      alloy: ['Samantha', 'Google UK English Female', 'female'],
      echo: ['Daniel', 'Google UK English Male', 'male'],
      fable: ['Alex', 'Google US English'],
      onyx: ['Daniel', 'Microsoft David', 'male'],
      nova: ['Karen', 'Google UK English Female'],
      shimmer: ['Tessa', 'Veena', 'female'],
    };
    const preferred = voiceNames[voice] ?? [];
    const matched = voices.find((v) =>
      preferred.some((p) => v.name.toLowerCase().includes(p.toLowerCase()))
    );
    if (matched) utterance.voice = matched;

    utterance.rate = 1.0;
    utterance.pitch = 1.05;

    utterance.onend = () => {
      if (isMountedRef.current && callStateRef.current === 'speaking') {
        updateCallState('listening');
        setTranscript('');
        setTimeout(() => startListeningRef.current(), 300);
      }
    };

    utterance.onerror = () => {
      if (isMountedRef.current) {
        updateCallState('listening');
        setTimeout(() => startListeningRef.current(), 300);
      }
    };

    updateCallState('speaking');
    window.speechSynthesis.speak(utterance);
  }, [callState]);

  // Use ElevenLabs for spoken replies, with browser speech as a fallback.
  const speak = useCallback(async (text: string, voice: string) => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      const response = await fetch(`${EDGE_FUNCTION_BASE}/ai-voice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
        },
        body: JSON.stringify({ text }),
      });
      if (!response.ok) throw new Error('Voice service unavailable');
      const result = await response.json();
      if (!result.audio_base64) throw new Error(result.error || 'No voice audio returned');
      if (callStateRef.current === 'ended' || !isMountedRef.current) return;
      const audio = new Audio(`data:audio/mpeg;base64,${result.audio_base64}`);
      aiAudioRef.current?.pause();
      aiAudioRef.current = audio;
      audio.onended = () => {
        aiAudioRef.current = null;
        if (isMountedRef.current && callStateRef.current === 'speaking') {
          updateCallState('listening');
          setTranscript('');
          setTimeout(() => startListeningRef.current(), 300);
        }
      };
      updateCallState('speaking');
      await audio.play();
    } catch (error) {
      if (callStateRef.current !== 'ended') speakBrowser(text, voice);
    }
  }, [speakBrowser]);

  const startListening = useCallback(() => {
    if (Platform.OS !== 'web') {
      setError('Voice calls require a web browser with speech recognition support. On mobile, please use the chat tab.');
      return;
    }
    if (typeof window === 'undefined' || !('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setError('Your browser does not support speech recognition. Try Chrome or Edge.');
      return;
    }

    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      setError('Speech recognition not available.');
      return;
    }

    // Stop any existing recognition before starting a new one
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      let finalText = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        finalText += event.results[i][0].transcript;
      }
      setTranscript(finalText);
      if (event.results[event.results.length - 1].isFinal) {
        handleUserSpeech(finalText);
      }
    };

    recognition.onerror = (event: any) => {
      console.warn('Speech recognition error:', event.error);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setError('Microphone access denied. Please allow microphone permissions in your browser.');
        updateCallState('listening');
      } else if (event.error === 'no-speech' && callStateRef.current === 'listening') {
        setTimeout(() => {
          if (isMountedRef.current && callStateRef.current === 'listening' && !mutedRef.current) {
            try { recognition.start(); } catch {}
          }
        }, 500);
      }
    };

    recognition.onend = () => {
      if (isMountedRef.current && callStateRef.current === 'listening' && !mutedRef.current) {
        try { recognition.start(); } catch {}
      }
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (err) {
      console.warn('Recognition start error:', err);
    }
  }, []);

  // Keep startListeningRef in sync so callbacks always call the latest version
  useEffect(() => {
    startListeningRef.current = startListening;
  }, [startListening]);

  const handleUserSpeech = useCallback(async (text: string) => {
    if (!text.trim() || !activeCharacter) return;

    updateCallState('thinking');
    setTranscript(text.trim());
    conversationHistoryRef.current.push({ role: 'user', content: text.trim() });

    try {
      const result = await getAIReply(
        conversationHistoryRef.current,
        activeCharacter,
        memoriesRef.current,
        settings?.adult_mode_enabled ?? false,
      );

      conversationHistoryRef.current.push({ role: 'assistant', content: result.reply });
      setAiResponse(result.reply);

      if (result.memory) {
        const { data } = await supabase
          .from('memories')
          .insert({ character_id: activeCharacter.id, content: result.memory, category: 'auto' })
          .select()
          .single();
        if (data) memoriesRef.current = [data as Memory, ...memoriesRef.current].slice(0, 15);
      }

      // Speak the response
      speak(result.reply, activeCharacter.voice);
    } catch (err: any) {
      setError(err.message ?? 'Could not get a response.');
      updateCallState('listening');
    }
  }, [activeCharacter, settings, speak]);

  const startCall = () => {
    setError(null);
    setSeconds(0);
    setTranscript('');
    setAiResponse('');
    conversationHistoryRef.current = [];
    updateCallState('connecting');

    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.mediaDevices) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then((stream) => {
          // Keep the stream alive so the browser doesn't release the mic
          streamRef.current = stream;
          setTimeout(() => {
            updateCallState('listening');
            startListening();
          }, 1500);
        })
        .catch((err) => {
          console.warn('Mic permission error:', err?.message);
          setError('Microphone access denied. Please allow microphone permissions and try again.');
          updateCallState('idle');
        });
    } else {
      setTimeout(() => {
        updateCallState('listening');
        startListening();
      }, 1500);
    }
  };

  const endCall = () => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
      recognitionRef.current = null;
    }
    // Release the mic stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    aiAudioRef.current?.pause();
    aiAudioRef.current = null;
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    updateCallState('ended');
    setTimeout(() => {
      if (isMountedRef.current) {
        updateCallState('idle');
        setMuted(false);
        setTranscript('');
        setAiResponse('');
        setError(null);
      }
    }, 1800);
  };

  const toggleMute = () => {
    const newMuted = !muted;
    mutedRef.current = newMuted;
    setMuted(newMuted);
    if (newMuted && recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    } else if (!newMuted && callStateRef.current === 'listening') {
      startListening();
    }
  };

  const isCallActive = callState !== 'idle' && callState !== 'ended';
  const isSpeaking = callState === 'speaking';
  const isThinking = callState === 'thinking';

  const stateLabel = {
    idle: 'Ready to call',
    connecting: 'Connecting…',
    listening: muted ? 'You are muted' : 'Listening…',
    thinking: 'Thinking…',
    speaking: 'Speaking…',
    ended: 'Call ended',
  }[callState];

  return (
    <View style={styles.container}>
      {isCallActive ? (
        <ImageBackground
          source={{ uri: activeCharacter?.avatar_url || EVE_AMBIENT_URI }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
          blurRadius={Platform.OS === 'web' ? 0 : 40}
          imageStyle={{ opacity: 0.3 }}
        >
          <LinearGradient
            colors={['rgba(16,14,13,0.45)', 'rgba(16,14,13,0.65)', 'rgba(16,14,13,0.95)']}
            style={StyleSheet.absoluteFill}
          />
        </ImageBackground>
      ) : (
        <LinearGradient
          colors={[theme.colors.neutral[900], theme.colors.neutral[950]]}
          style={StyleSheet.absoluteFill}
        />
      )}

      <SafeAreaView style={styles.safe} edges={['top']}>
        {/* Top bar */}
        <View style={styles.topBar}>
          <Text style={styles.callLabel}>
            {callState === 'connecting' ? stateLabel : isCallActive ? formatTime(seconds) : stateLabel}
          </Text>
        </View>

        {/* Center avatar */}
        <View style={styles.avatarStage}>
          {isCallActive ? (
            <CallAvatar
              speaking={isSpeaking}
              thinking={isThinking}
              uri={activeCharacter?.avatar_url}
            />
          ) : (
            <EveAvatar
              uri={activeCharacter?.avatar_url}
              size={180}
              pulse={callState === 'idle'}
              speaking={false}
              online={callState !== 'ended'}
            />
          )}

          <Text style={styles.eveName}>{activeCharacter?.name ?? 'Eve'}</Text>
          <Text style={styles.eveSubtitle}>{stateLabel}</Text>

          {/* Live transcript */}
          {transcript ? (
            <View style={styles.transcriptWrap}>
              <Text style={styles.transcriptLabel}>You said:</Text>
              <Text style={styles.transcriptText} numberOfLines={3}>{transcript}</Text>
            </View>
          ) : null}

          {aiResponse && isSpeaking ? (
            <View style={styles.responseWrap}>
              <Text style={styles.transcriptLabel}>{activeCharacter?.name ?? 'Eve'}:</Text>
              <Text style={styles.transcriptText} numberOfLines={4}>{aiResponse}</Text>
            </View>
          ) : null}

          {error ? (
            <View style={styles.errorWrap}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
        </View>

        {/* Controls */}
        <View style={styles.controlsOuter}>
          {callState === 'idle' || callState === 'ended' ? (
            <TouchableOpacity style={styles.callButton} onPress={startCall} activeOpacity={0.8}>
              <Phone size={26} color={theme.colors.neutral[0]} strokeWidth={2} fill={theme.colors.neutral[0]} />
              <Text style={styles.callButtonText}>Start Voice Call</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.controlsRow}>
              <ControlButton
                active={!muted}
                onPress={toggleMute}
                icon={muted ? <MicOff size={24} color={theme.colors.neutral[0]} strokeWidth={2} /> : <Mic size={24} color={theme.colors.neutral[0]} strokeWidth={2} />}
                label={muted ? 'Muted' : 'Mic'}
              />
              <TouchableOpacity style={styles.endCallButton} onPress={endCall} activeOpacity={0.8}>
                <PhoneOff size={26} color={theme.colors.neutral[0]} strokeWidth={2} />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

function ControlButton({ active, onPress, icon, label }: { active: boolean; onPress: () => void; icon: React.ReactNode; label: string }) {
  return (
    <View style={styles.controlWrap}>
      <TouchableOpacity
        style={[styles.controlButton, !active && styles.controlButtonOff]}
        onPress={onPress}
        activeOpacity={0.7}
      >
        {icon}
      </TouchableOpacity>
      <Text style={styles.controlLabel}>{label}</Text>
    </View>
  );
}

function formatTime(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.neutral[950] },
  safe: { flex: 1 },
  topBar: { paddingHorizontal: theme.spacing.lg, paddingTop: theme.spacing.sm, alignItems: 'center' },
  callLabel: { fontFamily: theme.fonts.medium, fontSize: 15, color: theme.colors.neutral[200], letterSpacing: 0.5 },
  avatarStage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.md, paddingHorizontal: theme.spacing.lg },
  eveName: { fontFamily: theme.fonts.bold, fontSize: 30, color: theme.colors.neutral[0] },
  eveSubtitle: { fontFamily: theme.fonts.regular, fontSize: 15, color: theme.colors.neutral[300] },
  transcriptWrap: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderRadius: theme.radius.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 8,
    maxWidth: 320,
  },
  responseWrap: {
    backgroundColor: 'rgba(229,90,67,0.15)',
    borderRadius: theme.radius.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 8,
    maxWidth: 320,
    borderWidth: 1,
    borderColor: 'rgba(229,90,67,0.3)',
  },
  transcriptLabel: { fontFamily: theme.fonts.medium, fontSize: 12, color: theme.colors.neutral[400], marginBottom: 4 },
  transcriptText: { fontFamily: theme.fonts.regular, fontSize: 14, color: theme.colors.neutral[100], lineHeight: 20 },
  errorWrap: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderRadius: theme.radius.md,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 8,
    maxWidth: 320,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
  },
  errorText: { fontFamily: theme.fonts.regular, fontSize: 13, color: theme.colors.error[500], textAlign: 'center' },
  controlsOuter: { paddingBottom: theme.spacing.xl, alignItems: 'center' },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: theme.colors.success[500],
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: theme.radius.full,
    ...theme.shadow.float,
  },
  callButtonText: { fontFamily: theme.fonts.semibold, fontSize: 17, color: theme.colors.neutral[0] },
  controlsRow: { flexDirection: 'row', alignItems: 'center', gap: theme.spacing.lg },
  controlWrap: { alignItems: 'center', gap: 8 },
  controlButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  controlButtonOff: { backgroundColor: theme.colors.neutral[800], borderColor: theme.colors.neutral[700] },
  controlLabel: { fontFamily: theme.fonts.regular, fontSize: 12, color: theme.colors.neutral[300] },
  endCallButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: theme.colors.error[500],
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.shadow.float,
  },
});
