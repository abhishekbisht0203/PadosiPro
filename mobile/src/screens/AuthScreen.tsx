import { Feather } from '@expo/vector-icons';
import React, { useCallback, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { toApiError } from '../api/errors';
import { HeroHeader } from '../components/HeroHeader';
import { InlineBanner } from '../components/States';
import { StaggeredList } from '../components/Motion';
import { PrimaryButton } from '../components/PrimaryButton';
import { PasswordField, TextField } from '../components/TextField';
import { useAuth } from '../context/AuthContext';
import { colors, displayFont, radii, shared, spacing, typography } from '../theme';
import { describeError, mergeFieldErrors } from '../utils/errors';
import { hasErrors, validators, type FieldErrors } from '../utils/validation';

type Mode = 'login' | 'register';

/**
 * Sign in and sign up share a screen.
 *
 * They are the same three fields with one meaningful difference — whether the
 * password is being confirmed — and switching between them keeps whatever the
 * user has already typed, which matters on a small screen where re-entering a
 * password is the most annoying thing an app can ask for.
 */
export function AuthScreen() {
  const { login, setPendingEmail } = useAuth();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Editing a field clears its error, so a stale "required" never lingers after
  // the user has started typing.
  const clearFieldError = useCallback((field: string) => {
    setErrors((prev) => (prev[field] ? { ...prev, [field]: null } : prev));
    setFormError(null);
  }, []);

  const switchMode = (next: Mode) => {
    setMode(next);
    setErrors({});
    setFormError(null);
  };

  const handleSubmit = async () => {
    const rules: FieldErrors = {};

    const emailError = validators.email(email);
    if (emailError) rules.email = emailError;

    if (isRegister) {
      const passwordError = validators.password(password);
      if (passwordError) {
        rules.password = passwordError;
      } else if (!confirmPassword) {
        rules.password = 'Confirm your password';
      } else if (confirmPassword !== password) {
        rules.password = 'Passwords do not match';
      }
    } else if (!password) {
      rules.password = 'Password is required';
    }

    if (hasErrors(rules)) {
      setErrors(rules);
      return;
    }

    setErrors({});
    setSubmitting(true);

    try {
      if (mode === 'register') {
        await api.register(email.trim().toLowerCase(), password);
        // The account exists but is not verified yet, so the next stop is
        // always the OTP screen — never the home screen.
        setPendingEmail(email.trim().toLowerCase());
      } else {
        await login(email.trim().toLowerCase(), password);
      }
    } catch (err) {
      const apiErr = toApiError(err);

      // An unverified account is a routing decision, not a dead end: send them
      // to the OTP screen instead of showing a failure they cannot act on.
      if (apiErr.code === 'EMAIL_NOT_VERIFIED') {
        setPendingEmail(apiErr.message ? email.trim().toLowerCase() : email.trim().toLowerCase());
        setFormError(null);
      } else {
        setFormError(describeError(err));
        setErrors(mergeFieldErrors(err, {}));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const isRegister = mode === 'register';

  return (
    <KeyboardAvoidingView
      style={shared.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <ScrollView
        contentContainerStyle={[shared.content, { paddingBottom: insets.bottom + spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brandBlock}>
          <StaggeredList index={0} base={60}>
            <View style={styles.wordmarkRow}>
              <View style={styles.glyph}>
                <Feather name="check" size={16} color={colors.textInverse} />
              </View>
              <Text style={styles.wordmark}>PadosiPro</Text>
            </View>
          </StaggeredList>
          <StaggeredList index={1} base={60}>
            <Text style={styles.tagline}>You don't manage tasks — we do.</Text>
          </StaggeredList>
        </View>

        <View style={styles.card}>
          <StaggeredList index={2} base={60}>
            <Text style={styles.cardTitle}>{isRegister ? 'Create your account' : 'Welcome back'}</Text>
            <Text style={styles.cardSubtitle}>
              {isRegister
                ? 'Register with your email and verify it to get started.'
                : 'Sign in to pick up where you left off.'}
            </Text>
          </StaggeredList>

          {formError ? (
            <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)}>
              <InlineBanner tone="error" message={formError} onDismiss={() => setFormError(null)} />
            </Animated.View>
          ) : null}

          <StaggeredList index={3} base={60} style={styles.form}>
            <TextField
              label="Email address"
              icon="mail"
              value={email}
              onChangeText={(v) => {
                setEmail(v);
                clearFieldError('email');
              }}
              onSubmitEditing={handleSubmit}
              error={errors.email}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="next"
              hint={!errors.email ? 'We send a 6-digit code here to verify your account.' : undefined}
            />

            <PasswordField
              label="Password"
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                clearFieldError('password');
              }}
              error={errors.password}
              hint={!errors.password && isRegister ? 'At least 8 characters, with upper case, lower case and a number.' : undefined}
            />

            {isRegister ? (
              <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(150)}>
                <PasswordField
                  label="Confirm password"
                  value={confirmPassword}
                  onChangeText={(v) => {
                    setConfirmPassword(v);
                    clearFieldError('password');
                  }}
                  error={errors.password}
                  returnKeyType="go"
                  onSubmitEditing={handleSubmit}
                />
              </Animated.View>
            ) : null}
          </StaggeredList>

          <StaggeredList index={4} base={60} style={styles.actions}>
            <PrimaryButton
              label={isRegister ? 'Create account' : 'Sign in'}
              onPress={handleSubmit}
              loading={submitting}
              icon={isRegister ? 'user-plus' : 'log-in'}
              testID="auth-submit"
            />

            <Pressable
              onPress={() => switchMode(isRegister ? 'login' : 'register')}
              hitSlop={10}
              accessibilityRole="button"
              style={styles.switchRow}
            >
              <Text style={styles.switchText}>
                {isRegister ? 'Already have an account? ' : 'New to PadosiPro? '}
                <Text style={styles.switchLink}>{isRegister ? 'Sign in' : 'Create an account'}</Text>
              </Text>
            </Pressable>
          </StaggeredList>
        </View>

        <View style={styles.assurance}>
          <Assurance icon="shield" text="Your details stay private" />
          <Assurance icon="zap" text="One Lifestyle Manager, everything handled" />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Assurance({ icon, text }: { icon: keyof typeof Feather.glyphMap; text: string }) {
  return (
    <View style={styles.assuranceRow}>
      <Feather name={icon} size={13} color={colors.textTertiary} />
      <Text style={styles.assuranceText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  brandBlock: { paddingTop: spacing.huge, paddingBottom: spacing.xl, gap: spacing.sm },
  wordmarkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  glyph: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: { fontFamily: displayFont, fontSize: 30, lineHeight: 38, fontWeight: '700', color: colors.primary },
  tagline: { ...typography.body, color: colors.textSecondary },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.base,
  },
  cardTitle: { ...typography.title },
  cardSubtitle: { ...typography.bodySmall, marginTop: spacing.xs },
  form: { gap: spacing.xs },
  actions: { gap: spacing.base, marginTop: spacing.xs },
  switchRow: { alignSelf: 'center', paddingVertical: spacing.xs },
  switchText: { ...typography.bodySmall },
  switchLink: { color: colors.primary, fontWeight: '700' },

  assurance: { marginTop: spacing.xl, gap: spacing.sm, alignItems: 'center' },
  assuranceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  assuranceText: { ...typography.bodySmall, fontSize: 12 },
});
