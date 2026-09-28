import { Feather } from '@expo/vector-icons';
import React, { useCallback, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HeroHeader } from '../components/HeroHeader';
import { StaggeredList } from '../components/Motion';
import { PrimaryButton } from '../components/PrimaryButton';
import { InlineBanner } from '../components/States';
import { TextField } from '../components/TextField';
import { useAuth } from '../context/AuthContext';
import { colors, shared, spacing, typography } from '../theme';
import { describeError, mergeFieldErrors } from '../utils/errors';
import { hasErrors, normaliseMobile, validators, type FieldErrors } from '../utils/validation';

/**
 * First-login profile.
 *
 * Shown exactly once, straight after the first successful login. Name, mobile
 * and address are required; business name is optional and clearly marked as
 * such, because a large share of PadosiPro users are households rather than
 * businesses and forcing a business name would be friction for no benefit.
 */
export function ProfileScreen() {
  const { saveProfile } = useAuth();
  const insets = useSafeAreaInsets();

  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [address, setAddress] = useState('');
  const [businessName, setBusinessName] = useState('');

  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const clearFieldError = useCallback((field: string) => {
    setErrors((prev) => (prev[field] ? { ...prev, [field]: null } : prev));
    setFormError(null);
  }, []);

  const submit = useCallback(async () => {
    const nextErrors: FieldErrors = {};
    const nameError = validators.name(name);
    if (nameError) nextErrors.name = nameError;
    const mobileError = validators.mobile(mobile);
    if (mobileError) nextErrors.mobile = mobileError;
    const addressError = validators.address(address);
    if (addressError) nextErrors.address = addressError;
    const businessError = validators.businessName(businessName);
    if (businessError) nextErrors.businessName = businessError;

    if (hasErrors(nextErrors)) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setSaving(true);
    setFormError(null);

    try {
      await saveProfile({
        name: name.trim(),
        mobile: normaliseMobile(mobile),
        address: address.trim(),
        businessName: businessName.trim() ? businessName.trim() : null,
      });
      // AuthContext moves the stage on, which swaps this screen out.
    } catch (err) {
      setFormError(describeError(err));
      setErrors((prev) => ({ ...prev, ...mergeFieldErrors(err, prev) }));
    } finally {
      setSaving(false);
    }
  }, [address, businessName, mobile, name, saveProfile]);

  return (
    <KeyboardAvoidingView
      style={shared.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <HeroHeader
        eyebrow="Step 1 of 2"
        title="Tell us about you"
        subtitle="Your Lifestyle Manager uses this to reach you and to send the right person to your door."
        compact
      />

      <ScrollView
        contentContainerStyle={[shared.content, { paddingBottom: insets.bottom + spacing.xxl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {formError ? (
          <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(140)}>
            <InlineBanner tone="error" message={formError} onDismiss={() => setFormError(null)} />
          </Animated.View>
        ) : null}

        <StaggeredList index={0} base={140}>
          <View style={styles.form}>
            <TextField
              label="Full name"
              icon="user"
              value={name}
              onChangeText={(v) => {
                setName(v);
                clearFieldError('name');
              }}
              error={errors.name}
              placeholder="Arjun Rao"
              autoCapitalize="words"
              textContentType="name"
              returnKeyType="next"
            />

            <TextField
              label="Mobile number"
              icon="phone"
              value={mobile}
              onChangeText={(v) => {
                setMobile(v);
                clearFieldError('mobile');
              }}
              error={errors.mobile}
              placeholder="98765 43210"
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              returnKeyType="next"
              hint={!errors.mobile ? 'India only. We use this to coordinate visits.' : undefined}
            />

            <TextField
              label="Address"
              icon="map-pin"
              value={address}
              onChangeText={(v) => {
                setAddress(v);
                clearFieldError('address');
              }}
              error={errors.address}
              placeholder="Flat / House, street, locality, city, PIN code"
              multiline
              numberOfLines={3}
              returnKeyType="next"
            />

            <TextField
              label="Business name (optional)"
              icon="briefcase"
              value={businessName}
              onChangeText={(v) => {
                setBusinessName(v);
                clearFieldError('businessName');
              }}
              error={errors.businessName}
              placeholder="Only if you run one"
              autoCapitalize="words"
              returnKeyType="go"
              onSubmitEditing={submit}
              hint={!errors.businessName ? 'Leave this blank if this is a personal account.' : undefined}
            />
          </View>
        </StaggeredList>

        <StaggeredList index={1} base={140} style={styles.footer}>
          <PrimaryButton
            label="Continue to tasks"
            onPress={submit}
            loading={saving}
            icon="arrow-right"
            testID="profile-submit"
          />
          <View style={styles.privacyRow}>
            <Feather name="lock" size={12} color={colors.textTertiary} />
            <Text style={styles.privacyText}>Used only to assign your Lifestyle Manager and send the right help.</Text>
          </View>
        </StaggeredList>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.xs },
  footer: { marginTop: spacing.base, gap: spacing.base },
  privacyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.sm },
  privacyText: { ...typography.bodySmall, fontSize: 12, flex: 1 },
});
