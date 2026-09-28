import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, monoFont, radii, spacing } from '../theme';

interface Props {
  value: string;
  onChange: (next: string) => void;
  length?: number;
  error?: string | null;
  autoFocus?: boolean;
}

/**
 * Six-box OTP entry.
 *
 * One hidden input owns the text; the boxes are purely presentational. That
 * gives the things a real user expects from a native OTP field for free —
 * autofill of the code from the email on iOS, one-tap paste, backspace moving
 * backwards — while still allowing the focus ring and the per-digit pop to be
 * animated independently.
 */
export function OtpInput({ value, onChange, length = 6, error, autoFocus = true }: Props) {
  const inputRef = useRef<TextInput>(null);
  const shake = useRef(new Animated.Value(0)).current;
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (error) {
      Animated.sequence([
        Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -1, duration: 60, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0.5, duration: 50, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]).start();
    }
  }, [error, shake]);

  const translateX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] });

  const handleChange = useCallback(
    (next: string) => {
      const digits = next.replace(/[^0-9]/g, '').slice(0, length);
      onChange(digits);
      if (Platform.OS !== 'web' && digits.length > 0) {
        void Haptics.selectionAsync();
      }
    },
    [length, onChange],
  );

  const translateY = useRef(new Animated.Value(0)).current;
  const lastLength = useRef(value.length);

  useEffect(() => {
    if (value.length > lastLength.current) {
      // Small pop as each digit lands, so a fast typist sees confirmation.
      Animated.sequence([
        Animated.spring(translateY, { toValue: -4, useNativeDriver: true, speed: 40, bounciness: 8 }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, speed: 30, bounciness: 6 }),
      ]).start();
    }
    lastLength.current = value.length;
  }, [translateY, value.length]);

  return (
    <View>
      <Animated.View style={[styles.row, { transform: [{ translateX }, { translateY }] }]}>
        {Array.from({ length }, (_, index) => {
          const digit = value[index] ?? '';
          const isActive = focused && index === value.length;
          const isFilled = digit.length > 0;

          return (
            <Animated.View key={index} style={styles.slotWrap}>
              <Pressable
                onPress={() => inputRef.current?.focus()}
                accessibilityRole="button"
                accessibilityLabel={`Digit ${index + 1} of ${length}`}
                style={[
                  styles.slot,
                  isFilled && styles.slotFilled,
                  isActive && styles.slotActive,
                  Boolean(error) && styles.slotError,
                ]}
              >
                <Text style={[styles.digit, Boolean(error) && styles.digitError]}>{digit}</Text>
              </Pressable>

              {/* The caret only shows on the box that would receive the next tap. */}
              {isActive ? <Animated.View style={styles.caret} /> : null}
            </Animated.View>
          );
        })}
      </Animated.View>

      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoFocus={autoFocus}
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        inputMode="numeric"
        keyboardType="number-pad"
        maxLength={length}
        caretHidden
        style={styles.hiddenInput}
        // Keeps the field reachable by screen readers even though it is invisible.
        accessibilityLabel="Verification code"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    marginVertical: spacing.lg,
  },
  slotWrap: { alignItems: 'center', justifyContent: 'center' },
  slot: {
    width: 46,
    height: 58,
    borderRadius: radii.md,
    borderWidth: 1.5,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotFilled: { borderColor: colors.primary, backgroundColor: colors.mintSoft },
  slotActive: { borderColor: colors.primary, shadowColor: colors.primary, shadowOpacity: 0.2, shadowRadius: 8, elevation: 3 },
  slotError: { borderColor: colors.error, backgroundColor: colors.errorSoft },
  digit: {
    fontFamily: monoFont,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  digitError: { color: colors.error },
  caret: {
    position: 'absolute',
    bottom: 14,
    width: 2,
    height: 22,
    borderRadius: 1,
    backgroundColor: colors.primary,
    opacity: 0.85,
  },
  hiddenInput: {
    position: 'absolute',
    opacity: 0,
    width: 1,
    height: 1,
  },
});
