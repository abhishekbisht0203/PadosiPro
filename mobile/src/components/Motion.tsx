import { Feather } from '@expo/vector-icons';
import React, { useEffect } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { colors, motion, radii, spacing, typography } from '../theme';

interface Props {
  children: React.ReactNode;
  /** Stagger index; each row of a list animates in slightly after the one above. */
  index?: number;
  /** Distance travelled on entry, in px. */
  distance?: number;
  delay?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Entrance animation used across every screen.
 *
 * Content fades up into place rather than appearing, and the stagger means a
 * form or a list reads top-to-bottom instead of all at once. Reanimated runs
 * this on the UI thread, so it stays smooth even while the JS thread is busy
 * parsing a network response.
 */
export function FadeSlideIn({
  children,
  index = 0,
  distance = 16,
  delay = 0,
  duration = motion.slow,
  style,
}: Props) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = 0;
    progress.value = withDelay(delay, withTiming(1, { duration, easing: Easing.bezier(0.22, 1, 0.36, 1) }));
  }, [delay, duration, progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * distance }],
  }));

  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

/**
 * `FadeSlideIn` with the delay derived from a list index, which is how every
 * staggered screen is built: `base` is the pause before the first row appears,
 * `step` the gap between rows.
 */
export function StaggeredList({
  children,
  index,
  step = 55,
  base = 40,
  distance = 16,
  style,
}: {
  children: React.ReactNode;
  index: number;
  step?: number;
  base?: number;
  distance?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <FadeSlideIn index={index} delay={base + index * step} distance={distance} style={style}>
      {children}
    </FadeSlideIn>
  );
}

/**
 * A slow, very low amplitude float. Used behind hero content to keep the top of
 * a screen alive without being distracting.
 */
export function FloatingOrb({
  size,
  color,
  offset = 0,
  style,
}: {
  size: number;
  color: string;
  offset?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const float = useSharedValue(0);

  useEffect(() => {
    float.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 3200 + offset, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 3200 + offset, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [float, offset]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -14 * float.value }, { scale: 1 + 0.06 * float.value }],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        animatedStyle,
        style,
      ]}
    />
  );
}

/**
 * A single checkmark that draws itself. Used on the success moments (email
 * verified, tasks saved) instead of a static tick, because the moment of
 * confirmation is the emotional peak of each flow.
 */
export function DrawCheck({ size = 64, color = colors.primary }: { size?: number; color?: string }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withTiming(1, { duration: 620, easing: Easing.out(Easing.cubic) });
  }, [progress]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 0.6 + 0.4 * progress.value }],
    opacity: progress.value,
  }));

  return (
    <Animated.View style={[styles.checkCircle, { width: size, height: size, borderRadius: size / 2 }, animatedStyle]}>
      <Feather name="check" size={size * 0.45} color={color} />
    </Animated.View>
  );
}

/** Small pill used for counts and status, e.g. "3 selected". */
export function Badge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'success' | 'primary' | 'warning';
}) {
  const toneStyle = {
    neutral: { bg: colors.surfaceMuted, fg: colors.textSecondary },
    success: { bg: colors.successSoft, fg: colors.success },
    primary: { bg: colors.mintSoft, fg: colors.primary },
    warning: { bg: colors.warningSoft, fg: colors.warning },
  }[tone];

  return (
    <View style={[styles.badge, { backgroundColor: toneStyle.bg }]}>
      <Text style={[styles.badgeText, { color: toneStyle.fg }]}>{label}</Text>
    </View>
  );
}

/** Section label used above grouped content on the selection and home screens. */
export function SectionHeader({ title, count }: { title: string; count?: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {count ? <Text style={styles.sectionCount}>{count}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  checkCircle: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.mintSoft,
  },
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.pill,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    marginTop: spacing.lg,
  },
  sectionTitle: { ...typography.subtitle },
  sectionCount: { ...typography.bodySmall, fontWeight: '600' },
});
