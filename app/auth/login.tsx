import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Image,
} from 'react-native';
import { Heart, Mail, Lock, ArrowRight } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { theme } from '@/constants/theme';
import { EVE_AVATAR_URI } from '@/assets/images';

export default function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setError(null);
    setBusy(true);

    const result = mode === 'login'
      ? await signIn(email.trim(), password)
      : await signUp(email.trim(), password);

    setBusy(false);

    if (result.error) {
      setError(result.error);
    }
  };

  return (
    <LinearGradient
      colors={[theme.colors.neutral[900], theme.colors.neutral[950]]}
      style={styles.container}
    >
      <SafeAreaView style={styles.safe} edges={['top']}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.logoWrap}>
              <Image
                source={{ uri: EVE_AVATAR_URI }}
                style={styles.logoImage}
              />
              <Text style={styles.appName}>Eve</Text>
              <Text style={styles.tagline}>Your personal AI companion</Text>
            </View>

            <View style={styles.formCard}>
              <Text style={styles.formTitle}>
                {mode === 'login' ? 'Welcome back' : 'Create your account'}
              </Text>

              {error && (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <View style={styles.inputWrap}>
                <Mail size={20} color={theme.colors.neutral[400]} strokeWidth={2} />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Email"
                  placeholderTextColor={theme.colors.neutral[500]}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputWrap}>
                <Lock size={20} color={theme.colors.neutral[400]} strokeWidth={2} />
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Password"
                  placeholderTextColor={theme.colors.neutral[500]}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>

              <TouchableOpacity
                style={[styles.submitButton, busy && styles.submitButtonBusy]}
                onPress={handleSubmit}
                disabled={busy}
                activeOpacity={0.8}
              >
                <Text style={styles.submitText}>
                  {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
                </Text>
                <ArrowRight size={20} color={theme.colors.neutral[0]} strokeWidth={2} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.switchMode}
                onPress={() => {
                  setMode(mode === 'login' ? 'signup' : 'login');
                  setError(null);
                }}
              >
                <Text style={styles.switchText}>
                  {mode === 'login'
                    ? "Don't have an account? Sign up"
                    : 'Already have an account? Sign in'}
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.xxl,
  },
  logoWrap: {
    alignItems: 'center',
    paddingTop: theme.spacing.xxl,
    paddingBottom: theme.spacing.xl,
  },
  logoCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: theme.colors.primary[300],
    overflow: 'hidden',
    backgroundColor: theme.colors.neutral[800],
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoImage: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: theme.colors.primary[300],
    position: 'absolute',
  },
  logoInner: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  appName: {
    fontFamily: theme.fonts.bold,
    fontSize: 32,
    color: theme.colors.neutral[0],
    marginTop: theme.spacing.md,
  },
  tagline: {
    fontFamily: theme.fonts.regular,
    fontSize: 15,
    color: theme.colors.neutral[400],
    marginTop: 4,
  },
  formCard: {
    backgroundColor: theme.colors.neutral[900],
    borderRadius: theme.radius.xl,
    padding: theme.spacing.lg,
    borderWidth: 1,
    borderColor: theme.colors.neutral[800],
    ...theme.shadow.card,
  },
  formTitle: {
    fontFamily: theme.fonts.semibold,
    fontSize: 22,
    color: theme.colors.neutral[0],
    marginBottom: theme.spacing.md,
  },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderRadius: theme.radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
  },
  errorText: {
    fontFamily: theme.fonts.regular,
    fontSize: 14,
    color: theme.colors.error[500],
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.neutral[800],
    borderRadius: theme.radius.lg,
    paddingHorizontal: 16,
    marginBottom: theme.spacing.sm,
    gap: 10,
    height: 52,
  },
  input: {
    flex: 1,
    fontFamily: theme.fonts.regular,
    fontSize: 16,
    color: theme.colors.neutral[0],
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.primary[500],
    borderRadius: theme.radius.lg,
    paddingVertical: 16,
    marginTop: theme.spacing.sm,
  },
  submitButtonBusy: {
    opacity: 0.6,
  },
  submitText: {
    fontFamily: theme.fonts.semibold,
    fontSize: 17,
    color: theme.colors.neutral[0],
  },
  switchMode: {
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    marginTop: theme.spacing.xs,
  },
  switchText: {
    fontFamily: theme.fonts.regular,
    fontSize: 14,
    color: theme.colors.primary[300],
  },
});
