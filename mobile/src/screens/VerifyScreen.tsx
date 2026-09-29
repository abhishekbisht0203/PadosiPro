import { Feather } from '@expo/vector-icons';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import { toApiError } from '../api/errors';
import { HeroHeader } from '../components/HeroHeader';
import { StaggeredList } from '../components/Motion';
import { OtpInput } from '../components/OtpInput';
import { PrimaryButton } from '../components/PrimaryButton';
import { InlineBanner } from '../components/States';
import { useAuth } from '../context/AuthContext';
import { colors, radii, shared, spacing, typography } from '../theme';
import { describeError } from '../utils/errors';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 30;
const EXPIRY_SECONDS = 10 * 60;

/**
 * Email verification.
 *
 * The countdown mirrors the server policy (30s between sends, 10 minute expiry)
 * but the server is still the authority — if the two ever disagree the server's
 * error is what the user sees, and the countdown simply re-syncs from it.
 *
 * The back arrow returns to the sign-in screen. It used to call
 * `setPendingEmail`, which *also* routed to the verify stage — a back button
 * that went nowhere. A mistyped address is a real and common mistake here, and
 * without a way out the only escape was restarting the app.
 */
export function VerifyScreen() {
  const { email, completeVerification, cancelPendingEmail } = useAuth();
  const insets = useSafeAreaInsets();

  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);

  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const [expiry, setExpiry] = useState(EXPIRY_SECONDS);

  // Guards against a state update after the screen has gone away.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  useEffect(() => {
    if (expiry <= 0) return undefined;
    const id = setInterval(() => setExpiry((e) => Math.max(0, e - 1)), 1000);
    return () => clearInterval(id);
  }, [expiry]);

  const submit = useCallback(
    async (submitted: string) => {
      if (!email) return;
      setVerifying(true);
      setError(null);
      setNotice(null);

      try {
        const { token } = await api.verifyOtp(email, submitted);
        await completeVerification(email, token);
      } catch (err) {
        const apiErr = toApiError(err);
        setError(apiErr.message);
        setCode('');

        // A locked or exhausted code means the only way forward is a new one,
        // so drop the cooldown so "Resend" is immediately usable.
        if (apiErr.code === 'OTP_LOCKED' || apiErr.code === 'OTP_EXPIRED') {
          setCooldown(0);
        }
        if (apiErr.retryAfterSeconds !== undefined) {
          setCooldown(apiErr.retryAfterSeconds);
        }
      } finally {
        if (mounted.current) setVerifying(false);
      }
    },
    [completeVerification, email],
  );

  // Verify automatically once all six digits are in — no extra tap, which is
  // what users expect from an SMS/email code field.
  const handleChange = useCallback(
    (next: string) => {
      setCode(next);
      if (error) setError(null);
      if (next.length === OTP_LENGTH && !verifying) {
        void submit(next);
      }
    },
    [error, submit, verifying],
  );

  const resend = useCallback(async () => {
    if (!email) return;
    setResending(true);
    setError(null);
    setNotice(null);

    try {
      await api.resendOtp(email);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setExpiry(EXPIRY_SECONDS);
      setCode('');
      setNotice('We sent a new code. Check your inbox.');
    } catch (err) {
      const apiErr = toApiError(err);
      setError(describeError(err));
      if (apiErr.retryAfterSeconds !== undefined) {
        setCooldown(apiErr.retryAfterSeconds);
      }
    } finally {
      if (mounted.current) setResending(false);
    }
  }, [email]);

  const expiryLabel = `${Math.floor(expiry / 60)}:${String(expiry % 60).padStart(2, '0')}`;

  return (
    <View style={shared.screen}>
      <HeroHeader
        eyebrow="Verify your email"
        title="Enter the code we sent"
        subtitle={email ? `We sent a 6-digit code to ${email}.` : 'Enter the 6-digit code we sent to your email.'}
        onBack={cancelPendingEmail}
        compact
      />

      <ScrollView
        contentContainerStyle={[shared.content, { paddingBottom: insets.bottom + spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <StaggeredList index={0} base={120}>
          <View style={styles.timerRow}>
            <Feather name="clock" size={14} color={colors.textSecondary} />
            <Text style={styles.timerText}>Expires in {expiryLabel}</Text>
          </View>
        </StaggeredList>

        {notice ? (
          <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(140)}>
            <InlineBanner tone="success" message={notice} onDismiss={() => setNotice(null)} />
          </Animated.View>
        ) : null}

        {error ? (
          <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(140)}>
            <InlineBanner tone="error" message={error} onDismiss={() => setError(null)} />
          </Animated.View>
        ) : null}

        <StaggeredList index={1} base={120}>
          <OtpInput value={code} onChange={handleChange} length={OTP_LENGTH} error={error} />
        </StaggeredList>

        <StaggeredList index={2} base={120}>
          <PrimaryButton
            label="Verify and continue"
            onPress={() => submit(code)}
            loading={verifying}
            disabled={code.length !== OTP_LENGTH}
            icon="check-circle"
            style={styles.verifyButton}
            testID="verify-submit"
          />
        </StaggeredList>

        <StaggeredList index={3} base={120}>
          <View style={styles.resendBlock}>
            {cooldown > 0 ? (
              <Text style={styles.resendText}>
                Didn't get it? You can request a new code in{' '}
                <Text style={styles.resendCountdown}>{cooldown}s</Text>
              </Text>
            ) : (
              <Pressable onPress={resend} disabled={resending} hitSlop={10} accessibilityRole="button">
                <Text style={styles.resendLink}>{resending ? 'Sending…' : 'Resend code'}</Text>
              </Pressable>
            )}

            <View style={styles.helpRow}>
              <Feather name="mail" size={13} color={colors.textTertiary} />
              <Text style={styles.helpText}>
                Codes go to your inbox — check spam or promotions if it has not arrived.
              </Text>
            </View>
          </View>
        </StaggeredList>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    marginBottom: spacing.base,
  },
  timerText: { ...typography.bodySmall, fontWeight: '600', color: colors.textSecondary },
  verifyButton: { marginTop: spacing.sm },
  resendBlock: { marginTop: spacing.xl, alignItems: 'center', gap: spacing.base },
  resendText: { ...typography.bodySmall, textAlign: 'center' },
  resendCountdown: { color: colors.primary, fontWeight: '700' },
  resendLink: { ...typography.body, color: colors.primary, fontWeight: '700' },
  helpRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg },
  helpText: { ...typography.bodySmall, fontSize: 12, flex: 1 },
});
