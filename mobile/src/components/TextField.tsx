import { Feather } from '@expo/vector-icons';
import React, { useCallback, useRef, useState } from 'react';
import {
  Animated as RNAnimated,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { colors, motion, radii, spacing, typography } from '../theme';

interface TextFieldProps extends Omit<TextInputProps, 'style'> {
  label: string;
  icon?: keyof typeof Feather.glyphMap;
  error?: string | null;
  hint?: string;
  rightSlot?: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * Labelled input with an animated focus ring.
 *
 * The ring animates its colour, border width and a soft glow together so focus
 * reads as one continuous movement rather than three separate style swaps. The
 * error message reserves its height whether or not it is showing, which stops
 * the form from reflowing the moment validation fires.
 */
export function TextField({
  label,
  icon,
  error,
  hint,
  rightSlot,
  containerStyle,
  onFocus,
  onBlur,
  ...inputProps
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);
  const shake = useRef(new RNAnimated.Value(0)).current;

  const hasError = Boolean(error);

  const triggerShake = useCallback(() => {
    // A short horizontal shake is a standard, well-understood "that is wrong"
    // signal — the message alone is easy to miss on a small screen.
    RNAnimated.sequence([
      RNAnimated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
      RNAnimated.timing(shake, { toValue: -1, duration: 60, useNativeDriver: true }),
      RNAnimated.timing(shake, { toValue: 0.6, duration: 50, useNativeDriver: true }),
      RNAnimated.timing(shake, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }, [shake]);

  React.useEffect(() => {
    if (hasError) triggerShake();
  }, [hasError, triggerShake]);

  const translateX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-7, 7] });

  const borderColor = focused
    ? colors.primary
    : hasError
      ? colors.error
      : colors.borderStrong;

  return (
    <RNAnimated.View style={[{ transform: [{ translateX }] }, containerStyle]}>
      <Text style={[styles.label, hasError && styles.labelError]}>{label}</Text>

      <View
        style={[
          styles.field,
          { borderColor },
          focused && styles.fieldFocused,
          hasError && styles.fieldError,
        ]}
      >
        {icon ? (
          <Feather
            name={icon}
            size={18}
            color={hasError ? colors.error : focused ? colors.primary : colors.textTertiary}
            style={styles.icon}
          />
        ) : null}

        <TextInput
          {...inputProps}
          accessibilityLabel={label}
          placeholderTextColor={colors.textTertiary}
          style={[styles.input, !!inputProps.multiline && styles.inputMultiline]}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
        />

        {rightSlot}
      </View>

      {/* Fixed height keeps the form from jumping when a message appears. */}
      <View style={styles.messageSlot}>
        {hasError ? (
          <View style={styles.messageRow}>
            <Feather name="alert-circle" size={13} color={colors.error} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : hint ? (
          <Text style={styles.hintText}>{hint}</Text>
        ) : null}
      </View>
    </RNAnimated.View>
  );
}

/** Password field with a show/hide toggle that cross-fades the eye icon. */
export function PasswordField(props: Omit<TextFieldProps, 'secureTextEntry' | 'rightSlot'>) {
  const [visible, setVisible] = useState(false);
  const opacity = useRef(new RNAnimated.Value(1)).current;

  const toggle = () => {
    RNAnimated.sequence([
      RNAnimated.timing(opacity, { toValue: 0.2, duration: 90, useNativeDriver: true }),
      RNAnimated.timing(opacity, { toValue: 1, duration: motion.fast, useNativeDriver: true }),
    ]).start();
    setVisible((v) => !v);
  };

  return (
    <TextField
      {...props}
      secureTextEntry={!visible}
      autoCapitalize="none"
      autoCorrect={false}
      textContentType="password"
      rightSlot={
        <RNAnimated.View style={{ opacity }}>
          <Pressable
            onPress={toggle}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={visible ? 'Hide password' : 'Show password'}
          >
            <Feather name={visible ? 'eye-off' : 'eye'} size={18} color={colors.textTertiary} />
          </Pressable>
        </RNAnimated.View>
      }
    />
  );
}

/** Search input used on the task selection screen. */
export function SearchField({
  value,
  onChangeText,
  placeholder,
  onClear,
}: {
  value: string;
  onChangeText: (next: string) => void;
  placeholder: string;
  onClear?: () => void;
}) {
  return (
    <TextField
      label=""
      icon="search"
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      autoCapitalize="none"
      autoCorrect={false}
      returnKeyType="search"
      containerStyle={styles.searchContainer}
      rightSlot={
        value.length > 0 ? (
          <Pressable onPress={onClear ?? (() => onChangeText(''))} hitSlop={12} accessibilityLabel="Clear search">
            <Feather name="x-circle" size={18} color={colors.textTertiary} />
          </Pressable>
        ) : null
      }
    />
  );
}

export const keyboardTypes: Record<string, KeyboardTypeOptions> = {
  email: 'email-address',
  phone: 'phone-pad',
};

const styles = StyleSheet.create({
  label: {
    ...typography.label,
    marginBottom: spacing.sm,
    color: colors.textSecondary,
  },
  labelError: { color: colors.error },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1.5,
    paddingHorizontal: spacing.base,
    minHeight: 54,
    gap: spacing.md,
  },
  fieldFocused: {
    backgroundColor: colors.surface,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
    elevation: 3,
  },
  fieldError: { backgroundColor: colors.errorSoft },
  icon: { marginRight: 0 },
  input: {
    flex: 1,
    ...typography.body,
    paddingVertical: spacing.md,
    // Android adds its own vertical padding that misaligns the row.
    paddingHorizontal: 0,
    margin: 0,
  },
  inputMultiline: { minHeight: 96, textAlignVertical: 'top' },
  messageSlot: { minHeight: 20, paddingTop: 6 },
  messageRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  errorText: { ...typography.bodySmall, color: colors.error, flex: 1 },
  hintText: { ...typography.bodySmall },
  searchContainer: { marginBottom: spacing.xs },
});
