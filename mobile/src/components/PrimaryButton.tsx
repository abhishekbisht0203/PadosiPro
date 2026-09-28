import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import React from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, motion, radii, shadows, spacing, typography } from '../theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface PrimaryButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Feather.glyphMap;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * The app's primary action.
 *
 * Everything that matters (continue, save, sign in) is this button, so it earns
 * the motion budget: it springs down slightly under the finger, draws a light
 * sweep across itself on press, and swaps to a spinner in place — never shifting
 * layout, so the screen does not jump at the moment of submission.
 */
export function PrimaryButton({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  fullWidth = true,
  style,
  testID,
}: PrimaryButtonProps) {
  const scale = useSharedValue(1);
  const isDisabled = disabled || loading;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    // Disabled buttons sink slightly rather than just greying out, which reads
    // as "not available yet" instead of "broken".
    opacity: withTiming(isDisabled ? 0.55 : 1, { duration: motion.fast }),
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.965, motion.springy);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, motion.springy);
  };

  const handlePress = () => {
    if (isDisabled) return;
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    onPress();
  };

  const content = (
    <View style={styles.inner}>
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'primary' ? colors.textInverse : colors.primary}
        />
      ) : (
        <>
          {icon ? (
            <Feather
              name={icon}
              size={17}
              color={variant === 'primary' ? colors.textInverse : colors.primary}
              style={{ marginRight: spacing.sm }}
            />
          ) : null}
          <Text
            numberOfLines={1}
            style={[
              styles.label,
              variant === 'primary' ? styles.labelOnDark : styles.labelOnLight,
              variant === 'danger' && styles.labelOnLight,
            ]}
          >
            {label}
          </Text>
        </>
      )}
    </View>
  );

  return (
    <AnimatedPressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      accessibilityLabel={label}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={isDisabled}
      style={[
        styles.base,
        fullWidth && styles.fullWidth,
        variant === 'secondary' && styles.secondary,
        variant === 'ghost' && styles.ghost,
        variant === 'danger' && styles.danger,
        variant === 'primary' && shadows.button,
        animatedStyle,
        style,
      ]}
    >
      {variant === 'primary' ? (
        <LinearGradient
          colors={[colors.primary, '#1A6E57']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradientFill}
        >
          {content}
        </LinearGradient>
      ) : (
        content
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 54,
    borderRadius: radii.md,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fullWidth: { width: '100%' },
  gradientFill: {
    flex: 1,
    minHeight: 54,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    minHeight: 54,
  },
  secondary: {
    backgroundColor: colors.mintSoft,
    borderWidth: 1,
    borderColor: '#CDEBE0',
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  danger: {
    backgroundColor: colors.errorSoft,
    borderWidth: 1,
    borderColor: '#FECDCA',
  },
  label: { ...typography.button },
  labelOnDark: { color: colors.textInverse },
  labelOnLight: { color: colors.primary },
});
