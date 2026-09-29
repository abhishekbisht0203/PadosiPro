import { Feather } from '@expo/vector-icons';
import React, { useCallback, useState } from 'react';
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
  const { login, setPendingEmail, initialLoadError, retryInitialLoad } = useAuth();
  const insets = useSafeAreaInsets();

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const isRegister = mode === 'register';

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
      if (passwordError) rules.password = passwordError;

      // The mismatch error belongs on the *confirm* field, not the password
      // field. It used to be written to `rules.password`, so the message showed
      // under both inputs at once and the user could not tell which box to fix.
      if (!passwordError) {
        const confirmError = validators.confirmPassword(confirmPassword, password);
        if (confirmError) rules.confirmPassword = confirmError;
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
      if (isRegister) {
        await api.register(email.trim().toLowerCase(), password);
        // The account exists but is not verified yet, so the next stop is
        // always the OTP screen — never the home screen.
        setPendingEmail(email.trim().toLowerCase());
      } else {
        await login(email.trim().toLowerCase(), password);
      }
    } catch (err) {
      const apiErr = toApiError(err);

      if (apiErr.code === 'EMAIL_NOT_VERIFIED') {
        // An unverified account is a routing decision, not a dead end: send them
        // to the OTP screen instead of showing a failure they cannot act on.
        setPendingEmail(email.trim().toLowerCase());
        setFormError(null);
      } else if (apiErr.code === 'OTP_RESEND_TOO_SOON') {
        // Registering twice inside the cooldown means a code is already out
        // there. Route to the OTP screen — that is where the user can use it —
        // rather than leaving them on a form with an error they cannot clear.
        setPendingEmail(email.trim().toLowerCase());
        setFormError(
          apiErr.retryAfterSeconds
            ? `A code was already sent. You can request another in ${apiErr.retryAfterSeconds}s.`
            : 'A code was already sent a moment ago.',
        );
      } else if (apiErr.code === 'EMAIL_ALREADY_REGISTERED') {
        setFormError('That email is already registered. Sign in instead.');
      } else {
        setFormError(describeError(err));
        setErrors(mergeFieldErrors(err, {}));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetry = useCallback(async () => {
    setRetrying(true);
    try {
      await retryInitialLoad();
    } catch {
      // loadSession records its own error state; nothing to add here.
    } finally {
      setRetrying(false);
    }
  }, [retryInitialLoad]);

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

          {initialLoadError ? (
          <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)}>
            <View style={styles.bootstrapBanner}>
              <Feather name="wifi-off" size={15} color={colors.error} />
              <View style={styles.bootstrapCopy}>
                <Text style={styles.bootstrapTitle}>Could not check your session</Text>
                <Text style={styles.bootstrapMessage}>{initialLoadError}</Text>
              </View>
              <Pressable
                onPress={handleRetry}
                disabled={retrying}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Retry checking your session"
                testID="auth-retry-bootstrap"
              >
                <View style={styles.retryPill}>
                  <Feather
                    name="refresh-cw"
                    size={13}
                    color={colors.primary}
                    style={retrying ? styles.spinning : undefined}
                  />
                  <Text style={styles.retryText}>{retrying ? 'Retrying' : 'Retry'}</Text>
                </View>
              </Pressable>
            </View>
          </Animated.View>
        ) : null}

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
                    clearFieldError('confirmPassword');
                  }}
                  error={errors.confirmPassword}
                  returnKeyType="go"
                  onSubmitEditing={handleSubmit}
                  testID="auth-confirm-password"
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

  bootstrapBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: colors.errorSoft,
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.base,
  },
  bootstrapCopy: { flex: 1, gap: 2 },
  bootstrapTitle: { ...typography.bodySmall, fontWeight: '700', color: colors.error },
  bootstrapMessage: { ...typography.bodySmall, color: colors.textSecondary },
  retryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.mintSoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  retryText: { ...typography.bodySmall, fontSize: 12, fontWeight: '700', color: colors.primary },
  spinning: { transform: [{ rotate: '90deg' }] },
});
